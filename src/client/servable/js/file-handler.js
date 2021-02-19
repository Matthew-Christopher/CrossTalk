$(window).on('load', () => {
  const fileSizeLimit = 15; // Maximum file size.

  $('#file-input').on('change', function() {
    let fileName = $('#file-input')[0].files.length > 0 ? $('#file-input')[0].files[0].name : null, extension, name;
    let fileSize = $('#file-input')[0].files.length > 0 ? ($('#file-input')[0].files[0].size / (1024 ** 2)).toFixed(1) : null; // In MB at a maximum of 1dp.

    if (fileSize <= fileSizeLimit) {
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

        $('#message').focus();
      } else {
        $('#file-input').removeClass('has-file');

        $('#remove-file-button').css('display', 'none');
      }
    } else {
      $('#file-chosen .name').text('Too big! Maximum is 15MB');

      setTimeout(() => {
        $('#file-input').val('').trigger('change');
      }, 3000);
    }
  });

  $('#remove-file-button').click(() => {
    $('#file-input').val('').trigger('change');
  });
});

function HandleUpload(file) {
  console.log('Received upload request. Starting.');

  if (window.File && window.FileReader) { // The browser is up-to-date enough to allow us to do this.
    console.log('Beginning upload of file.');

    const reader = new FileReader();
    reader.onload = function() {
      const bytes = new Uint8Array(this.result);

      socket.emit('file stream', bytes);

      console.log('Sent file.');
    };
    reader.readAsArrayBuffer(file);
  }
}
