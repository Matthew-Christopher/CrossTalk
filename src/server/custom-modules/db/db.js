const mysql = require('mysql');

module.exports.query = (connection, query, inserts, callback) => {
  connection.query(mysql.format(query, inserts), (error, result, fields) => {
    if (error) throw error;

    return callback(result, fields);
  });
};
