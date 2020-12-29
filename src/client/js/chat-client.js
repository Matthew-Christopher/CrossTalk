$(window).on("load", () => {
  const socket = io();
  $("#message-form").submit((event) => {
    event.preventDefault(); // Don't refresh, we want a smooth experience.

    // We trim whitespace from the start and end of the message before sending it.
    let message = $('#message').val().trim();

    // Don't send the message if it's blank.
    if (message) {
      socket.emit('chat', message); // Send the message data from the input field.
    }

    $('#message').val(''); // Clear the message input so we can type again immediately.
    return;
  });

  $("#message-send-tick").click((event) => {
    // Refocus on the message box to enable rapid sending.
    $("#message").focus();
  })

  socket.on('message return', (message) => {
    $('#chatbox').append($('<li>').text(message));
  });
});
