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
      success: (data) => {
        let JSONData = $.parseJSON(data);

        if (JSONData.outcome == 'mismatch') {
          // Password did not password confirmation field.
          $('#result').text("Passwords did not match.");
        } else if (JSONData.outcome == 'invalid') {
          // The recovery key was not valid.
          $('#result').text("Invalid recovery key; it may have expired. Redirecting...");

          // Wait and then automatically redirect to the recovery page.
          setTimeout(() => {
            window.location.href = "/recover";
          }, 3000);
        } else if (JSONData.outcome == 'change') {
          // Password changed.
          $('#result').text("Password changed. Redirecting...");

          // Wait and then automatically redirect to the login page.
          setTimeout(() => {
            window.location.href = "/login";
          }, 3000);
        }
      },
      error: () => {
        alert("Something went wrong. Try again later.");
      }
    });
  });
});
