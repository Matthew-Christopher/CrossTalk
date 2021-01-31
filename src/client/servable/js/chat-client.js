let activeServerID;

function SetActiveServerID(id) {
  activeServerID = id;

  $('.requires-group-selection').show();

  $('#message').focus();

  $.ajax({
    type: "POST",
    url: "/api/GetMessages",
    data:  {
      GroupID: activeServerID
    },
    success: (data) => {

      $('#chatbox').empty();

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
        $('#chatbox').append($('<li style="position: relative;">').append($('<p class="message-content" style="display: inline;">').text(item.MessageString)).append($('<i class="message-timestamp" style="color: #888; position: absolute; right: 0;">').text(GetMessageTimestamp(item.Timestamp))));
      });

      $('#chatbox').scrollTop($('#chatbox')[0].scrollHeight); // View the most recent messages.
    },
    failure: () => {
      console.log("Could not retreive messages. Try again later.");
    }
  });

  CheckPinnedMessage();
}

function CheckPinnedMessage() {
  $.ajax({
    type: "POST",
    url: "/api/GetPinnedMessage",
    data:  {
      GroupID: activeServerID
    },
    success: (data) => {

      let JSONData = $.parseJSON(data);

      if (JSONData.length > 0) {
        $('#pinned-message-container').show();

        $('#pinned-message-label').text('Pinned message from ' + JSONData[0].AuthorDisplayName + ', sent ' + GetPinnedMessageTimestamp(JSONData[0].Timestamp));
        $('#pinned-message-text').text(JSONData[0].MessageString);
      } else {
        $('#pinned-message-container').hide();

        $('#pinned-message-label').text();
        $('#pinned-message-text').text();
      }
    },
    failure: () => {
      console.log("Could not retreive messages. Try again later.");
    }
  });
}

$(window).on("load", () => {

  // Get the user's display name from their session cookie and the database.
  $.ajax({
    type: "POST",
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

    // We trim whitespace from the start and end of the message before sending it.
    let messageString = $('#message').val().trim();

    if (0 < messageString.length && messageString.length <= 2000) {
      let userID;
      if (activeServerID) {
        $.ajax({
          type: "POST",
          url: "/api/GetMyUserID",
          success: (data) => {
            JSONData = $.parseJSON(data);

            userID = JSONData[0].UserID;

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
    $('input[name="group"]').focus();

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
      $('#chatbox-reminder').hide();
      $('#invite-prompt').hide();

      let scrollOffset = $('#chatbox')[0].scrollHeight - $('#chatbox').scrollTop() - $('#chatbox').innerHeight();

      $('#chatbox').append($('<li style="position: relative;">').append($('<p class="message-content" style="display: inline;">').text(message.MessageString)).append($('<i class="message-timestamp" style="color: #888; position: absolute; right: 0;">').text(GetMessageTimestamp(message.Timestamp))));
      $('#server-selector .server-button.active-button .server-info-container i').text(message.MessageString);

      StickScroll(scrollOffset);
    }
  });

  $('#search').on('input', () => {
    if ($('#search').val()) {
      $('#server-name-display').attr('data-before', 'Search in ');
    } else {
      $('#server-name-display').attr('data-before', '');
    }

    let search = $('#search').val().toLowerCase();

    let listItems = $('#chatbox li p.message-content');
    let nothingFound = true;

    let scrollOffsetBeforeFilter = $('#chatbox')[0].scrollHeight - $('#chatbox').scrollTop() - $('#chatbox').innerHeight();

    for (let i = 0; i < listItems.length; i++) {
      if (listItems[i].innerHTML.toLowerCase().indexOf(search) > -1) {
        nothingFound = false;
        listItems[i].parentElement.style.display = "list-item";
      } else {
        listItems[i].parentElement.style.display = "none";
      }
    }

    StickScroll(scrollOffsetBeforeFilter);

    if (nothingFound) {
      $('#chatbox-reminder').css('display', 'block').text('No messages found');
    } else {
      $('#chatbox-reminder').css('display', 'none');
    }
  });
});

function CloseCreateForm() {
  $('#message').focus();

  $('#group-create').removeClass('active-button');

  $('#group-create-container').fadeOut(200); // Take 200ms to fade.
  $('body *:not(.blur-exclude)').css('-webkit-filter', '');
}

function GetMessageTimestamp(timestamp) {
  let date = new Date(eval(timestamp));
  let today = new Date();

  if (date.getDate() == today.getDate()) {
    // The message was sent today, so we'll just say the time.
    return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  } else if (date.getDate() == today.getDate() - 1) {
    // The date is yesterday.
    return 'Yesterday';
  } else {
    // The message was before yesterday, so just say the day.
    return date.toLocaleDateString();
  }
}

function GetPinnedMessageTimestamp(timestamp) {
  // A more contextualised timestamp function for the pinned message box.

  let date = new Date(eval(timestamp));
  let today = new Date();

  let atTimeString = 'today at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  if (date.getDate() == today.getDate()) {
    // The message was sent today, so we'll just say the time.
    return atTimeString;
  } else if (date.getDate() == today.getDate() - 1) {
    // The date is yesterday.
    return 'yesterday ' + atTimeString;
  } else {
    // The message was before yesterday, so just say the day.
    return 'on ' + date.toLocaleDateString() + atTimeString;
  }
}

function StickScroll(scrollOffset) {
  const pixelsStickScrollThreshold = 150;

  if (scrollOffset <= pixelsStickScrollThreshold) {
    $('#chatbox').scrollTop($('#chatbox')[0].scrollHeight); // View the most recent message, but only if we haven't already scrolled up to view something older (outside of a certain threshold).
  }
}