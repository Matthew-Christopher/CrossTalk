$(window).on("load", () => {

  let JSONData;

  FetchGroups();

  // Now the server selector is populated, we can manage the server states.

  $('#group-join-form').submit((e) => {
    e.preventDefault();

    $.ajax({
      type: "POST",
      url: "/JoinGroup",
      data: $('#group-join-form').serialize(),
      success: (data) => {
        if ($.parseJSON(data).status.toLowerCase() == 'success') {
          FetchGroups(() => {
            let newGroupID = $.parseJSON(data).groupID;
            socket.emit('join', newGroupID);

            // Select the new group and scroll to it.
            $('#' + newGroupID).trigger('click');

            ScrollTo(newGroupID);
          });

          $('#group-join-code').val('');
          $('#group-join').removeClass('active-button');
          $('#server-container #group-join-form').css('display', 'none');
        } else if ($.parseJSON(data).status.toLowerCase() == "existing") {
          let newGroupID = $.parseJSON(data).groupID;

          // Select the new group and scroll to it.
          $('#' + newGroupID).trigger('click');

          ScrollTo(newGroupID);

          $('#group-join-code').val('');
          $('#group-join').removeClass('active-button');
          $('#server-container #group-join-form').css('display', 'none');
          $('#group-join-button').css('background', '');
        } else {
          $('#group-join-code').val('').focus();
          $('#group-join-button').text('Invalid');
          $('#group-join-button').css('background', '#e74c3c');

          // Wait and then automatically clear the error state.
          setTimeout(() => {
            $('#group-join-button').text('Go');
            $('#group-join-button').css('background', '');
          }, 3000);
        }
      },
      failure: () => {
        alert("Could not recognise the invite code. Check it and try again.");
      }
    });
  });

  $('#group-create-form').submit((e) => {
    e.preventDefault();

    $('#group-create-button').css('background', '#8ffd9f');

    $.ajax({
      type: "POST",
      url: "/CreateGroup",
      data: $('#group-create-form').serialize(),
      success: (data) => {

        JSONData = $.parseJSON(data);

        let newGroupID = $.parseJSON(data)[0].GroupID;
        socket.emit('join', newGroupID);

        FetchGroups(() => {
          // Select the new group and scroll to it.
          $('#' + newGroupID).trigger('click');

          ScrollTo(newGroupID);
        });

        $('#group-create').removeClass('active-button');

        $('#group-create-container').fadeOut(200); // Take 200ms to fade.
        $('body *:not(.blur-exclude)').css('-webkit-filter', '');


        $('#group-create-form input[name="group"]').val(''); // Clear the name input.
        $('#group-create-form input[name="group"]').removeClass('non-empty'); // Clear the name input.

        $('#group-create-button').css('background', '#6dd5ed');
      },
      error: () => {
        alert("Something went wrong. Try again later.");
      }
    });
  });

  $(document).on('click', '.server-button', (event) => {
    // If the event target is the text in the button, we actually want the parent button.
    // Match by just the GroupID property.
    targetIndex = JSONData.findIndex(x => x.GroupID == $(event.target).closest('button').attr('id'));

    $('#' + JSONData[targetIndex].GroupID).addClass('active-button');

    JSONData.forEach((item, i) => {
      if (i != targetIndex) {
        $('#' + item.GroupID).removeClass('active-button');
      }
    });

    SetActiveServerID(JSONData[targetIndex].GroupID);

    $('#server-name-display').text(JSONData[targetIndex].GroupName);
    $('#group-options-label').text(JSONData[targetIndex].GroupName);
  });

  function FetchGroups(callback) {

    // Remove the groups we already have, they might have changed.
    $('#server-selector').empty();

    // Call the server's API to get the user's groups.
    $.ajax({
      type: "POST",
      url: "/api/GetMyGroups",
      success: (data) => {
        JSONData = $.parseJSON(data);

        if (JSONData.length > 0) {
          $('#group-prompt').hide();
        } else {
          $('#group-prompt').show();
        }

        // Then we can populate the container dynamically.
        $.each(JSONData, (i, item) => {

          // Construct HTML from the parsed JSON data. Using .text() escapes any malformed or malicious strings.
          let newGroup =
            $('<button class="server-button" type="button">').attr('id', item.GroupID)
              .append($('<span class="server-info-container">')
              .append($("<h1></h1>").text(item.GroupName))
              .append($("<i></i>").text(item.LatestMessageString ? item.LatestMessageString : "No messages yet.")));

          socket.emit('join', item.GroupID);

          newGroup.appendTo('#server-selector');
        });

        if (callback) callback();
      },
      failure: () => {
        console.log("Could not retreive messaging groups. Try again later.");
      }
    });
  }
});

function ScrollTo(newGroupID) {
  $('#server-selector').scrollTop(
    $('#' + newGroupID)[0].offsetTop // The distance from the top of this element that the desired elemenent is.
    - $('#server-buttons-container').height() // Account for height of the top buttons.
    - ($('#group-join-form .slide-back').height() + 1) // The invite form will hide after executing and we need to account for its height.
    - $('#server-selector').height() // Scroll so that the element is at the bottom of the window.
    + $('#' + newGroupID).height()); // Account for the height of the element itself, so that its bottom edge is at the bottom of this element.
}
