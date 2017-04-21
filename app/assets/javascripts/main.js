$(function() {
  function parseDates(data) {
    return data.map(function(sample) {
      return {
        interval: new Date(sample.interval),
        value: sample.value
      }
    });
  }

  function getWaterfallStyle(row) {
    var waterfallStyles = {
      'transaction': {
        'single': 'color: red',
        'multiple': 'color: red'
      },

      'endpoint': {
        'single': 'color: red',
        'multiple': 'color: red'
      },

      'sql': {
        'single': 'color: teal',
        'multiple': 'color: blue'
      },

      'view': {
        'single': 'yellow',
        'multiple': 'yellow'
      },
    };

    var styleObj = waterfallStyles[row[0]];

    if (row[3] <= 1) {
      return styleObj['single'];
    } else {
      return styleObj['multiple'];
    }
  }

  function prettifySQL(query) {
    var sqlRegex = /(select |insert |update ).*(from |into |table )[\"\']?([^\"\'\s]*)/i
    var matches = query.match(sqlRegex);
    return matches[1] + matches[2] + matches[3];
  }

  function prettifyViewTemplate(templatePath) {
    var viewRegex = /\/views\/(.*)/;
    var matchedPath = templatePath.match(viewRegex);

    if (matchedPath) {
      return matchedPath[1];
    } else {
      return templatePath;
    }
  }

  function waterfallTooltipIdentifier(type, identifier) {
    if (type === 'sql') {
      return prettifySQL(identifier);
    } else if (type === 'view') {
      return prettifyViewTemplate(identifier);
    } else {
      return identifier;
    }
  }

  function getWaterfallTooltip(row) {
    var nPlusOne = row[3] > 1 ? ' <N+1>' : ''
    return waterfallTooltipIdentifier(row[0], row[4]) + nPlusOne;
  }

  function formatWaterfallData(data) {
    return data.map(function(row) {
      return [
        row[4],
        row[1],
        row[1],
        row[2],
        row[2],
        getWaterfallStyle(row),
        getWaterfallTooltip(row),
      ];
    });
  }

  function handleMemData(timeData, res) {
    var formattedData = timeData.map(function(row) {
      return [new Date(row[0]), row[2], row[1]];
    });

    var data = new google.visualization.DataTable();
    var options;
    var chart;

    data.addColumn('datetime', 'Interval');
    data.addColumn('number', 'Used');
    data.addColumn('number', 'Free');

    data.addRows(formattedData);

    options = {
      title: 'Memory Usage',
      titleTextStyle: chartTitleTextStyle,

      height: 300,
      fontName: 'Abel',

      legend: {
        position: 'top'
      },

      vAxis: {
        title: 'MB',
        titleTextStyle: chartVAxisTitleTextStyle,

        textStyle: chartVAxisTextStyle,
      },

      hAxis: {
        textStyle: chartHAxisTextStyle,
      },
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
      titleTextStyle: chartTitleTextStyle,

      height: 300,
      fontName: 'Abel',

      series: {
        0: { targetAxisIndex: 0 },
        1: {
          targetAxisIndex: 1,
          type: 'line'
        }
      },

      seriesType: 'steppedArea',

      vAxes: {
        0: {
          title: 'Hits',
          titleTextStyle: chartVAxisTitleTextStyle,

          textStyle: chartVAxisTextStyle,
        },
        1: {
          title: 'Average response time (ms)',
          titleTextStyle: chartVAxisTitleTextStyle,

          textStyle: chartVAxisTextStyle,

          minValue: 0,
        }
      },

      hAxis: {
        textStyle: chartHAxisTextStyle,
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
    data.addColumn('number', 'Start');
    data.addColumn('number', 'Start');
    data.addColumn('number', 'Stop');
    data.addColumn('number', 'Stop');
    data.addColumn({ type: 'string', role: 'style' });
    data.addColumn({ type: 'string', role: 'tooltip' });

    data.addRows(formattedData);

    options = {
      legend: 'none',
      orientation: 'vertical',
      height: 400,
      bar: { groupWidth: '80%' },
      candlestick: {
        fallingColor: { strokeWidth: 0 },
        risingColor: { strokeWidth: 0 }
      },

      hAxis: {
        minValue: formattedData[0][1],
        maxValue: formattedData[0][4],

        viewWindowMode: 'maximized',

        // gridlines: {
        //   units: 'ms',
        // },

        textStyle: chartHAxisTextStyle,
      },

      vAxis: {
        textPosition: 'none',
        fontSize: 0
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

  var chartTitleTextStyle = {
    color: '#888',
    fontName: 'Oxygen',
    fontSize: 22,
    bold: false,
  };

  var chartVAxisTitleTextStyle = {
    color: '#888',
    fontName: 'Abel',
    fontSize: 16,
    bold: false,
  };

  var chartVAxisTextStyle = {
    color: '#666',
    fontName: 'Abel',
  };

  var chartHAxisTextStyle = chartVAxisTextStyle;

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
