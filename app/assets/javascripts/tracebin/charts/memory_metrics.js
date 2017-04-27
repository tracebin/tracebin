var Tracebin = Tracebin || {};
Tracebin.charts = Tracebin.charts || {};

Tracebin.charts.memoryMetrics = {
  show: function(rawData) {
    var formattedData = rawData.map(function(row) {
      return [new Date(row[0]), row[2], row[1]];
    });

    var totalMemory = formattedData[formattedData.length - 1][1] + formattedData[formattedData.length - 1][2]

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
        Tracebin.styles.colors.blue,
        Tracebin.styles.colors.red,
      ],

      legend: {
        position: 'top',
      },

      chartArea: {
        width: 700,
      },


      vAxis: {
        title: 'MB',
        titleTextStyle: Tracebin.chartStyles.vAxisTitleText,

        textStyle: Tracebin.chartStyles.vAxisText,

        viewWindowMode: 'maximized',
        maxValue: totalMemory,
      },

      hAxis: {
        textStyle: Tracebin.chartStyles.hAxisText,
      },
      isStacked: true,
    }

    chart = new google.visualization.SteppedAreaChart(this);

    chart.draw(data, options);
  },
};
