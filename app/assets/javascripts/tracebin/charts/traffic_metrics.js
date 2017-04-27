var Tracebin = Tracebin || {};
Tracebin.charts = Tracebin.charts || {};

Tracebin.charts.trafficMetrics = {
  show: function(rawData) {
    var formattedData = rawData.map(function(row) {
      return [new Date(row[0]), row[1], row[2], row[3]];
    });

    var data = new google.visualization.DataTable();
    var options;
    var chart;

    data.addColumn('datetime', 'Interval');
    data.addColumn('number', 'Hits');
    data.addColumn('number', 'Median response');
    data.addColumn('number', 'Slow response');

    data.addRows(formattedData);

    options = {
      title: 'Traffic',
      titleTextStyle: Tracebin.chartStyles.titleText,

      height: 300,
      fontName: 'Abel',

      colors: [
        Tracebin.styles.colors.blue,
        Tracebin.styles.colors.green,
        Tracebin.styles.colors.red,
      ],

      series: {
        0: { targetAxisIndex: 0 },
        1: {
          targetAxisIndex: 1,
          type: 'line',
        },
        2: {
          targetAxisIndex: 1,
          type: 'line',
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
          title: 'Response time (ms)',
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
};
