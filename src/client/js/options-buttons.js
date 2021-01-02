$(window).on("load", () => {
  $('#profile-options-button').click(() => {
    ToggleVisiblity('#profile-options-nav-container');
  });

  $('#options-button').click(() => {
    ToggleVisiblity('#options-nav-container');
  });
});

function ToggleVisiblity (name) {
  // If I'm visible, hide me.
  // If I need to be shown, show me, and if the other nav item is visible then hide it too.

  let currentVisibility = $(name).css('visibility');

  if (($(name).css('visibility') == 'visible')) {
    $(name).css('visibility', 'hidden');
  } else {
    if ($((name == '#profile-options-nav-container') ? '#options-nav-container' : '#profile-options-nav-container').css('visibility', 'visible')) {
      $((name == '#profile-options-nav-container') ? '#options-nav-container' : '#profile-options-nav-container').css('visibility', 'hidden');
    }
    
    $(name).css('visibility', 'visible');
  }
}
