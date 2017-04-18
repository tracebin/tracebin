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
    var formattedData = timeData.map(function(row) {
      return [new Date(row[0]), row[1], row[2]]
    });

    console.log(formattedData);

    var data = new google.visualization.DataTable();
    var options;
    var chart;

    data.addColumn('datetime', 'Interval');
    data.addColumn('number', 'Free');
    data.addColumn('number', 'Used');

    data.addRows(formattedData);

    options = {
      title: 'Memory Usage',
      vAxis: { title: 'MB' },
      isStacked: true
    }

    chart = new google.visualization.SteppedAreaChart(document.getElementById('mem-info'));

    chart.draw(data, options);
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
    var formattedData = timeData.map(function(row) {
      return [new Date(row[0]), row[1]]
    });

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

  google.charts.load('current', { 'packages': ['corechart'] });

  google.charts.setOnLoadCallback(getTrafficData);
  google.charts.setOnLoadCallback(getMemData);
});
