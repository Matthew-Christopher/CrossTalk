$(window).on("load", () => {

  let JSONData;

  FetchGroups();

  // Now the server selector is populated, we can manage the server states.

  $('#group-join-form').submit((e) => {
    e.preventDefault();

    $('#group-join-button').css('background', '#8ffd9f');

    $.ajax({
      type: "GET",
      url: "/JoinGroup",
      data: $('#group-join-form').serialize(),
      success: (data) => {
        if ($.parseJSON(data).toLowerCase() == "success") {
          FetchGroups();

          $('#group-join-code').val('');
          $('#group-join').removeClass('active-button');
          $('#server-container #group-join-form').css('display', 'none');
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
      success: () => {

      },
      failure: () => {
        alert("Something went wrong. Try again later.");
      }
    });
  });

  $(document).on('click', '.server-button', (event) => {
    // If the event target is the text in the button, we actually want the parent button.

    // Match by just the GroupID property.
    let targetIndex = JSONData.map(x => x.GroupID).indexOf($(event.target).closest('button').attr('id'));

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

  function FetchGroups() {

    // Remove the groups we already have, they might have changed.
    $('#server-selector').empty();

    // Call the server's API to get the user's groups.
    $.ajax({
      type: "GET",
      url: "/api/GetMyGroups",
      success: (data) => {
        JSONData = $.parseJSON(data);

        // Then we can populate the container dynamically.
        $.each(JSONData, (i, item) => {

          // Construct HTML from the parsed JSON data. Using .text() escapes any malformed or malicious strings.
          let newGroup =
            $('<button class="server-button" type="button">').attr('id', item.GroupID)
              .append($('<span class="server-info-container">')
              .append($("<h1></h1>").text(item.GroupName))
              .append($("<i></i>").text(item.LatestMessageString)));

          newGroup.appendTo('#server-selector');
        });
      },
      failure: () => {
        console.log("Could not retreive messaging groups. Try again later.");
      }
    });
  }
});
