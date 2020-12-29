$(window).on("load", () => {

  let JSONData = []; // To store the user's groups.

  // First, call the server's API to get the user's groups.
  $.ajax({
    type: "GET",
    url: "/api/GetMyGroups",
    success: (data) => {
      console.log("JSON group data received.");

      JSONData = $.parseJSON(data);

      // Then we can populate the container dynamically.
      $.each(JSONData, (i, item) => {

        // Construct HTML from the parsed JSON data. Using .text() escapes any malformed or malicious strings.
        let newGroup =
          $('<button class="server-button" type="button">').attr('id', item.groupID)
            .append($('<span class="server-info-container">')
            .append($("<h1></h1>").text(item.groupName))
            .append($("<i></h1>").text(item.lastMessage)));

        newGroup.appendTo('#server-selector');
      });
    },
    failure: () => {
      console.log("Could not retreive messaging groups. Try again later.");
    }
  });

  // Now the server selector is populated, we can manage the server states.

  $(document).on('click', '.server-button', (event) => {
    // If the event target is the text in the button, we actually want the parent button.

    // Match by just the groupID property.
    let targetIndex = JSONData.map(x => x.groupID).indexOf($(event.target).closest('button').attr('id'));

    $('#' + JSONData[targetIndex].groupID).addClass('active-chat');

    JSONData.forEach((item, i) => {
      if (i != targetIndex) {
        $('#' + item.groupID).removeClass('active-chat');
      }
    });

    console.log(JSONData[targetIndex].groupName);
    $('#server-name-display').text(JSONData[targetIndex].groupName);
  });
});
