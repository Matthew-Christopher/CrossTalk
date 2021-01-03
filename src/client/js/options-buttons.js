$(window).on("load", () => {
  $(document).click((event) => {
    // Handle click events. We should hide the nav container if it's visible and we click outside of it.

    if ($('#profile-options-nav-container').css('visibility') == 'visible' && !$(event.target).is('#profile-options-nav-container') && !$(event.target).is('#profile-options-nav-container *') && !($(event.target).is('#profile-options-button') || $(event.target).is('#options-button'))) {
      $('#profile-options-nav-container').css('visibility', 'hidden');
    } else if ($('#options-nav-container').css('visibility') == 'visible' && !$(event.target).is('#options-nav-container') && !$(event.target).is('#options-nav-container *') && !($(event.target).is('#profile-options-button') || $(event.target).is('#options-button'))) {
      $('#options-nav-container').css('visibility', 'hidden');
    } else if ($(event.target).is('#profile-options-button') || $(event.target).is('#profile-options-button *')) {
      ToggleVisiblity('#profile-options-nav-container');
    } else if ($(event.target).is('#options-button') || $(event.target).is('#options-button *')) {
      ToggleVisiblity('#options-nav-container');
    }
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
