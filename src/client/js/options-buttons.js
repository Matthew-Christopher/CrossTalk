$(window).on("load", () => {
  $('#profile-options-button').click(() => {
    ToggleVisiblity('#profile-options-container');
  });
});

function ToggleVisiblity (name) {
  let currentVisibility = $(name).css('visibility');
  console.log(currentVisibility);
  console.log((currentVisibility == 'visible') ? 'hidden' : 'visible');
  $(name).css('visibility', (currentVisibility == 'visible') ? 'hidden' : 'visible'); // Toggle the visibility of the container.
}
