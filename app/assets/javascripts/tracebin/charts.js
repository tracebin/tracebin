var Tracebin = Tracebin || {};

////
// Here is the logic for the charts that appear in the AppBinsController#show
// view. It may be wise to eventually break this up into separate files, but
// for now it's all in one. The function should contain the end-to-end logic
//  needed to display the chart on the page. The format is as follows:
//
// *Naming*: Each function is named according to its corresponding
// controller/action combination. For example, +MemoryMetricsController#show+
// corresponds to the +memoryMetricsShow+ function.
//
// *Arguments*: The first argument for each function is the raw data that has
// been parsed by jQuery's AJAX function. This means that any dates or times
// need to be processed accordingly.
//
// *Context*: The +this+ context for any given function is the DOM element that
// will be containing the chart. For instance, the context for
// +memoryMetricsShow+ will be the element with ID +#mem-info+.
//
// *Styles and Shared Values*: Any values that look like they might be repeated
// elsewhere for consistency (e.g. fonts, styling, colors) should be stored
// outside of the charting function. For example, the hex value for the red we
// use is stored under +Tracebin.styles.colors.red+.
//
// *Helpers*: Any helper functions used should be stored in +Tracebin.helpers+.
// Since that file is explicitly included in the asset pipeline before this one,
// they will be made available here.
//
// Please refer to the relevant charting library for documentation. In general,
// here's how the charts should be styled:
//
// == Google Charts
//
//   {
//     titleTextStyle: Tracebin.chartStyles.titleText,
//     height: 300,
//     fontName: 'Abel',
//     colors: [
//       Tracebin.styles.colors.blue,
//       Tracebin.styles.colors.red,
//       Tracebin.styles.colors.green,
//       Tracebin.styles.colors.yellow
//     ], // Omit/mix/match extras as needed
//
//     legend: {
//       position: 'top',
//     },
//
//     chartArea: {
//       width: 700,
//     },
//
//     vAxis: {
//       titleTextStyle: Tracebin.chartStyles.vAxisTitleText,
//       textStyle: Tracebin.chartStyles.vAxisText,
//     },
//
//     hAxis: {
//       textStyle: Tracebin.chartStyles.hAxisText,
//     },
//   }
//
Tracebin.charts = {
  memoryMetricsShow: function(rawData) {
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

  cpuMetricsShow: function(rawData) {
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

  trafficMetricsShow: function(rawData) {
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

  endpointsIndex: function(data) {
    Tracebin.events.unbindEndpointsIndex();

    var table = $(this).DataTable({
      data: data,
      columns: [
        { title: 'Endpoint' },
        { title: 'Hits' },
        { title: 'Median Response' },
        { title: 'Slow Response' },
        { title: '% App' },
        { title: '% SQL' },
        { title: '% View' },
        { title: '% Other'}
      ],

      order: [[1, 'desc']],

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
        { title: 'Hits' },
        { title: 'Median Time' },
        { title: 'Slow Time' },
        { title: '% App' },
        { title: '% SQL' },
        { title: '% View' },
        { title: '% Other'}
      ],

      order: [[1, 'desc']],

      paging: false,
      searching: false,
      bInfo: false
    });
  },
};
