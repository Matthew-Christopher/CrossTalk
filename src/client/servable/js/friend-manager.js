$(window).on("load", () => {

  $('#friend-requests-toggle').click(function(event) {
    $(event.target).closest('#friend-requests-toggle').toggleClass('active-button');
    $(event.target).closest('#friend-requests-toggle').find('img').toggleClass('expanded');
    $('#server-container #friend-requests-container .slide-back').toggleClass('expanded');
  });

  $('#chat-type-toggle').change(function(event) {
    if (event.target.checked) { // Friends view.
      $('#friend-requests').empty(); // Clear out any old data.

      // Call the server's API to get our friends and requests.
      $.ajax({
        type: "POST",
        url: "/api/GetMyFriends",
        success: (data) => {
          let friends = $.parseJSON(data);

          if (friends.notSentPending.length > 0) {
            $('#alert').css('display', 'inline');
          } else {
            $('#alert').css('display', 'none');
          }

          if (friends.active.length > 0) {
            $('#group-prompt-container').css('display', 'none');
          } else {
            $('#group-prompt').text('No friends yet.');
            $('#group-prompt-container').css('display', 'block');
          }

          friends.notSentPending.forEach((request) => {
            $('#friend-requests').append($('<div class="friend-request-display">').attr('id', request.FriendshipID)
                                 .append($('<p>').text(request.DisplayName))
                                 .append($('<div class="friend-button-container">')
                                 .append($('<button class="accept-button">')
                                   .append($('<img src="img/TickLo.png">')))
                                 .append($('<button class="reject-button">')
                                   .append($('<img src="img/CrossLo.png">')))));
          });

          friends.sentPending.forEach((request) => {
            $('#friend-requests').append($('<div>').attr('id', request.FriendshipID)
                                 .append($('<p class="no-buttons">').text(request.DisplayName + ' - awaiting their response')));
          });

          friends.active.forEach((item) => {
            // Construct HTML from the parsed JSON data. Using .text() escapes any malformed or malicious strings.
            let newGroup =
              $('<button class="friend-button" type="button">').attr('id', item.FriendshipID)
                .append($('<span class="friend-info-container">')
                .append($("<h1></h1>").text(item.DisplayName))
                .append($("<i></i>").text(item.LatestMessageString ? item.LatestMessageString : "No messages yet.")));

            $('#server-selector').append(newGroup);
          });
        },
        failure: () => {
          console.error("Could not retreive friends. Try again later.");
        }
      });

      $(document).on('click', '.accept-button', function(event) {
        AlterFriendState($(event.target).closest('.friend-request-display').attr('id'), true);
      });

      $(document).on('click', '.reject-button', function(event) {
        AlterFriendState($(event.target).closest('.friend-request-display').attr('id'), false);
      });
    }
  });

  function AlterFriendState(friendshipID, isAccepting) {
    socket.emit('friend update request', {
      FriendshipID: friendshipID,
      IsAccepting: isAccepting
    });
  }
});

function OneOfMyFriendsUpdated(data) {
  if (data.Status == 1) {
    $('#' + data.FriendshipID).remove();
  } else if (data.Status == 2) {

  }
}
