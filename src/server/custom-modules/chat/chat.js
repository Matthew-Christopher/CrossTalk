'use strict';

const log = require('../logging');
const db = require('../db');
let io;

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

module.exports.initialise = (instance) => {
  io = instance;

  io.sockets.on('connection', (socket) => {
    socket.on('join', (id) => {
      // Check the user is actually permitted to join first.
      pool.getConnection(async (err, connection) => {
        if (err) throw err; // Connection failed.

        db.query(connection, 'SELECT COUNT(*) AS Matches FROM GroupMembership WHERE UserID = ? AND GroupID = ?;', [socket.request.session.UserID, id], (result, fields) => {
          if (result[0].Matches == 1) {
            socket.join(id.toString());
          }

          connection.release();
        });
      });
    });

    socket.on('chat', (message) => {
      if (0 < message.MessageString.trim().length && message.MessageString.trim().length <= 2000) {
        pool.getConnection(async (err, connection) => {
          if (err) throw err; // Connection failed.

          async.parallel({
            getDisplayName: function(callback) {
              let getDisplayNameQuery = 'SELECT DisplayName FROM User WHERE UserID = ?;';

              db.query(connection, getDisplayNameQuery, socket.request.session.UserID, (result, fields) => {
                callback(null, result[0].DisplayName);
              });
            },
            insertMessage: function(callback) {
              let insertMessageQuery = 'INSERT INTO Message (GroupID, AuthorID, MessageString, Timestamp) VALUES (?, ?, ?, ?);';

              db.query(connection, insertMessageQuery, [message.GroupID, socket.request.session.UserID, message.MessageString, message.Timestamp], (result, fields) => {
                callback(null, result);
              });
            }
          }, (error, results) => {
            message.AuthorID = socket.request.session.UserID;
            message.AuthorDisplayName = results.getDisplayName;
            message.MessageID = results.insertMessage.insertId;

            io.sockets.in(message.GroupID.toString()).emit('message return', message);

            connection.release();
          });
        });
      }
    });

    socket.on('role change', (requestData) => {
      pool.getConnection(async (err, connection) => {
        if (err) throw err; // Connection failed.

        async.parallel({
          checkInGroup: function(callback) {
            let checkInGroupQuery = 'SELECT COUNT(*) AS Matches, Role FROM GroupMembership WHERE UserID = ? AND GroupID = ?;';

            db.query(connection, checkInGroupQuery, [socket.request.session.UserID, requestData.GroupID], (result, fields) => {
              callback(null, result[0].Matches, result[0].Role);
            });
          },
          actingOnRole: function(callback) {
            let confirmAuthorityQuery = 'SELECT Role FROM GroupMembership WHERE UserID = ? AND GroupID = ?;';

            db.query(connection, confirmAuthorityQuery, [requestData.UserToChange, requestData.GroupID], (result, fields) => {
              callback(null, result[0].Role);
            });
          }
        }, (error, results) => {
          if (results.checkInGroup[0] == 1 && results.checkInGroup[1] > results.actingOnRole && results.checkInGroup[1] > (requestData.TargetRole == 'admin' ? 1 : null)) {
            // Operation is permitted, update the user's role.
            let updateRoleQuery = 'UPDATE GroupMembership SET Role = ? WHERE UserID = ? AND GroupID = ?;';

            db.query(connection, updateRoleQuery, [requestData.TargetRole == 'admin' ? 1 : null, requestData.UserToChange, requestData.GroupID], (result, fields) => {
              io.sockets.in(requestData.GroupID.toString()).emit('role update', {
                InGroup: requestData.GroupID,
                AffectsUser: requestData.UserToChange,
                NewRole: requestData.TargetRole == 'admin' ? 1 : null
              });
            });
          }

          connection.release();
        });
      });
    });

    socket.on('message delete', (messageID) => {
      if (socket.request.session.LoggedIn && messageID) {
        pool.getConnection(async (err, connection) => {
          if (err) throw err; // Connection failed.

          let checkValidQuery = 'SELECT COUNT(*) AS Matches, Message.GroupID FROM Message JOIN GroupMembership ON Message.GroupID = GroupMembership.GroupID WHERE (Message.AuthorID = GroupMembership.UserID OR GroupMembership.Role > 0) AND Message.MessageID = ? AND GroupMembership.UserID = ?;';

          db.query(connection, checkValidQuery, [messageID, socket.request.session.UserID], (firstResult, fields) => {
            if (firstResult[0].Matches == 1) {
              async.parallel({
                secondResult: function(callback) { // Wipe the message from the database.
                  let deleteQuery = "DELETE FROM Message WHERE MessageID = ?;";

                  db.query(connection, deleteQuery, messageID, (result, fields) => {
                    callback(null, result);
                  });
                },
                thirdResult: function(callback) {
                  let getRecentMessageQuery = 'SELECT Message.MessageString AS LatestMessageString FROM Message WHERE Message.GroupID = ? ORDER BY Timestamp DESC LIMIT 1;'; // Get the message that is now the most recent in the group.

                  db.query(connection, getRecentMessageQuery, firstResult[0].GroupID, (result, fields) => {
                    callback(null, result);
                  });
                }
              }, (error, results) => {
                io.sockets.in(firstResult[0].GroupID.toString()).emit('binned', { // Send out the information to clients so they can remove the message.
                  group: firstResult[0].GroupID,
                  message: messageID,
                  newLatestMessage: results.thirdResult[0].LatestMessageString
                });
              });
            }

            connection.release();
          });
        });
      }
    });

    socket.on('message pin', (messageID) => {
      if (socket.request.session.LoggedIn && messageID) {
        pool.getConnection(async (err, connection) => {
          if (err) throw err; // Connection failed.

          let checkValidQuery = 'SELECT COUNT(*) AS Matches FROM Message JOIN GroupMembership ON Message.GroupID = GroupMembership.GroupID WHERE GroupMembership.Role > 0 AND Message.MessageID = ? AND GroupMembership.UserID = ?;';

          db.query(connection, checkValidQuery, [messageID, socket.request.session.UserID], (result, fields) => {
            if (result[0].Matches == 1) {
              async.waterfall([
                function(callback) {
                  let getGroupQuery = "SELECT GroupID FROM Message WHERE MessageID = ?;";

                  db.query(connection, getGroupQuery, messageID, (result, fields) => {
                    callback(null, result[0].GroupID);
                  });
                },
                function(groupIDToUpdate, callback) {
                  let updateGroupQuery = 'UPDATE \`Group\` SET PinnedMessageID = ? WHERE GroupID = ?;';

                  db.query(connection, updateGroupQuery, [messageID, groupIDToUpdate], (result, fields) => {
                    callback(null, groupIDToUpdate);
                  });
                }
              ], (error, groupIDToUpdate) => {
                io.sockets.in(groupIDToUpdate.toString()).emit('pinned', groupIDToUpdate);
              });
            }

            connection.release();
          });
        });
      }
    });

    socket.on('message unpin', (groupID) => {
      if (socket.request.session.LoggedIn && groupID) {
        pool.getConnection(async (err, connection) => {
          if (err) throw err; // Connection failed.

          let checkValidQuery = 'SELECT COUNT(*) AS Matches, \`Group\`.GroupID, \`Group\`.PinnedMessageID AS MessageID FROM \`Group\` JOIN GroupMembership ON \`Group\`.GroupID = GroupMembership.GroupID WHERE GroupMembership.Role > 0 AND \`Group\`.GroupID = ? AND GroupMembership.UserID = ?;';
          db.query(connection, checkValidQuery, [groupID, socket.request.session.UserID], (result, fields) => {
            if (result[0].Matches == 1) {
              let groupIDToUpdate = result[0].GroupID;
              let unpinnedMessageID = result[0].MessageID;

              let updateQuery = 'UPDATE \`Group\` SET PinnedMessageID = NULL WHERE GroupID = ?;';
              db.query(connection, updateQuery, groupIDToUpdate, (result, fields) => {

                io.sockets.in(groupIDToUpdate.toString()).emit('unpinned', { group: groupIDToUpdate, message: unpinnedMessageID });
              });
            }

            connection.release();
          });
        });
      }
    });
  });

  module.exports.getClients = function getClients(allUserIDs, groupID, requestingUserID) {
    let currentRoom = io.sockets.adapter.rooms.get(groupID);
    if (currentRoom) var clientSocketIDArray = Array.from(currentRoom); // Socket IDs for open connections in the group room.
    let connectedClientIDs = []; // User IDs from connected sockets.

    let result = []; // List of all UserIDs and whether or not they are connected.

    if (clientSocketIDArray) {
      for (let i = 0; i < clientSocketIDArray.length; ++i) {
        connectedClientIDs.push(io.sockets.sockets.get(clientSocketIDArray[i]).request.session.UserID);
      }
    }

    for (let i = 0; i < allUserIDs.length; ++i) {
      let currentIDToCheck = allUserIDs[i];

      result.push(
        currentIDToCheck == requestingUserID ? true // Ensure the user that is making the request is always marked as online, as they may not have the chat window open in the background.
        : connectedClientIDs.includes(currentIDToCheck));
    }

    return result;
  };
};
