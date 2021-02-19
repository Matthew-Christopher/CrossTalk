$(window).on('load', () => {
  $('#file-input').on('change', function() {
    let fileName = $('#file-input')[0].files.length > 0 ? $('#file-input')[0].files[0].name : null, extension, name;

    if (fileName) {
      extension = '.' + fileName.split('.').pop().toLowerCase();
      name = fileName.replace(new RegExp(extension + '$', 'i'), ''); // Strip extension from the end. Ignore the case.
    }

    // Display the name and remove it if the file doesn't exist.
    $('#file-chosen .name').text(name ? name : '');
    $('#file-chosen .extension').text(extension ? extension : '');

    if (fileName) {
      $('#file-input').addClass('has-file');

      $('#remove-file-button').css('display', 'inline-block');
    } else {
      $('#file-input').removeClass('has-file');

      $('#remove-file-button').css('display', 'none');
    }
  });

  $('#remove-file-button').click(() => {
    $('#file-input').val('').trigger('change');
  });
});
