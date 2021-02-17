let activeServerID,
  role,
  id,
  groupIsPrivate = false;
const socket = io.connect('/');

$(window).on('load', () => {
  // Get the user's display name from their session cookie and the database.
  $.ajax({
    type: 'POST',
    url: '/api/GetMyDisplayName',
    success: (data) => {
      $('#name-display').text($.parseJSON(data)[0].DisplayName);
      $('#profile-options-name-label').text($.parseJSON(data)[0].DisplayName);
    },
    failure: () => {
      console.error('Could not retreive display name. Try again later.');
    },
  });

  setUserID();

  $('#message-form').submit((event) => {
    event.preventDefault(); // Don't refresh, we want a smooth experience.

    // We trim whitespace from the start and end of the message before sending it.
    let messageString = $('#message').val().trim();

    if (0 < messageString.length && messageString.length <= 2000) {
      let userID;
      if (activeServerID) {
        // Message object format: (MessageID, GroupID, FriendshipID, AuthorID, AuthorDisplayName, MessageString, Timestamp)
        let message = new Message(null, groupIsPrivate ? null : activeServerID, groupIsPrivate ? activeServerID : null, null, null, messageString, Date.now());

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

  // Show the form to join a group.
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

  // Open the popup creation form.
  $('#group-create').click(() => {
    $('#group-create').addClass('active-button');

    $('#group-create-container').fadeIn(200); // Take 200ms to fade.
    $('body *:not(.blur-exclude):not(.blur-exclude *)').css('-webkit-filter', 'blur(3px)'); // Blur background.
    $('input[name="group"]').focus();

    if ($('#group-join').hasClass('active-button')) {
      $('#group-join').removeClass('active-button');
      $('#server-container #group-join-form').css('display', 'none');
    }
  });

  // Show the members popup and get the members from the server.
  $('#view-members').click(() => {
    toggleVisiblity('#options-nav-container');

    $('#member-list-container').fadeIn(200); // Take 200ms to fade.
    $('body *:not(.blur-exclude):not(.blur-exclude *)').css('-webkit-filter', 'blur(3px)'); // Blur background.

    fetchMemberList();
  });

  $('#group-create-close-button').click(() => {
    closeCreateForm();
  });

  $('#member-list-close-button').click(() => {
    closeMemberList();
  });

  // Redirect to the correct page.
  $('#group-info-admin-button').click(() => {
    window.location.href = '/group-info?GroupID=' + activeServerID;
  });

  $(document).click((event) => {
    // Handle click events. We should hide the nav container if it's visible and we click outside of it.
    if ($('#group-create-container').css('display') == 'block' && $('#group-create-container').css('opacity') == 1 && !$(event.target).is('.popup-container') && !$(event.target).is('.popup-container *')) {
      closeCreateForm();
    } else if ($('#member-list-container').css('display') == 'block' && $('#member-list-container').css('opacity') == 1 && !$(event.target).is('.popup-container') && !$(event.target).is('.popup-container *')) {
      closeMemberList();
    }
  });

  socket.on('message return', (message) => {
    // Only render the message if we are on its group.
    if (message.GroupID ? message.GroupID : message.FriendshipID === activeServerID) {
      $('#chatbox-reminder').hide();
      $('#invite-prompt').hide();

      let scrollOffset = $('#chatbox')[0].scrollHeight - $('#chatbox').scrollTop() - $('#chatbox').innerHeight();

      // Add the message to the chatbox.
      $('#chatbox').append(
        $('<li ' + (message.AuthorID == id ? 'class="owned" ' : "") + 'style="position: relative;">')
          .attr('id', message.MessageID)
          .append($('<i class="message-author" style="display: inline; color: #888;">').text(message.AuthorDisplayName))
          .append($('<i class="message-timestamp" style="color: #888; float: right;">').text(getMessageTimestamp(message.Timestamp)))
          .append(
            $('<div class="message-options-container' + (!(role > 0 || message.AuthorID == id) ? " empty" : "") + '">')
              .append($('<button class="message-pin-button" style="display: ' + (role > 0 ? "inline-block" : "none") + ';" value="Pin">').prepend($('<img src="img/PinLo.png" alt="Pin">')))
              .append($('<button class="message-bin-button" style="display: ' + (role > 0 ? "inline-block" : "none") + ';" value="Bin">').prepend($('<img src="img/BinLo.png" alt="Bin">')))
          )
          .append('<br />')
          .append($('<p class="message-content" style="display: inline;">').text(message.MessageString))
      );

      // Handle scrollbar behaviour.
      stickScroll(scrollOffset);
    }

    // Update the new most recent message in the server selector.
    setRecentMessage(message.GroupID ? message.GroupID : message.FriendshipID, message.MessageString);
  });

  // We have changed whatever was typed into the search bar.
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
        listItems[i].parentElement.style.display = 'list-item';
      } else {
        listItems[i].parentElement.style.display = 'none';
      }
    }

    stickScroll(scrollOffsetBeforeFilter);

    if (nothingFound) {
      $('#chatbox-reminder')
        .css('display', 'block')
        .text('No messages ' + (listItems.length > 0 ? 'found' : 'yet'));
    } else {
      $('#chatbox-reminder').css('display', 'none');
    }
  });

  // Request that the server deletes a message in the group/private message.
  $(document).on('click', '.message-bin-button', (event) => {
    socket.emit('message delete', $(event.target).closest('li').attr('id'));
  });

  // A message got deleted so we should handle that.
  socket.on('binned', (data) => {
    $('#' + data.message).remove();
    checkPinnedMessage(); // The deleted message may have been binned, so check and remove it, if necessary.

    if ($('#chatbox li').length == 0) {
      $('#chatbox-reminder').show();
      if (!groupIsPrivate) $('#invite-prompt').show();
      $('#chatbox-reminder').text('No messages yet');
    }

    setRecentMessage(data.group, data.newLatestMessage);
  });

  // Request that the server pins a message in the group.
  $(document).on('click', '.message-pin-button', (event) => {
    socket.emit('message pin', $(event.target).closest('li').attr('id'));
  });

  // A message just got pinned in one of our groups so we should show it if that group is open at the moment.
  socket.on('pinned', (groupID) => {
    if (groupID == activeServerID) {
      checkPinnedMessage();
    }
  });

  // Request that the server unpins a message.
  $(document).on('click', '#pinned-message-delete-button', (event) => {
    socket.emit('message unpin', activeServerID);
  });

  // A message just got unpinned in one of our groups so we should remove it if that group is currently open.
  socket.on('unpinned', (data) => {
    if (data.group == activeServerID) {
      handleUnpinInCurrentGroup();

      $('#' + data.message).removeClass('pinned');
    }
  });

  // Request that the server promotes or demotes someone that we clicked on.
  $(document).on('click', '.role-button', (event) => {
    socket.emit('role change', {
      GroupID: activeServerID,
      UserToChange: $(event.target).closest('li').attr('id'),
      TargetRole: $(event.target).attr('value'),
    });
  });

  // Someone just got promoted or demoted in one of our groups. We should check if that was us and move the user in the member list.
  socket.on('role update', (data) => {
    if (data.InGroup == activeServerID) {
      if (data.NewRole == 1) {
        // Change the text first, then move to the new list.
        $('#' + data.AffectsUser)
          .find('.role-button')
          .attr('value', 'member')
          .text('Make member');

        $('#member-list #admins').append($('#' + data.AffectsUser).remove());
      } else {
        // Change the text first, then move to the new list.
        $('#' + data.AffectsUser)
          .find('.role-button')
          .attr('value', 'admin')
          .text('Make admin');

        $('#member-list #members').append($('#' + data.AffectsUser).remove());
      }

      // Remove buttons to change role if they are now our rank or higher.
      if (data.NewRole < role) {
        $('#' + data.AffectsUser)
          .find('.role-button')
          .css('display', 'inline-block');

        $('#' + data.AffectsUser)
          .find('.member-options-container')
          .removeClass('empty');

        if (
          $('#' + data.AffectsUser)
            .find('.friend-add-button')
            .css('display') == 'none'
        ) {
          $('#' + data.AffectsUser)
            .find('.member-options-container')
            .addClass('single');
        }
      } else {
        $('#' + data.AffectsUser)
          .find('.role-button')
          .css('display', 'none');

        if (
          $('#' + data.AffectsUser)
            .find('.friend-add-button')
            .css('display') == 'none'
        ) {
          $('#' + data.AffectsUser)
            .find('.member-options-container')
            .addClass('empty');
        } else {
          $('#' + data.AffectsUser)
            .find('.member-options-container')
            .removeClass('empty');
        }
      }
    }

    // That user was us, so we need to change what buttons we have access to because if we don't then clicking them won't do anything; the server will ignore our request.
    if (data.AffectsUser == id) {
      role = data.NewRole;

      refreshAdminContentDisplay();
    }
  });

  // Send a friend request.
  $(document).on('click', '.friend-add-button', (event) => {
    $(event.target).closest('.friend-add-button').prop('disabled', true);

    socket.emit('friend add', {
      ReferringGroup: activeServerID,
      NewFriend: $(event.target).closest('li').attr('id'),
    });
  });

  socket.on('friend update', (data) => {
    oneOfMyFriendsUpdated(data);
  });

  // Incoming request! It might have come to us but if not then we need to update the member list buttons.
  socket.on('friend requested', (toUser, name) => {
    if (toUser == id) {
      setFriends();

      let friendButton = $('p.user-name:contains("' + name + '")')
        .parents('li')
        .find('.friend-add-button');
      let friendContainer = $('p.user-name:contains("' + name + '")').parents('li');

      friendButton.css('display', 'none');

      if (friendContainer.find('.role-button').css('display') == 'none') {
        friendContainer.find('.member-options-container').addClass('empty');
      } else {
        friendContainer.find('.member-options-container').addClass('single');
      }
    } else {
      let friendButton = $('#' + toUser).find('.friend-add-button');

      friendButton.text('Request sent!').css('background', '#8ffd9f');

      // Wait for a bit and then remove this button.
      setTimeout(() => {
        friendButton.css('display', 'none');

        // May now need to set member options to empty, check for that.
        if (
          $('#' + toUser)
            .find('.role-button')
            .css('display') == 'none'
        ) {
          $('#' + toUser)
            .find('.member-options-container')
            .addClass('empty');
        } else {
          $('#' + toUser)
            .find('.member-options-container')
            .addClass('single');
        }
      }, 1500);
    }
  });

  // We are swapping between groups and friends.
  $('#chat-type-toggle').change(function (event) {
    activeServerID = '';

    $('#options-button').hide(); // Hide the cog button until a group or friend is selected.

    $('#server-name-display').text('Crosstalk'); // Reset title from group/friend names.
    $('#chatbox').empty(); // Clear data before we select a group/friend.

    if (event.target.checked) {
      // Friends view.
      $('#server-selector').empty();
      $('#server-buttons-container').css('display', 'none');

      $('#friend-requests-toggle').css('display', 'block');
    } else {
      // Groups view.
      $('#friend-requests-container .active-button').removeClass('active-button');
      $('#friend-requests-container .expanded').removeClass('expanded');

      $('#server-buttons-container').css('display', 'block');

      $('#friend-requests-toggle').css('display', 'none');
    }
  });

  function closeCreateForm() {
    $('#group-create').removeClass('active-button');
    $('#group-create-container').fadeOut(200); // Take 200ms to fade.

    unhidePopup();
  }

  function closeMemberList() {
    $('#member-list-container').fadeOut(200); // Take 200ms to fade.

    unhidePopup();
  }

  function setRecentMessage(groupID, messageString) {
    $('#' + groupID + ' span i').text(messageString);
  }

  function fetchMemberList() {
    // Get the user's display name from their session cookie and the database.
    $.ajax({
      type: 'POST',
      url: '/api/GetGroupMemberList',
      data: {
        GroupID: activeServerID,
      },
      success: (data) => {
        $('#member-list #owner, #member-list #admins, #member-list #members').empty(); // Empty before we append to avoid any duplicates.
        $('#member-list-title').text($('#' + activeServerID + ' .server-info-container h1').text()); // Set the title of the dialogue to the group name.

        let memberList = $.parseJSON(data);

        for (let i = 0; i < memberList.length; ++i) {
          let roleButtonAction;
          if (memberList[i].Role == 1) {
            roleButtonAction = 'member';
          } else if (memberList[i].Role != 2) {
            roleButtonAction = 'admin';
          }

          let optionsContainerClass = '';
          if (!(role > memberList[i].Role) && memberList[i].IsAFriend) {
            optionsContainerClass = ' empty';
          } else if (memberList[i].IsAFriend || !(role > memberList[i].Role)) {
            optionsContainerClass = ' single';
          }

          let newNameRow = $('<li id="' + memberList[i].UserID + '">')
            .append($('<p class="user-name" style="margin: 0;">').text(memberList[i].DisplayName))
            .append(
              $('<div class="member-options-container' + optionsContainerClass + '">')
                .append($('<button class="role-button" style="display: ' + (role > memberList[i].Role && roleButtonAction ? "inline-block" : "none") + ';" value="' + roleButtonAction + '">').text("Make " + roleButtonAction))
                .append($('<button class="friend-add-button" style="display: ' + (!memberList[i].IsAFriend ? "inline-block" : "none") + ';">').text("Add friend "))
            );

          switch (memberList[i].Role) {
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
        console.error('Could not retreive members. Try again later.');
      },
    });
  }

  // Alter button and content visibility to match permissions.
  function refreshAdminContentDisplay() {
    $('#chatbox li:not(.owned)').each(function () {
      let toAlter = $(this).find('.message-options-container button');
      if (role > 0) {
        toAlter.css('display', 'inline-block');
        $(this).find('.message-options-container').removeClass('empty');
      } else {
        toAlter.css('display', 'none');
        $(this).find('.message-options-container').addClass('empty');
      }
    });

    $('#chatbox li.owned').each(function () {
      $(this)
        .find('.message-options-container .message-pin-button')
        .css('display', role > 0 ? 'inline-block' : 'none');
    });

    setGroupOptionButtonVisibility();
  }

  function setUserID() {
    // Get the user's ID from their session cookie.
    $.ajax({
      type: 'POST',
      url: '/api/GetMyUserID',
      success: (data) => {
        id = $.parseJSON(data)[0].UserID;
      },
      failure: () => {
        console.error('Could not retreive ID. Try again later.');
      },
    });
  }
});

// New group picked, handle incoming message data from the server.
function setActiveServerID(id) {
  activeServerID = id;

  $('.requires-group-selection').show();

  $('#message').focus();
  $('#chatbox').empty();

  $.when(
    $.ajax({
      type: 'POST',
      url: '/api/GetMessages',
      data: {
        GroupID: activeServerID,
      },
      success: (data) => {
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

        setGroupOptionButtonVisibility();

        appendSavedMessages($.parseJSON(data).messageData);

        checkPinnedMessage();
      },
      failure: () => {
        console.error('Could not retreive messages. Try again later.');
      },
    })
  ).then(() => {
    $('#chatbox').scrollTop($('#chatbox')[0].scrollHeight); // View the most recent messages.
  });
}

// New private message picked, deal with the incoming server message data.
function setActiveFriendID(id) {
  activeServerID = id;

  $('.requires-group-selection').show();

  $('#message').focus();
  $('#chatbox').empty();

  $.when(
    $.ajax({
      type: 'POST',
      url: '/api/GetFriendMessages',
      data: {
        FriendshipID: id,
      },
      success: (data) => {
        let friendMessages = $.parseJSON(data);

        if (friendMessages.length > 0) {
          $('#chatbox-reminder').hide();
        } else {
          $('#chatbox-reminder').show();
          $('#chatbox-reminder').text('No messages yet');
        }

        appendSavedMessages(friendMessages);
      },
      failure: () => {
        console.error('Could not retreive messages. Try again later.');
      },
    })
  ).then(() => {
    $('#chatbox').scrollTop($('#chatbox')[0].scrollHeight); // View the most recent messages.
  });
}

// Add the saved messages to the chatbox that we just got from the server.
function appendSavedMessages(messageArray) {
  $('#chatbox').empty(); // Remove old messages.

  messageArray.forEach((message) => {
    $('#chatbox').append(
      $('<li ' + (message.Owned ? 'class="owned" ' : '') + 'style="position: relative;">')
        .attr('id', message.MessageID)
        .append($('<i class="message-author" style="display: inline; color: #888;">').text(message.AuthorDisplayName))
        .append($('<i class="message-timestamp" style="color: #888; float: right;">').text(getMessageTimestamp(message.Timestamp)))
        .append(
          $('<div class="message-options-container' + (!(role > 0 || message.Owned) ? " empty" : "") + '">')
            .append($('<button class="message-pin-button" style="display: ' + (role > 0 ? "inline-block" : "none") + ';" value="Pin">').prepend($('<img src="img/PinLo.png" alt="Pin">')))
            .append($('<button class="message-bin-button" style="display: ' + (role > 0 ? "inline-block" : "none") + ';" value="Bin">').prepend($('<img src="img/BinLo.png" alt="Bin">')))
        )
        .append('<br />')
        .append($('<p class="message-content" style="display: inline;">').text(message.MessageString))
    );
  });
}

// Is a (new) message pinned in this chat?
function checkPinnedMessage() {
  if (!groupIsPrivate) {
    // We can't pin messages in private chats.
    $.ajax({
      type: 'POST',
      url: '/api/GetPinnedMessage',
      data: {
        GroupID: activeServerID,
      },
      success: (data) => {
        let JSONData = $.parseJSON(data);
        let mustAdjustScroll = $('#pinned-message-container').css('display') == 'none';

        if (JSONData.length > 0) {
          $('#pinned-message-container').css('display', 'flex');

          $('#pinned-message-label').text('Pinned message from ' + JSONData[0].AuthorDisplayName + ', sent ' + getPinnedMessageTimestamp(JSONData[0].Timestamp) + '.');
          $('#pinned-message-text').text(JSONData[0].MessageString);

          $('#chatbox li').removeClass('pinned');
          $('#' + JSONData[0].MessageID).addClass('pinned');

          if (mustAdjustScroll) $('#chatbox').scrollTop($('#chatbox').scrollTop() + $('#pinned-message-container').outerHeight());
        } else {
          if ($('#pinned-message-container').css('display') == 'flex') {
            handleUnpinInCurrentGroup();
          }
        }
      },
      failure: () => {
        console.error('Could not retreive messages. Try again later.');
      },
    });
  }
}

function unhidePopup() {
  $('#message').focus();
  $('body *:not(.blur-exclude)').css('-webkit-filter', '');
}

// When did we send/receive this? Let's get that information in a nice format.
function getMessageTimestamp(timestamp) {
  let date = new Date(eval(timestamp));
  let today = new Date();

  if (date.getDate() == today.getDate()) {
    // The message was sent today, so we'll just say the time.
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (date.getDate() == today.getDate() - 1) {
    // The date is yesterday.
    return 'Yesterday';
  } else {
    // The message was before yesterday, so just say the day.
    return date.toLocaleDateString();
  }
}

// Ensure that the chatbox scroll doesn't jerk around because its size changes.
function handleUnpinInCurrentGroup() {
  let beforeHideScrollOffset = $('#chatbox')[0].scrollHeight - $('#chatbox').scrollTop() - $('#chatbox').innerHeight();

  $('#pinned-message-container').hide();

  // Ensure that, despite the chatbox changing dimensions, we keep the same scroll position relative to the bottom.
  $('#chatbox').scrollTop(
    $('#chatbox').scrollTop() - ($('#chatbox')[0].scrollHeight - $('#chatbox').scrollTop() - $('#chatbox').innerHeight() >= $('#pinned-message-container').height() ? $('#pinned-message-container').outerHeight() : beforeHideScrollOffset)
  );

  $('#pinned-message-label').text();
  $('#pinned-message-text').text();
}

// We show more detail for this message, since it must be more important that other messages!
function getPinnedMessageTimestamp(timestamp) {
  // A more contextualised timestamp function for the pinned message box.

  let date = new Date(eval(timestamp));
  let today = new Date();

  let atTimeString = ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

// Stay at the bottom of the chat box with the most recent messages unless we really wanted to scroll up.
function stickScroll(scrollOffset) {
  const pixelsStickScrollThreshold = 150;

  if (scrollOffset <= pixelsStickScrollThreshold) {
    $('#chatbox').scrollTop($('#chatbox')[0].scrollHeight); // View the most recent message, but only if we haven't already scrolled up to view something older (outside of a certain threshold).
  }
}

function setGroupOptionButtonVisibility() {
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
