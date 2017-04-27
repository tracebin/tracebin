var Tracebin = Tracebin || {};
Tracebin.charts = Tracebin.charts || {};

Tracebin.charts.backgroundJobs = {
  index: function(data) {
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
