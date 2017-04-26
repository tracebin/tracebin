////
// This is the globally namespaced object under which all Tracebin-related data
// should be stored. Any attributes you wish to be
var Tracebin = {
  fetch: function(options) {
    $.ajax({
      method: 'GET',
      url: window.location.pathname + '/' + options.endpoint,
      cache: false,
      dataType: 'json',
      context: options.context,

      beforeSend: Tracebin.showLoading,
      complete: Tracebin.hideLoading,
      success: options.success,
    });
  },

  showLoading: function() {
    $(this).text('');
    $(this).closest('.load-overlay').addClass('loading');
  },

  hideLoading: function() {
    $(this).closest('.load-overlay').removeClass('loading');
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
