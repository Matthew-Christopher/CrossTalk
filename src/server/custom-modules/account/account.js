const log = require('../logging');
const cryptography = require('../cryptography');

const mysql = require('mysql');

require('dotenv').config();

const pool = mysql.createPool({
  connectionLimit: process.env.DB_CONNECTIONLIMIT,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE
});

module.exports.LogIn = async (request, response) => {

  pool.getConnection(async (err, connection) => {
    if (err) throw err;

    var sql = "SELECT * FROM User WHERE EmailAddress = ?";

    connection.query(mysql.format(sql, request.body.email), async (error, res, fields) => {
      connection.release();

      if (error) throw error; // Handle post-release error.

      if (await cryptography.CompareHashes(res[0].PasswordHash, request.body.password)) {
        // Authenticated.
        log.info("Logged in.");
        request.session.LoggedIn = true;
        request.session.UserID = res[0].UserID;
        request.session.DisplayName = res[0].DisplayName;

        response.redirect("/chat");
      } else {
        // Incorrect credentials.
        log.info("Wrong details.");
      }
    });
  });
}
