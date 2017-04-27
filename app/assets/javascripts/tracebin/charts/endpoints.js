var Tracebin = Tracebin || {};
Tracebin.charts = Tracebin.charts || {};

Tracebin.charts.endpoints = {
  index: function(data) {
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

  show: function(rawData) {
    var formattedData = Tracebin.helpers.formatWaterfallData(rawData.data);
    var title = rawData.endpoint;
    var sampleTime = moment(rawData.sample_time).format('DD MMMM YYYY, HH:mm:ss');
    var subtitle = 'Sampled at: ' + sampleTime + ' UTC';

    var data = new google.visualization.DataTable();
    var container = this;
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
      title: title,
      titleTextStyle: Tracebin.chartStyles.titleText,

      fontName: 'Abel',

      legend: 'none',
      orientation: 'vertical',
      height: formattedData.length * 15 + 50 + 20,
      width: '100%',

      bar: { groupWidth: '80%' },

      candlestick: {
        fallingColor: { strokeWidth: 0 },
        risingColor: { strokeWidth: 0 }
      },

      chartArea: {
        width: 700,
        height: formattedData.length * 15,
        top: 50,
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

    chart = new google.visualization.CandlestickChart(container);

    Tracebin.helpers.addSubtitle(chart, container, title, subtitle);

    chart.draw(data, options);
  },
};
