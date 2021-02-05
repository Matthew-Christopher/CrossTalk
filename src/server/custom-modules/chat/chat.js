'use strict';

const log = require('../logging');
const db = require('../db');
let io = require('socket.io');

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
        db.query(connection, 'SELECT COUNT(*) AS Matches FROM GroupMembership WHERE UserID = ? AND GroupID = ?;', [socket.request.session.UserID, id], (result, fields) => {
          if (result[0].Matches == 1) {
            socket.join(id);
          }

          connection.release();
        });
      });
    });

    socket.on('chat', (message) => {
      if (0 < message.MessageString.trim().length && message.MessageString.trim().length <= 2000) {
        pool.getConnection(async (err, connection) => {

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
            message.AuthorDisplayName = results.getDisplayName;
            message.MessageID = results.insertMessage.insertId;

            io.sockets.in(message.GroupID).emit('message return', message);

            connection.release();
          });
        });
      }
    });

    module.exports.bin = (groupID, messageID, newMessageString) => {
      io.sockets.in(groupID).emit('binned', { group: groupID, message: messageID, newLatestMessage: newMessageString });
    };

    module.exports.pin = (groupID) => {
      io.sockets.in(groupID).emit('pinned', groupID);
    };

    module.exports.unpin = (groupID, messageID) => {
      io.sockets.in(groupID).emit('unpinned', { group: groupID, message: messageID });
    };
  });
};
