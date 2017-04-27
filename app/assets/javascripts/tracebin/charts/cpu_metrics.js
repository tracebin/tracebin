var Tracebin = Tracebin || {};
Tracebin.charts = Tracebin.charts || {};

Tracebin.charts.cpuMetrics = {
  show: function(rawData) {
    var formattedData = rawData.map(function(row) {
      return [new Date(row[0]), row[1] * 100];
    });

    var data = new google.visualization.DataTable();
    var options;
    var chart;

    data.addColumn('datetime', 'Interval');
    data.addColumn('number', 'Usage');

    data.addRows(formattedData);

    options = {
      title: 'CPU Usage',
      titleTextStyle: Tracebin.chartStyles.titleText,

      height: 300,
      fontName: 'Abel',

      colors: [
        Tracebin.styles.colors.blue,
      ],

      legend: {
        position: 'top',
      },

      chartArea: {
        width: 700,
      },

      vAxis: {
        title: 'Percent',
        titleTextStyle: Tracebin.chartStyles.vAxisTitleText,

        textStyle: Tracebin.chartStyles.vAxisText,

        maxValue: 100,
      },

      hAxis: {
        textStyle: Tracebin.chartStyles.hAxisText,
      },
    };

    chart = new google.visualization.LineChart(this);

    chart.draw(data, options);
  },
};
