let activeServerID;

function SetActiveServerID(id) {
  activeServerID = id;

  // Hide the server selection reminder once one has been picked.
  $('#select-group-reminder').hide();

  $('.requires-group-selection').show();

  $('#message').focus();

  $('#chatbox').empty();

  $.ajax({
    type: "GET",
    url: "/api/GetMessages",
    data:  {
      GroupID: activeServerID
    },
    success: (data) => {
      JSONData = $.parseJSON(data);

      JSONData.forEach((item, i) => {
        $('#chatbox').append($('<li>').text(item.MessageString));
      });
    },
    failure: () => {
      console.log("Could not retreive messages. Try again later.");
    }
  });
}

$(window).on("load", () => {

  // Get the user's display name from their session cookie and the database.
  $.ajax({
    type: "GET",
    url: "/api/GetMyDisplayName",
    success: (data) => {
      JSONData = $.parseJSON(data);

      $('#name-display').text(JSONData[0].DisplayName);
    },
    failure: () => {
      console.log("Could not retreive display name. Try again later.");
    }
  });

  const socket = io();
  $("#message-form").submit((event) => {
    event.preventDefault(); // Don't refresh, we want a smooth experience.

    let userID;
    if (activeServerID) {
      $.ajax({
        type: "GET",
        url: "/api/GetMyUserID",
        success: (data) => {
          JSONData = $.parseJSON(data);

          userID = JSONData[0].UserID;

          // We trim whitespace from the start and end of the message before sending it.
          let messageString = $('#message').val().trim();

          // Message object format: (MessageID, GroupID, AuthorID, MessageString, Timestamp)
          let message = new Message(null, activeServerID, userID, messageString, Date.now());

          // Don't send the message if it's blank.
          if (message) {
            socket.emit('chat', message); // Send the message data from the input field.
          }

          $('#message').val(''); // Clear the message input so we can type again immediately.
        },
        failure: () => {
          console.log("Could not retreive display name. Try again later.");
        }
      });
    }
  });

  $('#message-send-tick').click(() => {
    // Refocus on the message box to enable rapid sending.
    $('#message').focus();
  });

  $('#group-join').click(() => {
    let isActive = $('#group-join').hasClass('active-button');

    if (isActive) {
      $('#group-join').removeClass('active-button');
    } else {
      $('#group-join').addClass('active-button');
    }

    $('#server-container #group-join-form').css('display', $('#server-container #group-join-form').css('display') == 'block' ? 'none' : 'block');
  });

  $('#group-join-form').submit((e) => {
    e.preventDefault();

    $.ajax({
      type: "POST",
      url: "/api/JoinGroup",
      data: $('#group-join-form').serialize(),
      success: () => {
        alert("Added to group.");
      },
      failure: () => {
        alert("Could not recognise the invite code. Check it and try again.");
      }
    });
  });

  socket.on('message return', (message) => {
    // Only render the message if we are on its group.
    if (message.GroupID === activeServerID) {
      $('#chatbox').append($('<li>').text(message.MessageString));
    }
  });
});
