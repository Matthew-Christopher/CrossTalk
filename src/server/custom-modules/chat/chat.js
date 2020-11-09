const log = require('../logging');
let io = require('socket.io');

module.exports.initialise = (http) => {
  io = io(http);
  io.on('connection', (socket) => {
    log.info("User connected to the chat.");
    socket.on('disconnect', () => {
      log.info("User disconnected from the chat.");
    });

    socket.on('chat', (message) => {
      io.emit('message return', message);
      log.info(`Chat: ${message}`);
    });
  });
};
