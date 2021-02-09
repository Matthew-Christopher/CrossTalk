$(window).on("load", () => {
  // Get the GroupID.
  let searchParams = new URLSearchParams(window.location.search);

  if (searchParams.has('GroupID')) {
    // Get the group data.
    $.ajax({
      type: "POST",
      url: "/api/GetGroupData",
      data: {
        GroupID: searchParams.get('GroupID')
      },
      success: (data) => {
        let stats = $.parseJSON(data);

        $('#data-container > .title').text(stats.groupName);

        $('#users-readout').text(stats.members.length);
        $('#online-users-readout').text(stats.members.filter(element => element.Online).length);
        $('#messages-sent-readout').text(CountMessages(stats.messages));

        let sevenDayActivity = GetPrevious7DayMessages(stats.messages, stats.currentServerDate);

        let messageChartContext = $('#messages-over-time-chart')[0].getContext('2d');

        Chart.defaults.global.defaultFontFamily = "'Work Sans', sans-serif";
        let messageChart = new Chart(messageChartContext, {
          type: 'line',
          data: {
            labels: sevenDayActivity.map(element => element.date), // Extract just the dates.
            datasets: [{
              label: 'Number of Messages',
              data: sevenDayActivity.map(element => element.messagesToday), // Extract just the number of messages on each day.
              backgroundColor: '#ff6384',
              borderColor: '#ff6384',
              borderWidth: 1,
              fill: false
            }]
          },
          options: {
            responsive: false,
            title: {
              display: true,
              text: 'Message Activity Over the Previous 7 Days',
              fontSize: 20,
              fontStyle: 'normal'
            },
            tooltips: {
              mode: 'index',
              intersect: false,
            },
            hover: {
              mode: 'nearest',
              intersect: true
            },
            scales: {
              xAxes: [{
                display: true,
                ticks: {
                  fontSize: 14
                },
                scaleLabel: {
                  display: true,
                  labelString: 'Date',
                  fontSize: 14
                }
              }],
              yAxes: [{
                display: true,
                ticks: {
                  beginAtZero: true,
                  fontSize: 14
                },
                scaleLabel: {
                  display: true,
                  labelString: 'Number of Messages',
                  fontSize: 14
                }
              }]
            },
            legend: {
              display: false
            },
            animation: {
              duration: 0
            }
          }
        });
      },
      failure: () => {
        console.error("Could not group data. Try again later.");
      }
    });
  }
});

function CountMessages(messages) {
  let result = 0;

  for (let i = 0; i < messages.length; ++i) {
    result += messages[i].MessagesToday;
  }

  return result;
}

function GetPrevious7DayMessages(messages, today) {
  let result = [];

  let providedMessagesToday = messages.map(element => element.MessagesToday) // Extract just the number of messages per day that we are given by the server.
  let providedTimes = messages.map(element => new Date(element.MessageBlockDay).getTime()) // Extract just the dates we are given by the server.

  for (let daysAgo = 6; daysAgo >= 0; --daysAgo) { // Go in this order so we get today on the right of the graph.
    let newDay = new Date(today);
    newDay.setDate(newDay.getDate() - daysAgo) // Get the date for daysAgo.

    result.push({
      date: newDay.toLocaleDateString(),
      messagesToday: providedTimes.includes(newDay.getTime()) ? providedMessagesToday[providedTimes.indexOf(newDay.getTime())] : 0 // We must compare by the numerical value of getTime to get a match as dates are compared by reference, not value.
    });
  }

  return result;
}
