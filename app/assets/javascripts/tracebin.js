var Tracebin = {};

$(function() {
  $.ajaxSetup({
    headers: {
      'X-CSRF-Token': $('meta[name="csrf-token"]').attr('content')
    }
  });

  google.charts.load('current', { 'packages': ['corechart'] });

  Tracebin.charts.fetch('endpoints', Tracebin.charts.endpointsIndex);
  Tracebin.charts.fetch('background_jobs', Tracebin.charts.backgroundJobsIndex);

  google.charts.setOnLoadCallback(function() {
    Tracebin.charts.fetch('traffic_metrics', Tracebin.charts.trafficMetricsShow);
  });

  google.charts.setOnLoadCallback(function() {
    Tracebin.charts.fetch('memory_metrics', Tracebin.charts.memoryMetricsShow);
  });
});
