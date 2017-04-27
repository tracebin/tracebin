var Tracebin = Tracebin || {};

Tracebin.events = {
  unbindEndpointsIndex: function() {
    $('#endpoints-index tbody').off('click');
  },

  bindEndpointsIndex: function(table) {
    $('#endpoints-index tbody').on('click', 'tr', function() {
      var data = table.row(this).data();
      var endpoint = encodeURIComponent(data[0]);

      Tracebin.fetch({
        endpoint: 'endpoints/' + endpoint,
        context: document.getElementById('endpoints-show'),
        success: Tracebin.charts.endpoints.show,
      });
    });
  },
};
