let activeServerID;

function SetActiveServerID(id) {
  activeServerID = id;

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
      let JSONData = $.parseJSON(data);

      if (JSONData.length > 0) {
        $('#chatbox-reminder').hide();
        $('#invite-prompt').hide();
      } else {
        $('#chatbox-reminder').show();
        $('#invite-prompt').show();
        $('#chatbox-reminder').text('No messages yet');
      }

      $.parseJSON(data).forEach((item, i) => {
        $('#chatbox').append($('<li>').text(item.MessageString));
      });

      $('#chatbox').scrollTop($('#chatbox')[0].scrollHeight); // View the most recent messages.
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
      $('#name-display').text($.parseJSON(data)[0].DisplayName);
      $('#profile-options-name-label').text($.parseJSON(data)[0].DisplayName);
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

          $('#chatbox').scrollTop($('#chatbox')[0].scrollHeight); // Move to the most recent message if the client sent it themselves, independent of the current scroll position.
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
      $('#server-container #group-join-form').css('display', 'none');
    } else {
      $('#group-join').addClass('active-button');
      $('#server-container #group-join-form').css('display', 'block');
      $('#group-join-code').focus();
    }
  });

  $('#group-create').click(() => {
    $('#group-create').addClass('active-button');

    $('#group-create-container').fadeIn(200); // Take 200ms to fade.
    $('body *:not(.blur-exclude):not(.blur-exclude *)').css('-webkit-filter', 'blur(3px)');

    if($('#group-join').hasClass('active-button')) {
      $('#group-join').removeClass('active-button');
      $('#server-container #group-join-form').css('display', 'none');
    }
  });

  $(document).click((event) => {
    // Handle click events. We should hide the nav container if it's visible and we click outside of it.

    if ($('#group-create-container').css('display') == 'block' && $('#group-create-container').css('opacity') == 1 && !$(event.target).is('#group-create-form-container') && !$(event.target).is('#group-create-form-container *') && !$(event.target).is('#group-create-close-button') ) {
      CloseCreateForm();
    }
  });

  $('#group-create-close-button').click(() => {
    CloseCreateForm();
  })

  socket.on('message return', (message) => {
    // Only render the message if we are on its group.
    if (message.GroupID === activeServerID) {
      $('#chatbox').append($('<li>').text(message.MessageString));
      $('#server-selector .server-button.active-button .server-info-container i').text(message.MessageString);

      const pixelsStickScrollThreshold = 150;

      if ($('#chatbox')[0].scrollHeight - $('#chatbox').scrollTop() - $('#chatbox').innerHeight() <= pixelsStickScrollThreshold) {
        $('#chatbox').scrollTop($('#chatbox')[0].scrollHeight); // View the most recent message, but only if we haven't already scrolled up to view something older (outside of a certain threshold).
      }
    }
  });
});

function CloseCreateForm() {
  $('#group-create').removeClass('active-button');

  $('#group-create-container').fadeOut(200); // Take 200ms to fade.
  $('body *:not(.blur-exclude)').css('-webkit-filter', '');
}
