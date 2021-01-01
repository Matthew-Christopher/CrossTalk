let activeServerID;

function SetActiveServerID(id) {
  activeServerID = id;

  // Hide the server selection reminder once one has been picked.
  $("#select-group-reminder").hide();
}

$(window).on("load", () => {

  // Get the user's display name from their session cookie and the database.
  $.ajax({
    type: "GET",
    url: "/api/GetMyDisplayName",
    success: (data) => {
      JSONData = $.parseJSON(data);

      $('#name-display').text("Welcome, " + JSONData[0].DisplayName);
    },
    failure: () => {
      console.log("Could not retreive display name. Try again later.");
    }
  });

  const socket = io();
  $("#message-form").submit((event) => {
    event.preventDefault(); // Don't refresh, we want a smooth experience.

    if (activeServerID) {
      // We trim whitespace from the start and end of the message before sending it.
      let messageString = $('#message').val().trim();

      // Message object format: (groupID, authorID, messageID, messageString, timestamp)
      let message = new Message(activeServerID, "NOT IMPLEMENTED YET", "NOT IMPLEMENTED YET", messageString, Date.now());

      // Don't send the message if it's blank.
      if (message) {
        socket.emit('chat', message); // Send the message data from the input field.
      }

      $('#message').val(''); // Clear the message input so we can type again immediately.
      return;
    }
  });

  $("#message-send-tick").click((event) => {
    // Refocus on the message box to enable rapid sending.
    $("#message").focus();
  })

  socket.on('message return', (message) => {
    // Only render the message if we are on its group.
    if (message.groupID === activeServerID) {
      $('#chatbox').append($('<li>').text(message.messageString));
    }
  });
});
