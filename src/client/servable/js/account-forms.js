$(window).on("load", () => {
  $('#register-form').submit((e) => {
    e.preventDefault();

    $.ajax({
      type: "POST",
      url: "/register-account",
      data: $('#register-form').serialize(),
      success: (data) => {
        if (data == 'success') {
          $('#result').text('A link has been sent to your email. Click it to verify your account.');
        } else if (data == 'display') {
          $('#result').text('An account already exists with that display name.');
          $('input[name="display-name"]').val('').focus();
        } else if (data == 'email') {
          $('#result').text('An account already exists under that email address.');
          $('input[name="email"]').val('').focus();
          $('input[name="confirm-email"]').removeClass('non-empty').val('');
        } else if (data == 'password') {
          $('#result').text('Password does not meet the security requirements. It needs to be at least 8 characters long.')
          $('input[name="password"]').val('').focus();
          $('input[name="confirm-password"]').removeClass('non-empty').val('');
        } else {
          $('#result').text('Data entered was not valid.');
        }
      },
      error: () => {
        $('#result').text('Something went wrong. Try again later.');
      }
    });
  });

  $('#login-form').submit((e) => {
    e.preventDefault();

    $.ajax({
      type: "POST",
      url: "/authenticate-login",
      data: $('#login-form').serialize(),
      success: (data) => {
        if (data == 'fail') {
          $('#result').text('Invalid credentials.');
          $('input[name="email"]').val('').focus();
          $('input[name="password"]').val('').removeClass('non-empty');
        } else if (data == 'unverified') {
          $('#result').text('You need to verify your account first!');
        } else {
          window.location.replace("/chat");
        }
      },
      error: () => {
        $('#result').text('Something went wrong. Try again later.');
      }
    });
  });

  $('#recover-form').submit((e) => {
    e.preventDefault();

    $.ajax({
      type: "POST",
      url: "/recover-account",
      data: $('#recover-form').serialize(),
      success: (data) => {
        if (data == 'success') {
          $('#result').text('A link has been sent to that email, if its account exists. Click it to reset your password.');
        }
      },
      error: () => {
        $('#result').text('Something went wrong. Try again later.');
      }
    });
  });
});
