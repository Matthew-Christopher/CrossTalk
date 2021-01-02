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
    log.info("User connected to the chat.");
    socket.on('disconnect', () => {
      log.info("User disconnected from the chat.");
    });

    socket.on('chat', (message) => {
      io.emit('message return', message);

      log.info(`Chat message in group ${message.GroupID} from user ${message.AuthorID} at time ${message.Timestamp}: "${message.MessageString}"`);

      pool.getConnection(async (err, connection) => {
        // Message object format: (MessageID, GroupID, AuthorID, MessageString, Timestamp)
    		var sql = 'INSERT INTO Message VALUES (?, ?, ?, ?, ?);';

    		connection.query(mysql.format(sql, [message.MessageID, message.GroupID, message.AuthorID, message.MessageString, message.Timestamp]), (error, result, fields) => {
          connection.release();

          if (error) throw error; // Handle post-release error.
    		});
    	});
    });
  });
};
