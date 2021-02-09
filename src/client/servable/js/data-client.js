$(window).on("load", () => {
  // $('#member-statistics-button').click(() => {
  //   if (!$('#member-statistics-button').hasClass('active-button')) {
  //     $('#member-statistics-button').addClass('active-button');
  //     $('#message-statistics-button').removeClass('active-button');
  //   }
  // });
  //
  // $('#message-statistics-button').click(() => {
  //   if (!$('#message-statistics-button').hasClass('active-button')) {
  //     $('#message-statistics-button').addClass('active-button');
  //     $('#member-statistics-button').removeClass('active-button');
  //   }
  // });

  // Get the GroupID.
  let searchParams = new URLSearchParams(window.location.search);

  if (searchParams.has('GroupID')) {
    // Get the group data.
    $.ajax({
      type: "POST",
      url: "/api/GetGroupData",
      data: { GroupID: searchParams.get('GroupID') },
      success: (data) => {
        console.log($.parseJSON(data));
      },
      failure: () => {
        console.error("Could not group data. Try again later.");
      }
    });
  }
});
