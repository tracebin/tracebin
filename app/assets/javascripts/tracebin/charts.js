var Tracebin = Tracebin || {};

Tracebin.charts = {
  memoryMetricsShow: function(rawData) {
    var formattedData = rawData.map(function(row) {
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
      titleTextStyle: Tracebin.chartStyles.titleText,

      height: 300,
      fontName: 'Abel',

      colors: [
        '#1F6DA9',
        '#E04650'
      ],

      legend: {
        position: 'top'
      },

      chartArea: {
        width: 700,
      },

      vAxis: {
        title: 'MB',
        titleTextStyle: Tracebin.chartStyles.vAxisTitleText,

        textStyle: Tracebin.chartStyles.vAxisText,
      },

      hAxis: {
        textStyle: Tracebin.chartStyles.hAxisText,
      },
      isStacked: true
    }

    chart = new google.visualization.SteppedAreaChart(this);

    chart.draw(data, options);
  },

  trafficMetricsShow: function(rawData) {
    var formattedData = rawData.map(function(row) {
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
      titleTextStyle: Tracebin.chartStyles.titleText,

      height: 300,
      fontName: 'Abel',

      colors: [
        Tracebin.styles.colors.blue,
        Tracebin.styles.colors.red,
      ],

      series: {
        0: { targetAxisIndex: 0 },
        1: {
          targetAxisIndex: 1,
          type: 'line'
        }
      },

      seriesType: 'steppedArea',

      chartArea: {
        width: 700,
      },

      vAxes: {
        0: {
          title: 'Hits',
          titleTextStyle: Tracebin.chartStyles.vAxisTitleText,

          textStyle: Tracebin.chartStyles.vAxisText,
        },
        1: {
          title: 'Average response time (ms)',
          titleTextStyle: Tracebin.chartStyles.vAxisTitleText,

          textStyle: Tracebin.chartStyles.vAxisText,

          minValue: 0,
        }
      },

      hAxis: {
        textStyle: Tracebin.chartStyles.hAxisText,
      }

    };

    chart = new google.visualization.ComboChart(this);

    chart.draw(data, options);
  },

  endpointsIndex: function(data) {
    Tracebin.events.unbindEndpointsIndex();

    var table = $(this).DataTable({
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

    Tracebin.events.bindEndpointsIndex(table);
  },

  endpointsShow: function(rawData) {
    var formattedData = Tracebin.helpers.formatWaterfallData(rawData.data);

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
      title: rawData.endpoint,
      titleTextStyle: Tracebin.chartStyles.titleText,
      fontName: 'Abel',

      legend: 'none',
      orientation: 'vertical',
      height: formattedData.length * 15 + 70,
      width: '100%',

      bar: { groupWidth: '80%' },

      candlestick: {
        fallingColor: { strokeWidth: 0 },
        risingColor: { strokeWidth: 0 }
      },

      chartArea: {
        width: 700,
        height: formattedData.length * 15,
      },

      hAxis: {
        minValue: formattedData[0][1],
        maxValue: formattedData[0][4],

        viewWindowMode: 'maximized',

        format: '#ms',
        textStyle: Tracebin.chartStyles.hAxisText,
      },

      vAxis: {
        textPosition: 'none',
        fontSize: 1,
      },
    };

    chart = new google.visualization.CandlestickChart(document.getElementById('endpoints-show'));
    chart.draw(data, options);
  },

  backgroundJobsIndex: function(data) {
    $(this).DataTable({
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
  },
};
