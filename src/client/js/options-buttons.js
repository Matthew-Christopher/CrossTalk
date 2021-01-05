$(window).on("load", () => {
  $(document).click((event) => {
    // Handle click events. We should hide the nav container if it's visible and we click outside of it.

    // I MUST UNIFY THIS WITH THE TOGGLE FUNCTION, ONE WAY OR THE OTHER
    if ($('#profile-options-nav-container').css('visibility') == 'visible' && !$(event.target).is('#profile-options-nav-container') && !$(event.target).is('#profile-options-nav-container *') && !($(event.target).is('#profile-options-button') || $(event.target).is('#options-button'))) {
      $('#profile-options-nav-container').css('visibility', 'hidden');
    } else if ($('#options-nav-container').css('visibility') == 'visible' && !$(event.target).is('#options-nav-container') && !$(event.target).is('#options-nav-container *') && !($(event.target).is('#profile-options-button') || $(event.target).is('#options-button'))) {
      $('#options-nav-container').css('visibility', 'hidden');

      HideInviteCode();
    } else if ($(event.target).is('#profile-options-button') || $(event.target).is('#profile-options-button *')) {
      ToggleVisiblity('#profile-options-nav-container');
    } else if ($(event.target).is('#options-button') || $(event.target).is('#options-button *')) {
      if ($('#options-nav-container').css('visibility') == 'hidden') SetInviteCode();

      ToggleVisiblity('#options-nav-container');
    } else if ($(event.target).is('#show-invite-code')) {
      $('#invite-code-display').css('display', 'flex');
    } else if ($(event.target).is('#invite-code-copy')) {
      CopyInviteCode();

      $('#invite-code-display').css('background', '#d7fadc');
      $('#invite-code-copy').css('background', '#8ffd9f');
      $('#invite-code-copy').text('Copied');

      // Wait and then automatically clear the copied state.
      setTimeout(() => {
        $('#invite-code-display').css('background', '');
        $('#invite-code-copy').css('background', '');
        $('#invite-code-copy').text('Copy');
      }, 4000);
    }
  });
});

function ToggleVisiblity (name) {
  // If I'm visible, hide me.
  // If I need to be shown, show me, and if the other nav item is visible then hide it too.

  if (($(name).css('visibility') == 'visible')) {
    $(name).css('visibility', 'hidden');

    if (name == "#options-nav-container") {
      HideInviteCode();
    }
  } else {
    let otherContainer = (name == '#profile-options-nav-container') ? '#options-nav-container' : '#profile-options-nav-container';

    if ($(otherContainer).css('visibility') == 'visible') {
      $(otherContainer).css('visibility', 'hidden');
    }

    $(name).css('visibility', 'visible');
  }
}

// SOURCE:https://codepen.io/shaikmaqsood/pen/XmydxJ [Accessed 04/01/2021]
function CopyInviteCode() {
  // Create a temporary element so we can copy the code, then delete it again.

  let $temp = $('<input>')
  $('body').append($temp);
  $temp.val($('#invite-code-display p').text()).select();
  document.execCommand("copy");
  $temp.remove();
}
// END SOURCE

function SetInviteCode() {
  $.ajax({
    type: "GET",
    url: "/api/GetInviteCode",
    data:  {
      GroupID: activeServerID
    },
    success: (data) => {
      $('#invite-code').text($.parseJSON(data)[0].InviteCode);
    },
    failure: () => {
      $('#invite-code').text("Error. Try again later.");
    }
  });
}

function HideInviteCode() {
  $('#invite-code-display').css('background', '');
  $('#invite-code-copy').css('background', '');
  $('#invite-code-copy').text('Copy');

  $('#invite-code-display').css('display', 'none');
  $('#invite-code').text('');
}
