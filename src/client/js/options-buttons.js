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
    let otherContainer = (name == '#profile-options-nav-container') ? '#options-nav-container' : '#profile-options-nav-container';

    if ($(otherContainer).css('visibility') == 'visible') {
      $(otherContainer).css('visibility', 'hidden');
    }

    $(name).css('visibility', 'visible');
  }
}
