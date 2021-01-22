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
      if (message.MessageString.trim().length > 0) {
        io.emit('message return', message);

        log.info(`Chat message in group ${message.GroupID} from user ${message.AuthorID} at time ${message.Timestamp}: "${message.MessageString}"`);

        pool.getConnection(async (err, connection) => {
          // Message object format: (MessageID, GroupID, AuthorID, MessageString, Timestamp)
          var sql = 'INSERT INTO Message VALUES (?, ?, ?, ?, ?);';

          GetMessageID(connection, (messageID) => {
            connection.query(mysql.format(sql, [messageID, message.GroupID, message.AuthorID, message.MessageString, message.Timestamp]), (error, result, fields) => {
              connection.release();

              if (error) throw error; // Handle post-release error.
            });
          });
        });
      }
    });
  });
};

function GetMessageID(connection, callback) {
  do {

    var numOfDuplicates = 0;

    connection.query("SELECT UUID() AS MessageID;", (error, firstResult, fields) => {
      if (error) throw error;

      let candidateID = firstResult[0].MessageID;

      connection.query(mysql.format("SELECT COUNT(*) AS NumberOfDuplicates FROM Message WHERE MessageID = ?;", candidateID), (error, secondResult, fields) => {

        if (error) throw error;

        numOfDuplicates = secondResult[0].NumberOfDuplicates;

        if (numOfDuplicates == 0) {
          return callback(candidateID); // Ensure callback is called after the async activity terminates, to prevent null errors.
        }
      });
    });

  } while (numOfDuplicates != 0);
}
