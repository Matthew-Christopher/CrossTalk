const bcrypt = require('bcrypt');

module.exports.Hash = (password) => {
  return bcrypt.hashSync(password, 10);
};
