const argon2 = require('argon2');

module.exports.Hash = async (password) => {
  try {
    const hash = await argon2.hash(password);
    return hash;
  } catch (err) {

  }
};

module.exports.CompareHashes = async (hash, password) => {
  return argon2.verify(hash, password);
}
