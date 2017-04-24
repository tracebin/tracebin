var Tracebin = Tracebin || {};

Tracebin.events = {
  unbindEndpointsIndex: function() {
    $('#endpoints-index tbody').off('click');
  },

  bindEndpointsIndex: function(table) {
    $('#endpoints-index tbody').on('click', 'tr', function() {
      var data = table.row(this).data();
      var endpoint = encodeURIComponent(data[0]);

      Tracebin.charts.fetch('endpoints/' + endpoint, Tracebin.charts.endpointsShow);
    });
  },
};
