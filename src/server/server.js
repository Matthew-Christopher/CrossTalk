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
const MySQLStore = require('express-mysql-session')(session); // Persist user sessions between restarts if the cookie hasn't expired.

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

const path = require('path');

// CUSTOM MODULES
const account = require('./custom-modules/account');
const cryptography = require('./custom-modules/cryptography');
const log = require('./custom-modules/logging');
const chat = require('./custom-modules/chat');
const AvailableGroup = require('./custom-modules/AvailableGroup.js');
// END CUSTOM MODULES

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());


app.get('(/login(.html)?)?', (req, res) => {
  if (req.session.LoggedIn) {
    res.redirect('/chat');
  } else {
    res.sendFile(path.join(__dirname + '/../client/servable/login.html'));
  }
});

app.get('/recover(.html)?', (req, res) => {
  if (req.session.LoggedIn) {
    res.redirect('/chat');
  } else {
    res.sendFile(path.join(__dirname + '/../client/servable/recover.html'));
  }
});

app.get('/register(.html)?', (req, res) => {
  if (req.session.LoggedIn) {
    res.redirect('/chat');
  } else {
    res.sendFile(path.join(__dirname + '/../client/servable/register.html'));
  }
});

app.get('/verify', (req, res) => {
  pool.getConnection(async (err, connection) => {
    if (err) throw err;

    let sql = "UPDATE USER SET Verified = 1, VerificationKey = NULL WHERE VerificationKey = ?";

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

app.get('/logout', async (req, res) => {
  account.LogOut(req, res);
});

app.get('/JoinGroup', (req, res) => {
  pool.getConnection(async (err, connection) => {
    let checkValid = `SELECT GroupID AS JoinID FROM \`Group\` WHERE InviteCode = ?;`;

    connection.query(mysql.format(checkValid, req.query.code), (error, firstResult, fields) => {

      if (error) throw error;

      if (firstResult.length > 0) {
        let joinGroup = `INSERT INTO GroupMembership (UserID, GroupID) VALUES (?, ?);`;

        connection.query(mysql.format(joinGroup, [req.session.UserID, firstResult[0].JoinID]), (error, secondResult, fields) => {
          connection.release();

          if (error) throw error; // Handle post-release error.

          res.json(JSON.stringify({
            status: "success",
            groupID: firstResult[0].JoinID
          }));
        });
      } else {
        res.json(JSON.stringify({status: 'invalid'}));
      }
    });
  });
});

app.post('/register-account', async (req, res) => {
  account.Register(req, res);
});

app.post('/recover-account', async (req, res) => {
  account.Recover(req, res);
});

app.get('/account/change-password(.html)?', (req, res) => {
  pool.getConnection(async (err, connection) => {
    if (err) throw err;

    let sql = "SELECT COUNT(*) AS NumberOfMatches FROM User WHERE RecoveryKey = ? AND RecoveryKeyExpires > ?;";

    if (!(req.query.recoveryKey || req.session.LoggedIn)) {
      res.status(422).send('<meta http-equiv="refresh" content="5; url=/recover" />Invalid recovery link. It might have expired or have been mis-copied. Redirecting in 5 seconds.');
    } else {
      connection.query(mysql.format(sql, [req.query.recoveryKey, new Date().getTime()]), (error, result, fields) => {
        if (error) throw error;

        if (result[0].NumberOfMatches != 1 && !req.session.LoggedIn) {
          res.status(422).send('<meta http-equiv="refresh" content="5; url=/recover" />Invalid recovery link. It might have expired or have been mis-copied. Redirecting in 5 seconds.');
        } else {
          res.status(200).sendFile(path.join(__dirname + '/../client/servable/account/change-password.html'));
        }

        connection.release();

        if (error) throw error; // Handle post-release error.
      });
    }
  });
});

app.post('/account/change-password', async (req, res) => {
  account.ChangePassword(req, res);
});

app.post('/CreateGroup', (req, res) => {
  log.info("Creating a new group called " + req.body.group);

  pool.getConnection(async (err, connection) => {
    if (err) throw err; // Connection failed.

    GetNewGroupID(connection, (groupID) => {
      let sql = "INSERT INTO `Group` VALUES (?, ?, ?);";
      let inserts = [groupID[0], req.body.group, groupID[1]];

      connection.query(mysql.format(sql, inserts), (error, result, fields) => {

        if (error) throw error;

        let sql = `INSERT INTO GroupMembership VALUES (?, ?, 2);`;

        connection.query(mysql.format(sql, [req.session.UserID, groupID[0]]), (error, result, fields) => {
          connection.release();

          if (err) throw error; // Handle post-release error.
          res.status(200).json(JSON.stringify([{
            'GroupID': groupID[0]
          }]));
        });
      });
    });
  });
});

app.get('/chat(.html)?', (req, res) => {
  if (req.session.LoggedIn) { // Only allow access to the chat page for logged-in users.
    res.sendFile(path.join(__dirname + '/../client/servable/chat.html'));
  } else {
    res.redirect('/');
  }
});

app.get('/api/GetMyGroups', (req, res) => {
  let servers = [];

  pool.getConnection(async (err, connection) => {
    let sql = `
    SELECT GroupInfo.GroupID,
           GroupInfo.GroupName,
           MessageInfo.LatestMessageString
    FROM   (SELECT \`Group\`.GroupID,
                   \`Group\`.GroupName
            FROM   \`Group\`
                   JOIN GroupMembership
                     ON \`Group\`.GroupID = GroupMembership.GroupID
            WHERE  GroupMembership.UserID = ?)
           AS
           GroupInfo
           LEFT JOIN (SELECT Message.Messagestring AS LatestMessageString,
                        LatestMessage.GroupID,
                        LatestMessage.Timestamp
                 FROM   Message
                        JOIN (SELECT GroupID,
                                     MAX(Timestamp) AS Timestamp
                              FROM   Message
                              GROUP  BY GroupID) AS LatestMessage
                          ON Message.GroupID = LatestMessage.GroupID
                             AND Message.Timestamp = LatestMessage.Timestamp
                 ORDER  BY LatestMessage.Timestamp DESC) AS MessageInfo
             ON GroupInfo.GroupID = MessageInfo.GroupID
    ORDER  BY MessageInfo.Timestamp DESC, GroupInfo.GroupName;
    `;

    connection.query(mysql.format(sql, req.session.UserID), (error, result, fields) => {
      connection.release();

      if (error) throw error; // Handle post-release error.

      res.json(JSON.stringify(result));
    });
  });
});

app.get('/api/GetMyDisplayName', (req, res) => {
  pool.getConnection(async (err, connection) => {
    let sql = "SELECT DisplayName FROM User WHERE UserID = ?;";

    connection.query(mysql.format(sql, req.session.UserID), (error, result, fields) => {
      connection.release();

      if (error) throw error; // Handle post-release error.

      res.json(JSON.stringify(result));
    });
  });
});

app.get('/api/GetMyUserID', (req, res) => {
  res.json(JSON.stringify([{
    'UserID': req.session.UserID
  }]));
});

app.get('/api/GetMessages', (req, res) => {

  pool.getConnection(async (err, connection) => {
    let sql = 'SELECT Message.MessageID, Message.AuthorID, Message.MessageString, Message.Timestamp FROM Message JOIN GroupMembership on Message.GroupID = GroupMembership.GroupID WHERE GroupMembership.UserID = ? and GroupMembership.GroupID = ? ORDER BY Message.Timestamp;';

    connection.query(mysql.format(sql, [req.session.UserID, req.query.GroupID]), (error, result, fields) => {
      connection.release();

      if (error) throw error; // Handle post-release error.

      res.json(JSON.stringify(result));
    });
  });
});

app.get('/api/GetInviteCode', (req, res) => {
  pool.getConnection(async (err, connection) => {
    let sql = "SELECT InviteCode FROM `Group` WHERE GroupID = ?;";

    connection.query(mysql.format(sql, req.query.GroupID), (error, result, fields) => {
      connection.release();

      if (error) throw error; // Handle post-release error.

      res.json(JSON.stringify(result));
    });
  });
});

app.use(express.static('../client/servable', {
  extensions: ['html', 'htm']
}));

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname + '/../client/error/404.html'));
});

const httpServer = http.createServer(app).listen(defaultPort, () => {
  log.info('Node.js HTTP web server started on port ' + httpServer.address().port);
  chat.initialise(httpServer);
});

function GetUserID(connection, callback) {
  let idArray = [];
  do {
    let duplicates = 0;

    connection.query("SELECT UUID() AS UserID;", (error, firstResult, fields) => {
      if (error) throw error;

      idArray = [firstResult[0].UserID, require('crypto').randomBytes(16).toString('hex')];

      connection.query(mysql.format("SELECT COUNT(*) AS NumberOfDuplicates FROM User WHERE UserID = ? OR VerificationKey = ?;", [idArray[0], idArray[1]]), (error, secondResult, fields) => {

        if (error) throw error;

        duplicates = secondResult[0].NumberOfDuplicates;

        if (duplicates == 0) {
          return callback(idArray); // Ensure callback is called after the async activity terminates, to prevent null errors.
        }
      });
    });

  } while (duplicates != 0);
}

function GetNewGroupID(connection, callback) {
  let idArray = [];
  let duplicates = 0;

  do {

    connection.query("SELECT UUID() AS GroupID;", (error, firstResult, fields) => {
      if (error) throw error;

      idArray = [firstResult[0].GroupID, require('crypto').randomBytes(6).toString('hex')];

      connection.query(mysql.format("SELECT COUNT(*) AS NumberOfDuplicates FROM `Group` WHERE GroupID = ? OR InviteCode = ?;", [idArray[0], idArray[1]]), (error, secondResult, fields) => {
        if (error) throw error;

        duplicates = secondResult[0].NumberOfDuplicates;

        if (duplicates == 0) {
          return callback(idArray); // Ensure callback is called after the async activity terminates, to prevent null errors.
        }
      });
    });
  } while (duplicates != 0);
}
