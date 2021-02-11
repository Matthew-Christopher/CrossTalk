let activeServerID, role, id;
const socket = io.connect('/');

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
      console.error("Could not retreive display name. Try again later.");
    }
  });

  SetUserID();

  $("#message-form").submit((event) => {
    event.preventDefault(); // Don't refresh, we want a smooth experience.

    // We trim whitespace from the start and end of the message before sending it.
    let messageString = $('#message').val().trim();

    if (0 < messageString.length && messageString.length <= 2000) {
      let userID;
      if (activeServerID) {
        // Message object format: (MessageID, GroupID, AuthorID, AuthorDisplayName, MessageString, Timestamp)
        let message = new Message(null, activeServerID, null, null, messageString, Date.now());

        // Don't send the message if it's blank.
        if (message) {
          socket.emit('chat', message); // Send the message data from the input field.
        }

        $('#message').val(''); // Clear the message input so we can type again immediately.

        $('#chatbox').scrollTop($('#chatbox')[0].scrollHeight); // Move to the most recent message if the client sent it themselves, independent of the current scroll position.
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
    $('body *:not(.blur-exclude):not(.blur-exclude *)').css('-webkit-filter', 'blur(3px)'); // Blur background.
    $('input[name="group"]').focus();

    if($('#group-join').hasClass('active-button')) {
      $('#group-join').removeClass('active-button');
      $('#server-container #group-join-form').css('display', 'none');
    }
  });

  $('#view-members').click(() => {
    ToggleVisiblity('#options-nav-container');

    $('#member-list-container').fadeIn(200); // Take 200ms to fade.
    $('body *:not(.blur-exclude):not(.blur-exclude *)').css('-webkit-filter', 'blur(3px)'); // Blur background.

    FetchMemberList();
  });

  $('#group-create-close-button').click(() => {
    CloseCreateForm();
  });

  $('#member-list-close-button').click(() => {
    CloseMemberList();
  });

  $('#group-info-admin-button').click(() => {
    window.location.href = "/group-info?GroupID=" + activeServerID;
  });

  $(document).click((event) => {
    // Handle click events. We should hide the nav container if it's visible and we click outside of it.
    if ($('#group-create-container').css('display') == 'block' && $('#group-create-container').css('opacity') == 1 && !$(event.target).is('.popup-container') && !$(event.target).is('.popup-container *')) {
      CloseCreateForm();
    } else if ($('#member-list-container').css('display') == 'block' && $('#member-list-container').css('opacity') == 1 && !$(event.target).is('.popup-container') && !$(event.target).is('.popup-container *')) {
      CloseMemberList();
    }
  });

  socket.on('message return', (message) => {
    // Only render the message if we are on its group.
    if (message.GroupID === activeServerID) {
      $('#chatbox-reminder').hide();
      $('#invite-prompt').hide();

      let scrollOffset = $('#chatbox')[0].scrollHeight - $('#chatbox').scrollTop() - $('#chatbox').innerHeight();

      $('#chatbox').append($('<li ' + (message.AuthorID == id ? 'class="owned" ' : '') + 'style="position: relative;">').attr('id', message.MessageID)
                   .append($('<i class="message-author" style="display: inline; color: #888;">')
                     .text(message.AuthorDisplayName))
                   .append($('<i class="message-timestamp" style="color: #888; float: right;">')
                     .text(GetMessageTimestamp(message.Timestamp)))
                   .append($('<div class="message-options-container">')
                   .append($('<button class="message-pin-button" value="Pin">').prepend($('<img src="img/PinLo.png" alt="Pin">')))
                   .append($('<button class="message-bin-button" value="Bin">').prepend($('<img src="img/BinLo.png" alt="Bin">'))))
                   .append('<br />')
                   .append($('<p class="message-content" style="display: inline;">')
                     .text(message.MessageString)));

      StickScroll(scrollOffset);
    }

    SetRecentMessage(message.GroupID, message.MessageString);
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

  $(document).on('click', '.message-bin-button', (event) => {
    socket.emit('message delete', $(event.target).closest('li').attr('id'));
  });

  socket.on('binned', (data) => {
    $('#' + data.message).remove();
    CheckPinnedMessage(); // The deleted message may have been binned, so check and remove it, if necessary.

    if ($('#chatbox li').length == 0) {
      $('#chatbox-reminder').show();
      $('#invite-prompt').show();
      $('#chatbox-reminder').text('No messages yet');
    }

    SetRecentMessage(data.group, data.newLatestMessage);
  });

  $(document).on('click', '.message-pin-button', (event) => {
    socket.emit('message pin', $(event.target).closest('li').attr('id'));
  });

  socket.on('pinned', (groupID) => {
    if (groupID == activeServerID) {
      CheckPinnedMessage();
    }
  });

  $(document).on('click', '#pinned-message-delete-button', (event) => {
    socket.emit('message unpin', activeServerID);
  });

  socket.on('unpinned', (data) => {
    if (data.group == activeServerID) {
      HandleUnpinInCurrentGroup();

      $('#' + data.message).removeClass('pinned');
    }
  });

  $(document).on('click', '.role-button', (event) => {
    socket.emit('role change', {
      GroupID: activeServerID,
      UserToChange: $(event.target).closest('li').attr('id'),
      TargetRole: $(event.target).attr('value')
    });
  });

  socket.on('role update', (data) => {
    if (data.InGroup == activeServerID) {
      if (data.NewRole == 1) {
        // Change the text first, then move to the new list.
        $('#' + data.AffectsUser).find('.role-button').attr('value', 'member').text('Make member');

        $('#member-list #admins').append($('#' + data.AffectsUser).remove());
      } else {
        // Change the text first, then move to the new list.
        $('#' + data.AffectsUser).find('.role-button').attr('value', 'admin').text('Make admin');

        $('#member-list #members').append($('#' + data.AffectsUser).remove());
      }
    }

    if (data.AffectsUser == id) {
      role = data.NewRole;

      RefreshAdminContentDisplay();
    }
  });

  function CloseCreateForm() {
    $('#group-create').removeClass('active-button');
    $('#group-create-container').fadeOut(200); // Take 200ms to fade.

    UnhidePopup();
  }

  function CloseMemberList() {
    $('#member-list-container').fadeOut(200); // Take 200ms to fade.

    UnhidePopup();
  }
});

function SetActiveServerID(id) {
  activeServerID = id;

  $('.requires-group-selection').show();

  $('#message').focus();

  $.when(
    $.ajax({
      type: "POST",
      url: "/api/GetMessages",
      data:  {
        GroupID: activeServerID
      },
      success: (data) => {

        $('#chatbox').empty();

        let JSONData = $.parseJSON(data);

        if (JSONData.messageData.length > 0) {
          $('#chatbox-reminder').hide();
          $('#invite-prompt').hide();
        } else {
          $('#chatbox-reminder').show();
          $('#invite-prompt').show();
          $('#chatbox-reminder').text('No messages yet');
        }

        role = JSONData.role;

        SetGroupOptionButtonVisibility();

        $.parseJSON(data).messageData.forEach((message, i) => {
          $('#chatbox').append($('<li ' + (message.Owned ? 'class="owned" ' : '') + 'style="position: relative;">').attr('id', message.MessageID)
                       .append($('<i class="message-author" style="display: inline; color: #888;">')
                         .text(message.AuthorDisplayName))
                       .append($('<i class="message-timestamp" style="color: #888; float: right;">')
                         .text(GetMessageTimestamp(message.Timestamp)))
                       .append($('<div class="message-options-container">')
                       .append($('<button class="message-pin-button" style="display: ' + (role > 0 ? 'inline-block' : 'none')  + ';" value="Pin">').prepend($('<img src="img/PinLo.png" alt="Pin">')))
                       .append($('<button class="message-bin-button" style="display: ' + (role > 0 ? 'inline-block' : 'none') + ';" value="Bin">').prepend($('<img src="img/BinLo.png" alt="Bin">'))))
                       .append('<br />')
                       .append($('<p class="message-content" style="display: inline;">')
                         .text(message.MessageString)));
        });

        CheckPinnedMessage();
      },
      failure: () => {
        console.error("Could not retreive messages. Try again later.");
      }
    })
  ).then(() => {
    $('#chatbox').scrollTop($('#chatbox')[0].scrollHeight); // View the most recent messages.
  });
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
      let mustAdjustScroll = $('#pinned-message-container').css('display') == 'none';

      if (JSONData.length > 0) {
        $('#pinned-message-container').css('display', 'flex');

        $('#pinned-message-label').text('Pinned message from ' + JSONData[0].AuthorDisplayName + ', sent ' + GetPinnedMessageTimestamp(JSONData[0].Timestamp) + '.');
        $('#pinned-message-text').text(JSONData[0].MessageString);

        $('#chatbox li').removeClass('pinned');
        $('#' + JSONData[0].MessageID).addClass('pinned');

        if (mustAdjustScroll) $('#chatbox').scrollTop($('#chatbox').scrollTop() + $('#pinned-message-container').outerHeight());
      } else {
        if ($('#pinned-message-container').css('display') == 'flex') {
          HandleUnpinInCurrentGroup();
        }
      }
    },
    failure: () => {
      console.error("Could not retreive messages. Try again later.");
    }
  });
}

function UnhidePopup() {
  $('#message').focus();
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

  let atTimeString = ' at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  if (date.getDate() == today.getDate()) {
    // The message was sent today, so we'll just say the time.
    return 'today' + atTimeString;
  } else if (date.getDate() == today.getDate() - 1) {
    // The date is yesterday.
    return 'yesterday' + atTimeString;
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

function HandleUnpinInCurrentGroup() {
  let beforeHideScrollOffset = $('#chatbox')[0].scrollHeight - $('#chatbox').scrollTop() - $('#chatbox').innerHeight();

  $('#pinned-message-container').hide();

  // Ensure that, despite the chatbox changing dimensions, we keep the same scroll position relative to the bottom.
  $('#chatbox').scrollTop(
    $('#chatbox').scrollTop() -
    (($('#chatbox')[0].scrollHeight - $('#chatbox').scrollTop() - $('#chatbox').innerHeight()) >= $('#pinned-message-container').height() ?
    $('#pinned-message-container').outerHeight()
    : beforeHideScrollOffset));

  $('#pinned-message-label').text();
  $('#pinned-message-text').text();
}

function SetRecentMessage(groupID, messageString) {
  $('#' + groupID + ' .server-info-container i').text(messageString);
}

function FetchMemberList() {
  // Get the user's display name from their session cookie and the database.
  $.ajax({
    type: "POST",
    url: "/api/GetGroupMemberList",
    data: {
      GroupID: activeServerID
    },
    success: (data) => {
      $('#member-list #owner, #member-list #admins, #member-list #members').empty(); // Empty before we append to avoid any duplicates.

      let memberList = $.parseJSON(data);

      for (let i = 0; i < memberList.length; ++i) {

        let roleButtonAction;
        if (memberList[i].Role == 1) {
          roleButtonAction = 'member';
        } else if (memberList[i].Role != 2) {
          roleButtonAction = 'admin';
        }

        let newNameRow = $('<li id="' + memberList[i].UserID + '">')
                        .append($('<p class="user-name" style="margin: 0;">').text(memberList[i].DisplayName))
                        .append($('<div class="member-options-container">')
                        .append(role > memberList[i].Role && roleButtonAction ? $('<button class="role-button" value="' + roleButtonAction + '">').text('Make ' + roleButtonAction) : null)
                        .append(!memberList[i].IsAFriend ? $('<button class="friend-button">').text('Add friend ') : null));
        switch(memberList[i].Role) {
          case 2:
            // Owner.
            $('#member-list #owner').append(newNameRow);
            break;
          case 1:
            // Admin.
            $('#member-list #admins').append(newNameRow);
            break;
          default:
            // Member.
            $('#member-list #members').append(newNameRow);
            break;
        }
      }
    },
    failure: () => {
      console.error("Could not retreive members. Try again later.");
    }
  });
}

function SetUserID() {
  // Get the user's ID from their session cookie.
  $.ajax({
    type: "POST",
    url: "/api/GetMyUserID",
    success: (data) => {
      id = $.parseJSON(data)[0].UserID;
    },
    failure: () => {
      console.error("Could not retreive ID. Try again later.");
    }
  });
}

function RefreshAdminContentDisplay() {
  $('#chatbox li:not(.owned)').each(function() {
    $(this).find('.message-options-container button').css('display', role > 0 ? 'inline-block' : 'none');
  });

  $('#chatbox li.owned').each(function() {
    $(this).find('.message-options-container .message-pin-button').css('display', role > 0 ? 'inline-block' : 'none');
  });

  SetGroupOptionButtonVisibility();
}

function SetGroupOptionButtonVisibility() {
  if (role > 0) {
    $('#pinned-message-delete-button').css('display', 'block');
    $('#group-info-admin-button-item').css('display', 'list-item');
    $('#group-info-admin-button-item').addClass('round-bottom');
    $('#show-invite-code').closest('li').removeClass('round-bottom');
  } else {
    $('#pinned-message-delete-button').css('display', 'none');
    $('#group-info-admin-button-item').css('display', 'none');
    $('#group-info-admin-button-item').removeClass('round-bottom');
    $('#show-invite-code').closest('li').addClass('round-bottom');
  }
}
