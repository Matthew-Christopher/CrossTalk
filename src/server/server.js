"use strict";

const express = require('express');
const app = module.exports = express();
const defaultPort = process.env.PORT || 80;
const bodyParser = require('body-parser');

require('dotenv').config();
const mysql = require('mysql');

const pool = mysql.createPool({
  connectionLimit: process.env.DB_CONNECTIONLIMIT,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE
});

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session); // Persist user sessions between restartsif the cookie hasn't expired.

const sessionStore = new MySQLStore({
	clearExpired: true,
	createDatabaseTable: true,
	expiration: 86400000, // 24 hours.
	endConnectionOnClose: true,
	schema: {
		tableName: 'UserSession',
		columnNames: {
			session_id: 'SessionID',
			expires: 'Expires',
			data: 'Data'
		}
	}
}, pool);

app.use(session({
	name: 'crosstalk.user.sid',
	secret: process.env.SESSION_SECRET,
	store: sessionStore,
	resave: false,
	saveUninitialized: false,
	cookie: {
		maxAge: 86400000 // 24 hours.
	}
}));

const http = require('http');
//const https = require('https'); // Running on localhost, we could implement SSL later.

const path = require('path');

// CUSTOM MODULES
const account = require('./custom-modules/account');
const cryptography = require('./custom-modules/cryptography');
const log = require('./custom-modules/logging');
const mailer = require('./custom-modules/mailer');
const chat = require('./custom-modules/chat');
const AvailableGroup = require('./custom-modules/AvailableGroup.js');
// END CUSTOM MODULES

app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());

app.get('/', (req, res) => {
	if (req.session.LoggedIn){
		res.redirect('/chat')
	} else {
		res.sendFile(path.join(__dirname + '/../client/login.html'));
	}
});

app.get('/verify', (req, res) => {
  log.info(req.query.verificationKey);

  pool.getConnection(async (err, connection) => {
    if (err) throw err;

    var sql = "UPDATE USER SET Verified = 1, VerificationKey = NULL WHERE VerificationKey = ?";

    connection.query(mysql.format(sql, req.query.verificationKey), (error, res, fields) => {
      connection.release();

      if (error) throw error; // Handle post-release error.
    });
  });

  res.status(201).send("Verified. You may now log in.");
});

app.post('/authenticate-login', async (req, res) => {
	account.LogIn(req, res);
});

app.post('/register-account', async (req, res) => {
	var hash = await cryptography.Hash(req.body.password);

	if ((req.body.email != req.body['confirm-email']) || !await cryptography.CompareHashes(hash, req.body['confirm-password'])){
		res.status(105).send("Data entered was not valid.");
	} else {
		pool.getConnection(async (err, connection) => {
			if (err) throw err; // Connection failed.

			GetUserId(connection, req, (userId) => {
				var sql = "INSERT INTO User VALUES (?, ?, ?, ?, False, ?);";
				var inserts = [userId[0], req.body['display-name'], req.body.email, hash, userId[1]];

				connection.query(mysql.format(sql, inserts), (error, res, fields) => {
					connection.release();

					if (error) throw error; // Handle post-release error.

					mailer.SendVerification(req.body.email, userId[1]);
				});
			});
		});

		res.status(201).send("<p>A link has been sent to the provided email address. Please click it to verify your account, <u>checking also in your spam folder.</u></p><b>IMPORTANT NOTE: This project is part of my Computer Science A Level NEA. Please do not mistake this for an actual commericial service or product. You should not create an account if you have stumbled upon this website without being given permission to use or test it. Thank you.</b>");
	}
});

app.get('/chat', (req, res) => {
	if (req.session.LoggedIn) { // Only allow access to the chat page for logged-in users.
		res.sendFile(path.join(__dirname + '/../client/chat.html'));
	} else {
		res.redirect('/');
	}
});

app.get('/api/GetMyGroups', (req, res) => {
	let servers = [];

	pool.getConnection(async (err, connection) => {
		var sql = `SELECT \`Group\`.GroupID, \`Group\`.GroupName FROM \`Group\`
		 JOIN GroupMembership ON \`Group\`.GroupID = GroupMembership.GroupID
		 WHERE GroupMembership.UserID = ?;`;

		connection.query(mysql.format(sql, req.session.UserID), (err, result, fields) => {
			res.json(JSON.stringify(result));
		});
	});
});

app.get('/api/GetMyDisplayName', (req, res) => {
	pool.getConnection(async (err, connection) => {
		var sql = "SELECT DisplayName FROM User WHERE UserID = ?;";

		connection.query(mysql.format(sql, req.session.UserID), (err, result, fields) => {
			res.json(JSON.stringify(result));
		});
	});
})

app.use(express.static('../client', {
  extensions: ['html', 'htm']
}));

const httpServer = http.createServer(app).listen(defaultPort, () => {
  log.info('node.js HTTP web server started on port ' + httpServer.address().port);
	chat.initialise(httpServer);
});

function GetUserId(connection, req, callback) {
	var idArray = [];
	do {
		var numOfDuplicates = 0;
		connection.query("SELECT UUID() AS UserId, LEFT(MD5(RAND()), 32) AS VerificationKey;", (error, firstResult, fields) => {
			if (error) throw error;

			idArray = [firstResult[0].UserId, firstResult[0].VerificationKey];

			connection.query(mysql.format("SELECT COUNT(*) AS NumberOfDuplicates FROM User WHERE UserId = ? OR VerificationKey = ?;", [idArray[0], idArray[1]]), (error, secondResult, fields) => {
				numOfDuplicates = secondResult[0].NumberOfDuplicates;

				if (numOfDuplicates == 0) {
					return callback(idArray); // Ensure callback is called after the async activity terminates, to prevent null errors.
				}
			});
		});
	} while (numOfDuplicates != 0);
}
