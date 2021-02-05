'use strict';

const express = require('express');
const app = module.exports = express();
const defaultPort = process.env.PORT || 80;
const bodyParser = require('body-parser');

require('dotenv').config();
const mysql = require('mysql');

const async = require('async');

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

let sessionMiddleware = session({
  name: 'crosstalk.user.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 86400000 // 24 hours.
  }
});

app.use(sessionMiddleware);

const http = require('http');

const path = require('path');

// CUSTOM MODULES
const account = require('./custom-modules/account');
const cryptography = require('./custom-modules/cryptography');
const log = require('./custom-modules/logging');
const chat = require('./custom-modules/chat');
const db = require('./custom-modules/db');
// END CUSTOM MODULES

app.set('etag', false);

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
});

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
  if (req.session.LoggedIn || !req.query.verificationKey) {
    res.redirect('/chat');
  } else {
    pool.getConnection(async (err, connection) => {
      let sql = 'UPDATE USER SET Verified = 1, VerificationKey = NULL WHERE VerificationKey = ?';

      db.query(connection, sql, req.query.verificationKey, (result, fields) => {

        if (result.affectedRows > 0) {
          res.status(201).sendFile(path.join(__dirname + '/../client/hidden/verified.html'));
        } else {
          res.status(422).send(path.join(__dirname + '/../client/hidden/invalid-verification-key.html'));
        }

        connection.release();
      });
    });
  }
});

app.post('/authenticate-login', async (req, res) => {
  account.LogIn(req, res);
});

app.get('/logout', async (req, res) => {
  account.LogOut(req, res);
});

app.post('/JoinGroup', (req, res) => {
  if (!req.session.LoggedIn || !req.body.code) {
    res.json(JSON.stringify({status: 'invalid'}));
  } else {
    pool.getConnection(async (err, connection) => {
      let checkValid = `
      SELECT *
      FROM   (SELECT \`Group\`.GroupID AS JoinID
        FROM   \`Group\`
        WHERE  InviteCode = ?) AS t1
        LEFT JOIN (SELECT GroupMembership.GroupID AS MembershipJoinID
                  FROM   GroupMembership
                         JOIN \`Group\`
                         ON GroupMembership.GroupID = \`Group\`.GroupID
                  WHERE  UserID = ?
                         AND \`Group\`.InviteCode = ?) AS t2
                  ON TRUE;`;
      db.query(connection, checkValid, [req.body.code, req.session.UserID, req.body.code], (firstResult, fields) => {

        if (firstResult[0] && firstResult[0].JoinID && !firstResult[0].MembershipJoinID) {
          let joinGroup = `INSERT INTO GroupMembership (UserID, GroupID) VALUES (?, ?);`;

          db.query(connection, joinGroup, [req.session.UserID, firstResult[0].JoinID], (secondResult, fields) => {
            res.json(JSON.stringify({
              status: 'success',
              groupID: firstResult[0].JoinID
            }));
          });
        } else if (firstResult[0] && firstResult[0].MembershipJoinID) {
          res.json(JSON.stringify({
            status: 'existing',
            groupID: firstResult[0].JoinID
          }));
        } else {
          res.json(JSON.stringify({status: 'invalid'}));
        }
      });

      connection.release();
    });
  }
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
      res.status(422).sendFile(path.join(__dirname + '/../client/hidden/invalid-recovery-key.html'));
    } else {
      db.query(connection, sql, [req.query.recoveryKey, new Date().getTime()], (result, fields) => {

        if (result[0].NumberOfMatches != 1 && !req.session.LoggedIn) {
          res.status(422).sendFile(path.join(__dirname + '/../client/hidden/invalid-recovery-key.html'));
        } else {
          res.status(200).sendFile(path.join(__dirname + '/../client/servable/account/change-password.html'));
        }
      });
    }

    connection.release();
  });
});

app.post('/account/change-password', async (req, res) => {
  account.ChangePassword(req, res);
});

app.post('/CreateGroup', (req, res) => {
  log.info("Creating a new group called " + req.body.group);

  pool.getConnection(async (err, connection) => {
    if (err) throw err; // Connection failed.

    async.waterfall([
      function GetID(callback) {
        GetNewGroupID(connection, (inviteCode) => {
          callback(null, inviteCode);
        });
      },
      function InsertID(inviteCode, callback) {
        let idInsertionQuery = 'INSERT INTO \`Group\` (GroupName, InviteCode) VALUES (?, ?);';

        db.query(connection, idInsertionQuery, [req.body.group, inviteCode], (result, fields) => {
          callback(null, inviteCode, result);
        });
      },
      function GetGroupID(inviteCode, firstResult, callback) {
        let selectionQuery = 'SELECT GroupID FROM \`Group\` WHERE InviteCode = ?;';

        db.query(connection, selectionQuery, inviteCode, (result, fields) => {
          callback(null, inviteCode, firstResult, result);
        });
      },
      function AddMembership(inviteCode, firstResult, secondResult, callback) {
        let membershipInsertionQuery = 'INSERT INTO GroupMembership VALUES (?, ?, 2);';

        db.query(connection, membershipInsertionQuery, [req.session.UserID, secondResult[0].GroupID], (result, fields) => {
          callback(null, inviteCode, firstResult, secondResult, result);
        });
      }
    ], (error, inviteCode, firstResult, secondResult, thirdResult) => {
      res.status(200).json(JSON.stringify([{
        'GroupID': secondResult[0].GroupID
      }]));

      connection.release();
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

app.post('/api/GetMyGroups', (req, res, next) => {
  if (req.session.LoggedIn) {
    let servers = [];

    pool.getConnection(async (err, connection) => {
      let sql = `
      SELECT GroupInfo.GroupID,
        GroupInfo.GroupName,
        MessageInfo.LatestMessageString
      FROM (SELECT \`Group\`.GroupID,
            \`Group\`.GroupName
            FROM   \`Group\`
            JOIN GroupMembership
            ON \`Group\`.GroupID = GroupMembership.GroupID
            WHERE  GroupMembership.UserID = ?) AS GroupInfo
      LEFT JOIN (SELECT Message.Messagestring AS LatestMessageString,
                        LatestMessage.GroupID,
                        LatestMessage.Timestamp
                 FROM   Message
                 JOIN (SELECT GroupID, MAX(Timestamp) AS Timestamp
                      FROM   Message
                      GROUP  BY GroupID) AS LatestMessage
                      ON Message.GroupID = LatestMessage.GroupID
                      AND Message.Timestamp = LatestMessage.Timestamp
                      ORDER  BY LatestMessage.Timestamp DESC) AS MessageInfo
      ON GroupInfo.GroupID = MessageInfo.GroupID
      ORDER  BY MessageInfo.Timestamp DESC, GroupInfo.GroupName;
      `;

      db.query(connection, sql, req.session.UserID, (result, fields) => {

        res.json(JSON.stringify(result));

        connection.release();
      });
    });
  } else {
    next();
  }
});

app.post('/api/GetMyDisplayName', (req, res, next) => {
  if (req.session.LoggedIn) {
    pool.getConnection(async (err, connection) => {
      let sql = "SELECT DisplayName FROM User WHERE UserID = ?;";

      db.query(connection, sql, req.session.UserID, (result, fields) => {

        res.json(JSON.stringify(result));

        connection.release();
      });
    });
  } else {
    next();
  }
});

app.post('/api/GetMyUserID', (req, res, next) => {
  if (req.session.LoggedIn) {
    res.json(JSON.stringify([{
      'UserID': req.session.UserID
    }]));
  } else {
    next();
  }
});

app.post('/api/GetMessages', (req, res, next) => {
  if (req.session.LoggedIn && req.body.GroupID) {
    pool.getConnection(async (err, connection) => {
      async.parallel({
        adminStatus: function DetermineRole(callback) {
          let determineRoleQuery = 'SELECT Role FROM GroupMembership WHERE UserID = ? AND GroupID = ?;';

          db.query(connection, determineRoleQuery, [req.session.UserID, req.body.GroupID], (result, fields) => {
            callback(null, result[0].Role > 0);
          });
        },
        messages: function GetMessageData(callback) {
          let getMessageDataQuery = 'SELECT Message.MessageID, User.DisplayName AS AuthorDisplayName, Message.MessageString, Message.Timestamp, Message.AuthorID = ? AS Owned FROM Message JOIN GroupMembership on Message.GroupID = GroupMembership.GroupID JOIN User ON User.UserID = Message.AuthorID WHERE GroupMembership.UserID = ? and GroupMembership.GroupID = ? ORDER BY Message.Timestamp;';

          db.query(connection, getMessageDataQuery, [req.session.UserID, req.session.UserID, req.body.GroupID], (result, fields) => {
            callback(null, result);
          });
        }
      }, (error, results) => {
        res.json(JSON.stringify({
          isAdmin: results.adminStatus, // Result of first function.
          messageData: results.messages // Result of second function.
        }));

        connection.release();
      });
    });
  } else {
    next();
  }
});

app.post('/api/GetPinnedMessage', (req, res, next) => {
  if (req.session.LoggedIn && req.body.GroupID) {
    pool.getConnection(async (err, connection) => {
      let sql = `
      SELECT Message.MessageID, User.DisplayName AS AuthorDisplayName,
        Message.MessageString, Message.Timestamp
      FROM Message
        JOIN User
          ON Message.AuthorID = User.UserID
        JOIN \`Group\`
          ON \`Group\`.PinnedMessageID = Message.MessageID
        JOIN GroupMembership
          ON \`Group\`.GroupID = GroupMembership.GroupID
      WHERE  Groupmembership.UserID = ?
        AND \`group\`.GroupID = ?;`;

      db.query(connection, sql, [req.session.UserID, req.body.GroupID], (result, fields) => {
        res.json(JSON.stringify(result));

        connection.release();
      });
    });
  } else {
    next();
  }
})

app.post('/api/GetInviteCode', (req, res, next) => {
  if (req.session.LoggedIn && req.body.GroupID) {
    pool.getConnection(async (err, connection) => {
      let sql = "SELECT InviteCode FROM `Group` WHERE GroupID = ?;";

      db.query(connection, sql, req.body.GroupID, (result, fields) => {
        res.json(JSON.stringify(result));

        connection.release();
      });
    });
  } else {
    next();
  }
});

app.delete('/api/DeleteMessage', (req, res, next) => {
  if (req.session.LoggedIn && req.body.MessageID) {
    pool.getConnection(async (err, connection) => {
      let checkValidQuery = 'SELECT COUNT(*) AS Matches, Message.GroupID FROM Message JOIN GroupMembership ON Message.GroupID = GroupMembership.GroupID WHERE (Message.AuthorID = GroupMembership.UserID OR GroupMembership.Role > 0) AND Message.MessageID = ? AND GroupMembership.UserID = ?;';

      db.query(connection, checkValidQuery, [req.body.MessageID, req.session.UserID], (firstResult, fields) => {
        if (firstResult[0].Matches == 1) {
          async.parallel({
            secondResult: function(callback) {
              let deleteQuery = "DELETE FROM Message WHERE MessageID = ?;";

              db.query(connection, deleteQuery, req.body.MessageID, (result, fields) => {
                callback(null, result);
              });
            },
            thirdResult: function(callback) {
              let getRecentMessageQuery = 'SELECT Message.MessageString AS LatestMessageString FROM Message WHERE Message.GroupID = ? ORDER BY Timestamp DESC LIMIT 1;';

              db.query(connection, getRecentMessageQuery, firstResult[0].GroupID, (result, fields) => {
                callback(null, result);
              });
            }
          }, (error, results) => {
            res.json(JSON.stringify({status: 'success'}));

            chat.bin(firstResult[0].GroupID, req.body.MessageID, results.thirdResult[0].LatestMessageString);
          });
        } else {
          res.json(JSON.stringify({status: 'invalid'}));
        }

        connection.release();
      });
    });
  } else {
    res.json(JSON.stringify({status: 'invalid'}));
  }
});

app.post('/api/PinMessage', (req, res) => {
  if (req.session.LoggedIn && req.body.MessageID) {
    pool.getConnection(async (err, connection) => {
      let checkValidQuery = 'SELECT COUNT(*) AS Matches FROM Message JOIN GroupMembership ON Message.GroupID = GroupMembership.GroupID WHERE GroupMembership.Role > 0 AND Message.MessageID = ? AND GroupMembership.UserID = ?;';

      db.query(connection, checkValidQuery, [req.body.MessageID, req.session.UserID], (result, fields) => {
        if (result[0].Matches == 1) {
          async.waterfall([
            function(callback) {
              let getGroupQuery = "SELECT GroupID FROM Message WHERE MessageID = ?;";

              db.query(connection, getGroupQuery, req.body.MessageID, (result, fields) => {
                callback(null, result[0].GroupID);
              });
            },
            function(groupIDToUpdate, callback) {
              let updateGroupQuery = 'UPDATE \`Group\` SET PinnedMessageID = ? WHERE GroupID = ?;';

              db.query(connection, updateGroupQuery, [req.body.MessageID, groupIDToUpdate], (result, fields) => {
                callback(null, groupIDToUpdate);
              });
            }
          ], (error, groupIDToUpdate) => {
            res.json(JSON.stringify({status: 'success'}));

            chat.pin(groupIDToUpdate);
          });
        } else {
          res.json(JSON.stringify({status: 'invalid'}));
        }

        connection.release();
      });
    });
  } else {
    res.json(JSON.stringify({status: 'invalid'}));
  }
});

app.post('/api/UnpinMessage', (req, res) => {
  if (req.session.LoggedIn && req.body.GroupID) {
    pool.getConnection(async (err, connection) => {
      let checkValidQuery = 'SELECT COUNT(*) AS Matches, \`Group\`.GroupID, \`Group\`.PinnedMessageID AS MessageID FROM \`Group\` JOIN GroupMembership ON \`Group\`.GroupID = GroupMembership.GroupID WHERE GroupMembership.Role > 0 AND \`Group\`.GroupID = ? AND GroupMembership.UserID = ?;';
      db.query(connection, checkValidQuery, [req.body.GroupID, req.session.UserID], (result, fields) => {
        if (result[0].Matches == 1) {
          let groupIDToUpdate = result[0].GroupID;
          let unpinnedMessageID = result[0].MessageID;

          let updateQuery = 'UPDATE \`Group\` SET PinnedMessageID = NULL WHERE GroupID = ?;';
          db.query(connection, updateQuery, groupIDToUpdate, (result, fields) => {

            res.json(JSON.stringify({status: 'success'}));
            chat.unpin(groupIDToUpdate, unpinnedMessageID);
          });
        } else {
          res.json(JSON.stringify({status: 'invalid'}));
        }

        connection.release();
      });
    });
  } else {
    res.json(JSON.stringify({status: 'invalid'}));
  }
});

app.use(express.static('../client/servable', {
  extensions: ['html', 'htm']
}));

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname + '/../client/hidden/404.html'));
});

const httpServer = http.createServer(app).listen(defaultPort, () => {
  log.info('Node.js HTTP web server started on port ' + httpServer.address().port);
  chat.initialise(io);
});

let io = require('socket.io')(httpServer);

io.use((socket, next) => {
  // Allow us to access session data directly from any established socket.
  sessionMiddleware(socket.request, socket.request.res, next);
});

function GetNewGroupID(connection, callback) {

  let duplicates = 0;

  do {

    let candidateID = require('crypto').randomBytes(6).toString('hex');

    db.query(connection, 'SELECT COUNT(*) AS NumberOfDuplicates FROM `Group` WHERE InviteCode = ?;', candidateID, (result, fields) => {
      duplicates = result[0].NumberOfDuplicates;

      if (duplicates == 0) {
        return callback(candidateID); // Ensure callback is called after the async activity terminates, to prevent null errors.
      }
    });
  } while (duplicates != 0);
}
