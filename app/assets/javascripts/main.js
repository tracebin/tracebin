$(function() {
  function displayMemData(data) {
    console.log(data);
    data = MG.convert.date(data, 'd');
    console.log(data);

    MG.data_graphic({
      title: 'Memory Usage',
      description: 'This is a chart of the amount of memory you\'ve used over a span of time.',
      data: data,
      width: 600,
      height: 200,
      right: 40,
      target: document.getElementById('mem-info'),
      x_accessor: 'd',
      y_accessor: 'used',
      y_label: 'MB'
    });
  }

  function getMemData() {
    // d3.json(window.location.pathname + '/memory_metrics', displayMemData)
    $.ajax({
      method: 'GET',
      url: window.location.pathname + '/memory_metrics',
      cache: false
    }).done(displayMemData);
  }

  $.ajaxSetup({
    headers: {
      'X-CSRF-Token': $('meta[name="csrf-token"]').attr('content')
    }
  });

  getMemData();
});

// $(function() {
//   var ctx = $('#myChart');

//   chartData = [12, 19, 3, 5, 2, 3];
//   myChart = new Chart(ctx, {
//     type: 'bar',
//     data: {
//       labels: ["Red", "Blue", "Yellow", "Green", "Purple", "Orange"],
//       datasets: [{
//         label: '# of Votes',
//         data: chartData,
//         backgroundColor: [
//           'rgba(255, 99, 132, 0.2)',
//           'rgba(54, 162, 235, 0.2)',
//           'rgba(255, 206, 86, 0.2)',
//           'rgba(75, 192, 192, 0.2)',
//           'rgba(153, 102, 255, 0.2)',
//           'rgba(255, 159, 64, 0.2)'
//         ],
//         borderColor: [
//           'rgba(255,99,132,1)',
//           'rgba(54, 162, 235, 1)',
//           'rgba(255, 206, 86, 1)',
//           'rgba(75, 192, 192, 1)',
//           'rgba(153, 102, 255, 1)',
//           'rgba(255, 159, 64, 1)'
//         ],
//         borderWidth: 1
//       }]
//     },
//     options: {
//       scales: {
//         yAxes: [{
//           ticks: {
//             beginAtZero:true
//           }
//         }]
//       }
//     }
//   });
// });
