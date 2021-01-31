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

module.exports.initialise = (http) => {
  io = io(http);
  io.on('connection', (socket) => {

    socket.on('chat', (message) => {
      if (message.MessageString.trim().length > 0) {
        io.emit('message return', message);

        pool.getConnection(async (err, connection) => {

          // Message object format: (MessageID, GroupID, AuthorID, MessageString, Timestamp)
          var sql = 'INSERT INTO Message (GroupID, AuthorID, MessageString, Timestamp) VALUES (?, ?, ?, ?);';

          connection.query(mysql.format(sql, [message.GroupID, message.AuthorID, message.MessageString, message.Timestamp]), (error, result, fields) => {
            connection.release();

            if (error) throw error; // Handle post-release error.
          });
        });
      }
    });
  });
};
