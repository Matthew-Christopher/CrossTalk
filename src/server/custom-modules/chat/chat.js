'use strict';

const log = require('../logging');
let io = require('socket.io');

require('dotenv').config();
const mysql = require('mysql');

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

    socket.on('chat', (message) => {
      if (0 < message.MessageString.trim().length && message.MessageString.trim().length <= 2000) {
        pool.getConnection(async (err, connection) => {

          connection.query(mysql.format('SELECT DisplayName FROM User WHERE UserID = ?;', socket.request.session.UserID), (error, result, fields) => {
            message.AuthorDisplayName = result[0].DisplayName;
            message.AuthorID = socket.request.session.UserID;
            io.emit('message return', message);

            // Message object format: (MessageID, GroupID, AuthorID, MessageString, Timestamp)
            var sql = 'INSERT INTO Message (GroupID, AuthorID, MessageString, Timestamp) VALUES (?, ?, ?, ?);';

            connection.query(mysql.format(sql, [message.GroupID, socket.request.session.UserID, message.MessageString, message.Timestamp]), (error, result, fields) => {
              connection.release();

              if (error) throw error; // Handle post-release error.
            });
          });
        });
      }
    });
  });
};
