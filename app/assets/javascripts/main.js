$(function() {
  function parseDates(data) {
    return data.map(function(sample) {
      return {
        interval: new Date(sample.interval),
        value: sample.value
      }
    });
  }

  function handleMemData(timeData, res) {
    timeData = parseDates(timeData);

    MG.data_graphic({
      title: 'Memory Usage',
      description: 'This is a chart of the amount of memory you\'ve used over a span of time.',
      data: timeData,
      width: 600,
      height: 200,
      right: 40,
      target: document.getElementById('mem-info'),
      x_accessor: 'interval',
      y_accessor: 'value',
      y_label: 'MB'
    });
  }

  function getMemData() {
    $.ajax({
      method: 'GET',
      url: window.location.pathname + '/memory_metrics',
      cache: false,
      dataType: 'json',

      success: handleMemData
    });
  }

  function handleTrafficData(timeData, res) {
    formattedData = timeData.map(function(row) {
      return [new Date(row[0]), row[1]]
    });

    google.charts.load('current', { 'packages': ['corechart'] });
    google.charts.setOnLoadCallback(drawChart);

    function drawChart() {
      var data = new google.visualization.DataTable();
      var options;
      var chart;

      data.addColumn('datetime', 'Interval');
      data.addColumn('number', 'Hits');

      data.addRows(formattedData);

      options = {
        title: 'Traffic',
        vAxis: { title: 'Hits' }
      }

      chart = new google.visualization.SteppedAreaChart(document.getElementById('requests'));

      chart.draw(data, options);
    }
  }

  function getTrafficData() {
    $.ajax({
      method: 'GET',
      url: window.location.pathname + '/traffic_metrics',
      cache: false,
      dataType: 'json',

      success: handleTrafficData
    });
  }

  $.ajaxSetup({
    headers: {
      'X-CSRF-Token': $('meta[name="csrf-token"]').attr('content')
    }
  });

  getTrafficData();
  getMemData();
});
