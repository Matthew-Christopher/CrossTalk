'use strict';

const express = require('express');
const app = (module.exports = express());
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
  database: process.env.DB_DATABASE,
});

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session); // Persist user sessions between restarts if the cookie hasn't expired.

const sessionStore = new MySQLStore(
  {
    clearExpired: true,
    createDatabaseTable: true,
    expiration: 172800000, // Expire after 48 hours.
    endConnectionOnClose: true,
    schema: {
      tableName: 'UserSession',
      columnNames: {
        session_id: 'SessionID',
        expires: 'Expires',
        data: 'Data',
      },
    },
  },
  pool
);

let sessionMiddleware = session({
  name: 'crosstalk.user.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 172800000, // 48 hours.
  },
});

app.use(sessionMiddleware); // Allow sessions to be saved to clients.

const http = require('http');

const fs = require('fs');
const path = require('path');

// CUSTOM MODULES
const account = require('./custom-modules/account');
const cryptography = require('./custom-modules/cryptography');
const log = require('./custom-modules/logging');
const chat = require('./custom-modules/chat');
const db = require('./custom-modules/db');
// END CUSTOM MODULES

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json());

app.get('(/login(.html)?)?', (req, res) => {
  if (req.session.LoggedIn) {
    res.redirect('/chat'); // Only allow users that are not logged in.
  } else {
    res.sendFile(path.join(__dirname + '/../client/servable/login.html'));
  }
});

app.get('/recover(.html)?', (req, res) => {
  if (req.session.LoggedIn) {
    res.redirect('/chat'); // Only allow users that are not logged in.
  } else {
    res.sendFile(path.join(__dirname + '/../client/servable/recover.html'));
  }
});

app.get('/register(.html)?', (req, res) => {
  if (req.session.LoggedIn) {
    res.redirect('/chat'); // Only allow users that are not logged in.
  } else {
    res.sendFile(path.join(__dirname + '/../client/servable/register.html'));
  }
});

app.get('/verify', (req, res) => {
  if (req.session.LoggedIn || !req.query.verificationKey) {
    // Only allow users that are not logged in and have provided some key for us to check.
    res.redirect('/chat');
  } else {
    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      let sql = 'UPDATE USER SET Verified = 1, VerificationKey = NULL WHERE VerificationKey = ?'; // Set the user as verified.

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
    res.json(JSON.stringify({ status: 'invalid' }));
  } else {
    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      let checkValid = `
      SELECT *
      FROM   (SELECT \`Group\`.GroupID AS JoinID
        FROM   \`Group\`
        WHERE  InviteCode = ?) AS FirstDerivedTable
        LEFT JOIN (SELECT GroupMembership.GroupID AS MembershipJoinID
                  FROM   GroupMembership
                         JOIN \`Group\`
                         ON GroupMembership.GroupID = \`Group\`.GroupID
                  WHERE  UserID = ?
                         AND \`Group\`.InviteCode = ?) AS SecondDerivedTable
                  ON TRUE;`;
      db.query(connection, checkValid, [req.body.code, req.session.UserID, req.body.code], (firstResult, fields) => {
        if (firstResult[0] && firstResult[0].JoinID && !firstResult[0].MembershipJoinID) {
          let joinGroup = `INSERT INTO GroupMembership (UserID, GroupID) VALUES (?, ?);`; // Add the user to the group.

          db.query(connection, joinGroup, [req.session.UserID, firstResult[0].JoinID], (secondResult, fields) => {
            res.json(
              JSON.stringify({
                status: 'success',
                groupID: firstResult[0].JoinID, // Return the group ID so the client can add it.
              })
            );
          });
        } else if (firstResult[0] && firstResult[0].MembershipJoinID) {
          res.json(
            JSON.stringify({
              status: 'existing',
              groupID: firstResult[0].JoinID, // Return the group ID so the client can jump to it.
            })
          );
        } else {
          res.json(JSON.stringify({ status: 'invalid' }));
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
    if (err) throw err; // Connection failed.

    let sql = 'SELECT COUNT(*) AS NumberOfMatches FROM User WHERE RecoveryKey = ? AND RecoveryKeyExpires > ?;'; // Is the recovery key correct and not-expired?

    if (!(req.query.recoveryKey || req.session.LoggedIn)) {
      // Only allow users that are not logged in and have provided us with a verification key to check.
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
  log.info('Creating a new group called ' + req.body.group);

  pool.getConnection(async (err, connection) => {
    if (err) throw err; // Connection failed.

    async.waterfall(
      [
        function GetID(callback) {
          // Get a unique invite code.
          GetNewGroupID(connection, (inviteCode) => {
            callback(null, inviteCode);
          });
        },
        function InsertID(inviteCode, callback) {
          // Create the group.
          let idInsertionQuery = 'INSERT INTO `Group` (GroupName, InviteCode) VALUES (?, ?);';

          db.query(connection, idInsertionQuery, [req.body.group, inviteCode], (result, fields) => {
            callback(null, inviteCode, result);
          });
        },
        function AddMembership(inviteCode, firstResult, callback) {
          // Add the user to the group using the primary key from the record we just inserted.
          let membershipInsertionQuery = 'INSERT INTO GroupMembership (UserID, GroupID, Role) VALUES (?, ?, 2);';

          db.query(connection, membershipInsertionQuery, [req.session.UserID, firstResult.insertId], (result, fields) => {
            callback(null, inviteCode, firstResult, result);
          });
        },
      ],
      (error, inviteCode, firstResult, secondResult) => {
        res.status(200).json(
          JSON.stringify([
            {
              GroupID: firstResult.insertId,
            },
          ])
        );

        connection.release();
      }
    );
  });
});

app.get('/chat(.html)?', (req, res) => {
  if (req.session.LoggedIn) {
    // Only allow access to the chat page for logged-in users.
    res.sendFile(path.join(__dirname + '/../client/servable/chat.html'));
  } else {
    res.redirect('/');
  }
});

app.post('/api/GetMyGroups', (req, res, next) => {
  if (req.session.LoggedIn) {
    let servers = [];

    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      let sql = `
      SELECT GroupInfo.GroupID,
        GroupInfo.GroupName,
        MessageInfo.LatestMessageString,
        GroupInfo.Tag,
        GroupInfo.CustomColour
      FROM (SELECT \`Group\`.GroupID,
            \`Group\`.GroupName,
            GroupMembership.Tag,
            GroupMembership.CustomColour
            FROM \`Group\`
            JOIN GroupMembership
            ON \`Group\`.GroupID = GroupMembership.GroupID
            WHERE  GroupMembership.UserID = ?) AS GroupInfo
      LEFT JOIN (SELECT Message.MessageString AS LatestMessageString,
                        LatestMessage.GroupID,
                        LatestMessage.Timestamp
                 FROM Message
                 JOIN (SELECT GroupID, MAX(Timestamp) AS Timestamp
                      FROM Message
                      GROUP BY GroupID) AS LatestMessage
                      ON Message.GroupID = LatestMessage.GroupID
                      AND Message.Timestamp = LatestMessage.Timestamp
                      ORDER BY LatestMessage.Timestamp DESC) AS MessageInfo
      ON GroupInfo.GroupID = MessageInfo.GroupID
      ORDER BY MessageInfo.Timestamp DESC, GroupInfo.GroupName;
      `;

      db.query(connection, sql, req.session.UserID, (result, fields) => {
        res.json(JSON.stringify(result));

        connection.release();
      });
    });
  } else {
    next(); // Continue along routes, will serve a 404.
  }
});

app.post('/api/GetMyDisplayName', (req, res, next) => {
  if (req.session.LoggedIn) {
    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      let sql = 'SELECT DisplayName FROM User WHERE UserID = ?;';

      db.query(connection, sql, req.session.UserID, (result, fields) => {
        res.json(JSON.stringify(result));

        connection.release();
      });
    });
  } else {
    next(); // Continue along routes, will serve a 404.
  }
});

app.post('/api/GetMyUserID', (req, res, next) => {
  if (req.session.LoggedIn) {
    res.json(
      JSON.stringify([
        {
          UserID: req.session.UserID, // Return the user's ID.
        },
      ])
    );
  } else {
    next(); // Continue along routes, will serve a 404.
  }
});

app.post('/api/GetMessages', (req, res, next) => {
  if (req.session.LoggedIn && req.body.GroupID) {
    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      async.parallel(
        {
          adminStatus: function DetermineRole(callback) {
            let determineRoleQuery = 'SELECT Role FROM GroupMembership WHERE UserID = ? AND GroupID = ?;';

            db.query(connection, determineRoleQuery, [req.session.UserID, req.body.GroupID], (result, fields) => {
              callback(null, result[0].Role);
            });
          },
          messages: function GetMessageData(callback) {
            let getMessageDataQuery = `
            SELECT Message.MessageID,
              User.DisplayName AS AuthorDisplayName,
              Message.MessageString,
              Message.Timestamp,
              Message.AuthorID = ? AS Owned,
              Media.FileName
            FROM Message
            LEFT JOIN Media
              ON Message.MessageID = Media.ReferencesMessageID
            JOIN GroupMembership
              ON Message.GroupID = GroupMembership.GroupID
            JOIN User
              ON User.UserID = Message.AuthorID
            WHERE GroupMembership.UserID = ? AND GroupMembership.GroupID = ?
            ORDER BY Message.Timestamp;`;

            db.query(connection, getMessageDataQuery, [req.session.UserID, req.session.UserID, req.body.GroupID], (result, fields) => {
              callback(null, result);
            });
          },
        },
        (error, results) => {
          if (error) throw error;

          res.json(
            JSON.stringify({
              role: results.adminStatus, // Result of the first function.
              messageData: results.messages, // Result of the second function.
            })
          );

          connection.release();
        }
      );
    });
  } else {
    next(); // Continue along routes, will serve a 404.
  }
});

app.post('/api/GetFriendMessages', (req, res, next) => {
  if (req.session.LoggedIn && req.body.FriendshipID) {
    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      let getMessageDataQuery = `
      SELECT Message.MessageID,
        User.DisplayName AS AuthorDisplayName,
        Message.MessageString,
        Message.Timestamp,
        Message.AuthorID = ? AS Owned,
        Media.FileName
      FROM Message
      LEFT JOIN Media
        ON Message.MessageID = Media.ReferencesMessageID
      JOIN Friendship
        ON Message.FriendshipID = Friendship.FriendshipID
      INNER JOIN UserFriend
        ON Friendship.FriendshipID = UserFriend.FriendshipID
      JOIN User
        ON User.UserID = Message.AuthorID
      WHERE UserFriend.UserInFriendship = ? AND Friendship.FriendshipID = ?
      ORDER BY Message.Timestamp;`;

      db.query(connection, getMessageDataQuery, [req.session.UserID, req.session.UserID, req.body.FriendshipID], (result, fields) => {
        res.json(JSON.stringify(result));

        connection.release();
      });
    });
  } else {
    next(); // Continue along routes, will serve a 404.
  }
});

app.post('/api/GetPinnedMessage', (req, res, next) => {
  if (req.session.LoggedIn && req.body.GroupID) {
    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

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
        AND \`Group\`.GroupID = ?;`;

      db.query(connection, sql, [req.session.UserID, req.body.GroupID], (result, fields) => {
        res.json(JSON.stringify(result));

        connection.release();
      });
    });
  } else {
    next(); // Continue along routes, will serve a 404.
  }
});

app.post('/api/GetInviteCode', (req, res, next) => {
  if (req.session.LoggedIn && req.body.GroupID) {
    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      let sql = 'SELECT InviteCode FROM `Group` WHERE GroupID = ?;';

      db.query(connection, sql, req.body.GroupID, (result, fields) => {
        res.json(JSON.stringify(result));

        connection.release();
      });
    });
  } else {
    next(); // Continue along routes, will serve a 404.
  }
});

app.post('/api/GetGroupMemberList', (req, res, next) => {
  if (req.session.LoggedIn && req.body.GroupID) {
    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      let checkPermissibleRequest = 'SELECT COUNT(*) AS Matches FROM GroupMembership WHERE UserID = ? AND GroupID = ?;';

      db.query(connection, checkPermissibleRequest, [req.session.UserID, req.body.GroupID], (result, fields) => {
        if (result[0].Matches == 1) {
          let getMemberListQuery = `
          SELECT User.UserID,
            User.DisplayName,
            GroupMembership.Role,
            SecondDerivedTable.IsAFriend
          FROM GroupMembership
          JOIN User
            ON User.UserID = GroupMembership.UserID
          LEFT JOIN
            (SELECT UserInFriendship, COUNT(FirstDerivedTable.FriendshipID) > 0 AS IsAFriend
              FROM
                (SELECT FriendshipID FROM UserFriend WHERE UserInFriendship = ?) AS FirstDerivedTable
                JOIN UserFriend
                  ON UserFriend.FriendshipID = FirstDerivedTable.FriendshipID
                WHERE UserInFriendship != ?
              GROUP BY FirstDerivedTable.FriendshipID) AS SecondDerivedTable
            ON User.UserID = SecondDerivedTable.UserInFriendship
          WHERE GroupID = ?
          ORDER BY User.DisplayName;`;

          db.query(connection, getMemberListQuery, [req.session.UserID, req.session.UserID, req.body.GroupID], (result, fields) => {
            result.forEach((element) => (element.IsAFriend = element.UserID == req.session.UserID ? 1 : element.IsAFriend)); // Check each item and make sure the requested users is marked as a friend with themselves.

            res.json(JSON.stringify(result));
            connection.release();
          });
        }
      });
    });
  } else {
    next();
  }
});

app.get('/group-info', (req, res, next) => {
  if (req.session.LoggedIn && req.query.GroupID) {
    let checkMemberQuery = 'SELECT COUNT(*) AS Matches, Role FROM GroupMembership WHERE UserID = ? AND GroupID = ?;';

    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      db.query(connection, checkMemberQuery, [req.session.UserID, req.query.GroupID], (result, fields) => {
        connection.release();

        if (result[0].Matches == 1 && result[0].Role > 0) {
          res.status(200).sendFile(path.join(__dirname + '/../client/hidden/group-info.html'));
        } else {
          next(); // Continue along routes, will serve a 404.
        }
      });
    });
  } else {
    next(); // Continue along routes, will serve a 404.
  }
});

app.post('/api/GetGroupData', (req, res) => {
  if (req.session.LoggedIn && req.body.GroupID) {
    let checkMemberQuery = 'SELECT COUNT(*) AS Matches, Role FROM GroupMembership WHERE UserID = ? AND GroupID = ?;';

    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      db.query(connection, checkMemberQuery, [req.session.UserID, req.body.GroupID], (result, fields) => {
        if (result[0].Matches == 1) {
          async.parallel(
            {
              groupName: function GetGroupName(callback) {
                let getGroupNameQuery = 'SELECT GroupName FROM `Group` WHERE GroupID = ?;';
                db.query(connection, getGroupNameQuery, req.body.GroupID, (result, fields) => {
                  callback(null, result);
                });
              },
              members: function GetMemberData(callback) {
                let getMemberListQuery = 'SELECT User.UserID, User.DisplayName, GroupMembership.Role FROM GroupMembership JOIN User ON User.UserID = GroupMembership.UserID WHERE GroupMembership.GroupID = ? ORDER BY User.DisplayName;';
                db.query(connection, getMemberListQuery, req.body.GroupID, (result, fields) => {
                  callback(null, result);
                });
              },
              messages: function GetMessageData(callback) {
                // Get raw message statistics
                let getMessagesStatisticsQuery = 'SELECT COUNT(*) AS MessagesToday, DATE(FROM_UNIXTIME(Timestamp / 1000)) AS MessageBlockDay FROM Message WHERE GroupID = ? GROUP BY MessageBlockDay;';
                db.query(connection, getMessagesStatisticsQuery, req.body.GroupID, (result, fields) => {
                  callback(null, result);
                });
              },
            },
            (error, results) => {
              if (error) throw error;

              res.json(
                JSON.stringify({
                  groupName: results.groupName[0].GroupName, // Result of the first function.
                  members: results.members.map((obj, index) => ({
                    ...obj, // Don't affect the database return.
                    // Add the online data from the sockets
                    Online: chat.getClients(
                      results.members.map((element) => element.UserID),
                      req.body.GroupID,
                      req.session.UserID
                    )[index], // Reuse the same index because we preserved the order of elements.
                  })), // Result of the second function.
                  messages: results.messages, // Result of the third function.
                  currentServerDate: new Date().setHours(0, 0, 0, 0), // Ignore the time to compare by day.
                })
              );

              connection.release();
            }
          );
        } else {
          res.json(JSON.stringify({ status: 'invalid' }));
        }
      });
    });
  } else {
    res.json(JSON.stringify({ status: 'invalid' }));
  }
});

app.post('/api/GetMyFriends', (req, res, next) => {
  if (req.session.LoggedIn) {
    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      let getFriendsQuery = `
      SELECT MyFriendships.FriendshipID, User.DisplayName, MyFriendships.UserSentRequest AS SentRequest, Friendship.Status, LatestMessageInFriendship.LatestMessageString
      FROM
        (
          SELECT * FROM UserFriend
          WHERE UserInFriendship = ?) AS MyFriendships
          JOIN UserFriend
            ON MyFriendships.FriendshipID = UserFriend.FriendshipID
          JOIN Friendship
            ON MyFriendships.FriendshipID = Friendship.FriendshipID
          JOIN User
            ON UserFriend.UserInFriendship = User.UserID
          LEFT JOIN
            (
              SELECT Message.MessageString AS LatestMessageString, LatestMessage.FriendshipID, LatestMessage.Timestamp
              FROM Message
              JOIN (SELECT FriendshipID, MAX(Timestamp) AS Timestamp FROM Message GROUP BY FriendshipID) AS LatestMessage
                ON Message.FriendshipID = LatestMessage.FriendshipID AND Message.Timestamp = LatestMessage.Timestamp
            )
            AS LatestMessageInFriendship

            ON MyFriendships.FriendshipID = LatestMessageInFriendship.FriendshipID
        WHERE UserFriend.UserInFriendship != ?
        ORDER BY LatestMessageInFriendship.Timestamp, User.DisplayName;`;

      db.query(connection, getFriendsQuery, [req.session.UserID, req.session.UserID], (result, fields) => {
        res.json(
          JSON.stringify({
            // Status: null or 0 - pending,
            //                 1 - rejected,
            //                 2 - accepted and active.
            sentPending: result.filter((element) => element.SentRequest == true && !(element.Status > 0)), // Just get the elements where we sent the request and are still waiting for a reply.
            notSentPending: result.filter((element) => element.SentRequest != true && !(element.Status > 0)), // Just get the elements were we didn't sent the request and we need to accept or reject it.
            active: result.filter((element) => element.Status == 2), // Just get all of the active friendships.
          })
        );

        connection.release();
      });
    });
  } else {
    next(); // Continue along routes, will serve a 404.
  }
});

app.post('/api/SetTag', (req, res, next) => {
  if (req.session.LoggedIn && req.body.GroupID && req.body.tag && req.body.colour && req.body.tag.length <= 14 && req.body.colour.replace('#', '').length == 6) {
    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      // We will update the user's group membership.
      let updateTagInfoQuery = 'UPDATE GroupMembership SET Tag = ?, CustomColour = ? WHERE UserID = ? AND GroupID = ?;';

      db.query(connection, updateTagInfoQuery, [req.body.tag, req.body.colour.replace('#', ''), req.session.UserID, req.body.GroupID], (result, fields) => {
        res.status(200).json(JSON.stringify({
          GroupID: req.body.GroupID,
          Tag: req.body.tag,
          Colour: req.body.colour
        }));

        connection.release();
      });
    });
  } else {
    res.status(422).send(); // Continue along routes, will serve a 404.
  }
});

app.get('/user-file', (req, res, next) => {
  if (req.query.fileName) {
    if (fs.existsSync(path.join(__dirname, '../../user_files', req.query.fileName))) {
      // Serve the file from the random name.
      res.status(200).sendFile(path.join(__dirname, '../../user_files', req.query.fileName));
    } else {
      next();
    }
  } else {
    next();
  }
});

app.use(
  express.static('../client/servable', {
    extensions: ['html', 'htm'], // We can leave off the .html from a URL and the correct file will still be served.
  })
);

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname + '/../client/hidden/404.html'));
});

const httpServer = http.createServer(app).listen(defaultPort, () => {
  log.info('Node.js HTTP web server started on port ' + httpServer.address().port);
  chat.initialise(io); // Start the socket chat service.
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
