////
// This is the globally namespaced object under which all Tracebin-related data
// should be stored. Any attributes you wish to add should be added in separate
// files. For example, the +Tracebin.styles+ object should be in
// +tracebin/styles.js+.
//
// For the sake of things not breaking completely, each one of those files
// should have this straight at the top:
//
//   var Tracebin = Tracebin || {};
//
// Then we can define the object accordingly:
//
//   Tracebin.foo = { ... };
//
// Remember to add any new JS files to the +application.js+ manifest!
//
var Tracebin = {
  fetch: function(options) {
    $.ajax({
      method: 'GET',
      url: window.location.pathname + '/' + options.endpoint,
      cache: false,
      dataType: 'json',
      context: options.context,

      beforeSend: Tracebin.helpers.showLoading,
      complete: Tracebin.helpers.hideLoading,
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
