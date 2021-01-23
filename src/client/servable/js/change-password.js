$(window).on("load", () => {
  $('#password-reset-form').submit((e) => {
    e.preventDefault();

    $.ajax({
      type: "POST",
      url: "/account/change-password",
      data: JSON.stringify({
        recoveryKey: new URLSearchParams(window.location.search).get('recoveryKey'),
        formData: {
          newPassword: $('#password-reset-form input[name="new-password"]')[0].value,
          confirmNewPassword: $('#password-reset-form input[name="confirm-new-password"]')[0].value
        }
      }),
      contentType: "application/json",
      success: () => {
        window.location.href = '/';
      },
      error: () => {
        alert("Something went wrong. Try again later.");
      }
    });
  });
});
