"use strict";

const express = require('express');
const app = express();
const defaultPort = process.env.PORT || 80;
const bodyParser = require('body-parser')

const mysql = require('mysql');

require('dotenv').config();

const pool = mysql.createPool({
	connectLimit: process.env.DB_CONNECTIONLIMIT,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
	database: process.env.DB_DATABASE
});

const http = require('http');
//const https = require('https');

const path = require('path');

// CUSTOM MODULES
const account = require('./custom-modules/account');
const cryptography = require('./custom-modules/cryptography');
const log = require('./custom-modules/logging');
// END CUSTOM MODULES

app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname + '/../client/login.html'));
});

app.post('/authenticate-login', async (req, res) => {
	account.LogIn(req.body.email, await cryptography.Hash(req.body.password));
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
				});
			});
		});
	}
});

app.use(express.static('../client', {
  extensions: ['html', 'htm']
}));

const httpServer = http.createServer(app).listen(defaultPort, () => {
  log.info('node.js HTTP web server started on port ' + httpServer.address().port);
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
