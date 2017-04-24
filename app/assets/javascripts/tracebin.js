var Tracebin = {
  fetch: function(options) {
    $.ajax({
      method: 'GET',
      url: window.location.pathname + '/' + options.endpoint,
      cache: false,
      dataType: 'json',
      context: options.context,

      success: options.success,
    });
  },
};

$(function() {
  $.ajaxSetup({
    headers: {
      'X-CSRF-Token': $('meta[name="csrf-token"]').attr('content')
    }
  });

  google.charts.load('current', { 'packages': ['corechart'] });

  Tracebin.fetch({
    endpoint: 'endpoints',
    context: document.getElementById('endpoints-index'),
    success: Tracebin.charts.endpointsIndex,
  });

  Tracebin.fetch({
    endpoint: 'background_jobs',
    context: document.getElementById('background-jobs-index'),
    success: Tracebin.charts.backgroundJobsIndex,
  });

  google.charts.setOnLoadCallback(function() {
    Tracebin.fetch({
      endpoint: 'traffic_metrics',
      context: document.getElementById('requests'),
      success: Tracebin.charts.trafficMetricsShow,
    });
  });

  google.charts.setOnLoadCallback(function() {
    Tracebin.fetch({
      endpoint: 'memory_metrics',
      context: document.getElementById('mem-info'),
      success: Tracebin.charts.memoryMetricsShow,
    });
  });
});
