const argon2 = require('argon2');

module.exports.Hash = async (password) => {
  try {
    const hash = await argon2.hash(password);
    return hash;
  } catch (err) {

  }
};
