'use strict';

const log = require('../logging');
const cryptography = require('../cryptography');
const mailer = require('../mailer');
const db = require('../db');

const mysql = require('mysql');
const async = require('async');

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
  const emailCheckRegex = new RegExp('/^[a-z0-9!#$%&\'*+\\/=?^_`{|}~.-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/iD'); // (Regex DB, n.d.)

  if (!!request.body['display-name'].trim() || !emailCheckRegex.test(request.body.email) || !request.body.password.trim() || (request.body.email != request.body['confirm-email']) || !await cryptography.CompareHashes(hash, request.body['confirm-password'])) {
    response.send("fail");
  } else {
    pool.getConnection(async (err, connection) => {
      if (err) throw err; // Connection failed.

      let getQuery = `
      SELECT *
      FROM   (SELECT Count(*) AS DisplayNameDuplicates
        FROM   User
        WHERE  LOWER(DisplayName) = LOWER(?)) AS T1
        LEFT JOIN (SELECT Count(*) AS EmailDuplicates
          FROM   User
          WHERE  LOWER(EmailAddress) = LOWER(?)) AS T2
              ON true;`;

      db.query(connection, getQuery, [request.body['display-name'], request.body.email], (result, fields) => {
        if (result[0].DisplayNameDuplicates > 0) {
          response.send('display');
        } else if (result[0].EmailDuplicates > 0) {
          response.send('email');
        } else if (request.body.password.length < 8) {
          response.send('password');
        } else {
          GetUserID(connection, (verificationKey) => {
            sql = 'INSERT INTO User (DisplayName, EmailAddress, PasswordHash, Verified, VerificationKey) VALUES (?, ?, ?, False, ?);';
            let inserts = [request.body['display-name'], request.body.email, hash, verificationKey];

            db.query(connection, sql, inserts, (result, fields) => {
              mailer.SendVerification(request.body.email, verificationKey);
            });
          });

          response.status(201).send("success");
        }
      });

      connection.release();
    });
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

        db.query(connection, sql, [recoveryKey, expiryDate.valueOf(), request.body.email], (result, fields) => {

          if (result.affectedRows) {
            mailer.SendRecovery(request.body.email, recoveryKey);
          }
        });

        connection.release();
      });
    });

    response.status(201).send("success");
  }
};

module.exports.ChangePassword = async (request, response) => {
  let newHash = await cryptography.Hash(request.body.formData.newPassword);

  if (!await cryptography.CompareHashes(newHash, request.body.formData.confirmNewPassword)) {
    response.json(JSON.stringify({
      outcome: 'mismatch'
    }));
  } else {
    pool.getConnection(async (err, connection) => {
      if (err) throw err;

      let checkValidQuery = "SELECT COUNT(*) AS NumberOfMatches FROM User WHERE (RecoveryKey = ? AND RecoveryKeyExpires > ?) OR UserID = ?;";

      db.query(connection, checkValidQuery, [request.body.recoveryKey, new Date().getTime(), request.session.UserID], (result, fields) => {
        if (result[0].NumberOfMatches != 1) {
          response.status(422).sendFile(path.join(__dirname + '/../client/hidden/invalid-recovery-key.html'));
        } else {
          async.parallel({
            nameAndEmail: function(callback) {
              let getDisplayNameAndEmailQuery = 'SELECT DisplayName, EmailAddress FROM User WHERE RecoveryKey = ? OR UserID = ?';

              db.query(connection, getDisplayNameAndEmailQuery, [request.body.recoveryKey, request.session.UserID], (result, fields) => {
                callback(null, result);
              });
            },
            updatePassword: function(callback) {
              let updatePasswordQuery = 'UPDATE User SET PasswordHash = ?, RecoveryKey = NULL, RecoveryKeyExpires = NULL WHERE RecoveryKey = ? OR UserID = ?;';

              db.query(connection, updatePasswordQuery, [newHash, request.body.recoveryKey, request.session.UserID], (result, fields) => {
                callback(null, result);
              });
            }
          }, (error, results) => {
            mailer.SendChangeNotification(results.nameAndEmail[0].DisplayName, results.nameAndEmail[0].EmailAddress);

            response.json(JSON.stringify({
              outcome: 'change'
            }));
          });
        }

        connection.release();
      });
    });
  }
};

module.exports.LogIn = async (request, response) => {

  pool.getConnection(async (err, connection) => {
    if (err) throw err;

    var sql = "SELECT * FROM User WHERE EmailAddress = ?";

    db.query(connection, sql, request.body.email, async (res, fields) => {
      if (res.length > 0 && await cryptography.CompareHashes(res[0].PasswordHash, request.body.password) && res[0].Verified) {
        // Authenticated.

        request.session.LoggedIn = true;
        request.session.UserID = res[0].UserID;
        request.session.DisplayName = res[0].DisplayName;
        request.session.save((err) => {
          // Let's wait until the session is all set before redirecting.
          // We need to save the session to the database store, this might take a bit of time.
          // If we redirect straight away then we might get sent back here by the chat page if the session isn't initialised.

          response.status(201).send("success");
        });
      } else if (res[0] && !res[0].Verified) {
        response.send("unverified");
      } else {
        // Incorrect credentials.
        response.send("fail");
      }

      connection.release();
    });
  });
};

module.exports.LogOut = async (request, response) => {
  request.session.destroy((err) => {
    response.redirect('/');
  });
};

function GetRecoveryKey(connection, callback) {
  let duplicates = 0;

  do {
    let recoveryKey = require('crypto').randomBytes(16).toString('hex');

    db.query(connection, 'SELECT COUNT(*) AS NumberOfDuplicates FROM User WHERE RecoveryKey = ?;', recoveryKey, (result, fields) => {

      duplicates = result[0].NumberOfDuplicates;

      if (duplicates == 0) {
        return callback(recoveryKey); // Ensure callback is called after the async activity terminates, to prevent null errors.
      }
    });

  } while (duplicates != 0);
}

function GetUserID(connection, callback) {

  let duplicates = 0;
  let candidateID = require('crypto').randomBytes(16).toString('hex');

  do {

    db.query(connection, 'SELECT COUNT(*) AS NumberOfDuplicates FROM User WHERE VerificationKey = ?;', candidateID, (result, fields) => {
      duplicates = result[0].NumberOfDuplicates;

      if (duplicates == 0) {
        return callback(candidateID); // Ensure callback is called after the async activity terminates, to prevent null errors.
      }
    });
  } while (duplicates != 0);
}
