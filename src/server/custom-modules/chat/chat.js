const log = require('../logging');

module.exports.initialise = (http) => {
 const io = require('socket.io')(http, () => {
   io.on(connection, (socket) => {
     log.info("User connected to the chat.");
     socket.on(disconnect, () => {
       log.info("User disconnected from the chat.");
     });

     socket.on('chat', (message) => {
       io.emit('message return', message);
     });
   });
 });
};
