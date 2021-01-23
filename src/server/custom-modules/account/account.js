const log = require('../logging');
const cryptography = require('../cryptography');
const mailer = require('../mailer');

const mysql = require('mysql');

require('dotenv').config();

const pool = mysql.createPool({
  connectionLimit: process.env.DB_CONNECTIONLIMIT,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE
});

module.exports.Register = async (request, response) => {
  let hash = await cryptography.Hash(request.body.password);

  if ((request.body.email != request.body['confirm-email']) || !await cryptography.CompareHashes(hash, request.body['confirm-password'])) {
    response.status(105).send("Data entered was not valid.");
  } else {
    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      GetUserID(connection, (userId) => {
        let sql = "INSERT INTO User (UserID, DisplayName, EmailAddress, PasswordHash, Verified, VerificationKey) VALUES (?, ?, ?, ?, False, ?);";
        let inserts = [userId[0], request.body['display-name'], request.body.email, hash, userId[1]];

        connection.query(mysql.format(sql, inserts), (error, res, fields) => {
          connection.release();

          if (error) throw error; // Handle post-release error.

          mailer.SendVerification(request.body.email, userId[1]);
        });
      });
    });

    response.status(201).send("<p>A link has been sent to the provided email address. Please click it to verify your account, <u>checking also in your spam folder.</u></p><b>IMPORTANT NOTE: This project is part of my Computer Science A Level NEA. Please do not mistake this for an actual commericial service or product. You should not create an account if you have stumbled upon this website without being given permission to use or test it. Thank you.</b>");
  }
};

module.exports.Recover = (request, response) => {
  if (!request.body.email) {
    response.status(105).send("Data entered was not valid.");
  } else {
    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      GetRecoveryKey(connection, (recoveryKey) => {
        let sql = "UPDATE User SET RecoveryKey = ?, RecoveryKeyExpires = ? WHERE EmailAddress = ?;";

        let expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 24);

        connection.query(mysql.format(sql, [recoveryKey, expiryDate.valueOf(), request.body.email]), (error, res, fields) => {
          connection.release();

          if (error) throw error; // Handle post-release error.

          mailer.SendRecovery(request.body.email, recoveryKey);
        });
      });
    });

    response.status(201).send("<p>A link has been sent to the provided email address. Please click it to recover your password, <u>checking also in your spam folder.</u></p><b>IMPORTANT NOTE: This project is part of my Computer Science A Level NEA. Please do not mistake this for an actual commericial service or product. You should not create an account if you have stumbled upon this website without being given permission to use or test it. Thank you.</b>");
  }
};

module.exports.ChangePassword = async (request, response) => {
  let newHash = await cryptography.Hash(request.body.formData.newPassword);

  if (!await cryptography.CompareHashes(newHash, request.body.formData.confirmNewPassword)) {
    response.json(JSON.stringify({outcome: 'mismatch'}));
  } else {
    pool.getConnection(async (err, connection) => {
      if (err) throw err;

      let sql = "SELECT COUNT(*) AS NumberOfMatches FROM User WHERE (RecoveryKey = ? AND RecoveryKeyExpires > ?) OR UserID = ?;";

      connection.query(mysql.format(sql, [request.body.recoveryKey, new Date().getTime(), request.session.UserID]), (error, result, fields) => {
        if (error) throw error;

        if (result[0].NumberOfMatches != 1) {
          response.json(JSON.stringify({outcome: 'invalid'}));
        } else {
          sql = "UPDATE User SET PasswordHash = ?, RecoveryKey = NULL, RecoveryKeyExpires = NULL WHERE RecoveryKey = ? OR UserID = ?;";

          connection.query(mysql.format(sql, [newHash, request.body.recoveryKey, request.session.UserID]), (error, result, fields) => {
            if (error) throw error;

            response.json(JSON.stringify({outcome: 'change'}));
          });
        }

        connection.release();

        if (error) throw error; // Handle post-release error.
      });
    });
  }
};

module.exports.LogIn = async (request, response) => {

  pool.getConnection(async (err, connection) => {
    if (err) throw err;

    var sql = "SELECT * FROM User WHERE EmailAddress = ?";

    connection.query(mysql.format(sql, request.body.email), async (error, res, fields) => {
      connection.release();

      if (error) throw error; // Handle post-release error.

      if (await cryptography.CompareHashes(res[0].PasswordHash, request.body.password)) {
        // Authenticated.

        request.session.LoggedIn = true;
        request.session.UserID = res[0].UserID;
        request.session.DisplayName = res[0].DisplayName;
        request.session.save((err) => {
          // Let's wait until the session is all set before redirecting.
          // We need to save the session to the database store, this might take a bit of time.
          // If we redirect straight away then we might get sent back here by the chat page if the session isn't initialised.

          log.info("Logged in.");
          response.redirect('/chat');
        });
      } else {
        // Incorrect credentials.
        log.info("Wrong details.");
      }
    });
  });
}

module.exports.LogOut = async (request, response) => {
  request.session.destroy((err) => {
    response.redirect('/');
  });
}

function GetRecoveryKey(connection, callback) {
  let duplicates = 0;

  do {
    connection.query("SELECT LEFT(MD5(RAND()), 32) AS RecoveryKey;", (error, firstResult, fields) => {
      if (error) throw error;

      let recoveryKey = firstResult[0].RecoveryKey;

      connection.query(mysql.format("SELECT COUNT(*) AS NumberOfDuplicates FROM User WHERE RecoveryKey = ?;", recoveryKey), (error, secondResult, fields) => {

        if (error) throw error;

        duplicates = secondResult[0].NumberOfDuplicates;

        if (duplicates == 0) {
          return callback(recoveryKey); // Ensure callback is called after the async activity terminates, to prevent null errors.
        }
      });
    });

  } while (duplicates != 0);
}
