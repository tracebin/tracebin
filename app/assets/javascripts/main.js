$(function() {
  function parseDates(data) {
    return data.map(function(sample) {
      return {
        interval: new Date(sample.interval),
        value: sample.value
      }
    });
  }

  function formatWaterfallData(data) {
    return data.map(function(row) {
      return [
        row[4],
        new Date(row[1]),
        new Date(row[1]),
        new Date(row[2]),
        new Date(row[2])
      ];
    });
  }

  function handleMemData(timeData, res) {
    var formattedData = timeData.map(function(row) {
      return [new Date(row[0]), row[1], row[2]];
    });

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
      return [new Date(row[0]), row[1], row[2]];
    });

    var data = new google.visualization.DataTable();
    var options;
    var chart;

    data.addColumn('datetime', 'Interval');
    data.addColumn('number', 'Hits');
    data.addColumn('number', 'Average response time');

    data.addRows(formattedData);

    options = {
      title: 'Traffic',

      series: {
        0: { targetAxisIndex: 0 },
        1: {
          targetAxisIndex: 1,
          type: 'line'
        }
      },

      seriesType: 'steppedArea',

      vAxis: {
        0: { title: 'Hits' },
        1: { title: 'Average response time (ms)', }
      }
    };

    chart = new google.visualization.ComboChart(document.getElementById('requests'));

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

  function handleEndpointsIndex(data) {
    $('#endpoints-index').DataTable({
      data: data,
      columns: [
        { title: 'Endpoint' },
        { title: 'Average Response Time' },
        { title: 'Hits' },
        { title: 'Avg SQL Time' },
        { title: 'Avg View Time' },
        { title: 'Avg App Time' },
        { title: 'Avg Other Time'}
      ],

      order: [[2, 'desc']],

      paging: false,
      searching: false,
      bInfo: false
    });
  }

  function getEndpointsIndex() {
    $.ajax({
      method: 'GET',
      url: window.location.pathname + '/endpoints',
      cache: false,
      dataType: 'json',

      success: handleEndpointsIndex
    });
  }

  function handleEndpointsShow(timeData) {
    var formattedData = formatWaterfallData(timeData);

    var data = new google.visualization.DataTable();
    var options;
    var chart;

    data.addColumn('string', 'Identifier');
    data.addColumn('datetime', 'StartCopy');
    data.addColumn('datetime', 'Start');
    data.addColumn('datetime', 'Stop');
    data.addColumn('datetime', 'StopCopy');

    data.addRows(formattedData);

    options = {
      legend: 'none',
      orientation: 'vertical',
      bar: { groupWidth: '100%' },
      candlestick: {
        fallingColor: { strokeWidth: 0 },
        risingColor: { strokeWidth: 0 }
      }
    };

    chart = new google.visualization.CandlestickChart(document.getElementById('endpoints-show'));
    chart.draw(data, options);
  }

  function getEndpointsShow() {
    $.ajax({
      method: 'GET',
      url: window.location.pathname + '/endpoints/VideosController%23show',
      cache: false,
      dataType: 'json',

      success: handleEndpointsShow
    });
  }

  function handleBackgroundJobsIndex(data) {
    $('#background-jobs-index').DataTable({
      data: data,
      columns: [
        { title: 'Job Name' },
        { title: 'Average Job Time' },
        { title: 'Hits' },
        { title: 'Avg SQL Time' },
        { title: 'Avg View Time' },
        { title: 'Avg App Time' },
        { title: 'Avg Other Time'}
      ],

      order: [[2, 'desc']],

      paging: false,
      searching: false,
      bInfo: false
    });
  }

  function getBackgroundJobsIndex() {
    $.ajax({
      method: 'GET',
      url: window.location.pathname + '/background_jobs',
      cache: false,
      dataType: 'json',

      success: handleBackgroundJobsIndex
    });
  }

  $.ajaxSetup({
    headers: {
      'X-CSRF-Token': $('meta[name="csrf-token"]').attr('content')
    }
  });

  google.charts.load('current', { 'packages': ['corechart'] });

  getEndpointsIndex();
  getBackgroundJobsIndex();
  google.charts.setOnLoadCallback(getEndpointsShow);
  google.charts.setOnLoadCallback(getTrafficData);
  google.charts.setOnLoadCallback(getMemData);
});
