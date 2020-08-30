const log = require('../logging');

module.exports.LogIn = (email, password) => {
  log.info("Login request received.");
  log.info(`Email: ${email}`);
  log.info(`Password: ${password}`);
};
