$(window).on("load", () => {
  const socket = io();
  $("#message-form input").submit((event) => {
    e.preventDefault(); // Don't refresh, we want a smooth experience.
    socket.emit('chat', $('#message').val()); // Send the message data from the input field.
    $('#message').val(''); // Clear the message input so we can type again immediately.
    return;
  });

  socket.on('message return', (message) => {
    $('#chatbox').append($('<li>').text(message));
  });
});
