var Tracebin = Tracebin || {};

////
// Here is the logic for the charts that appear in the AppBinsController#show
// view. We've broken the functions up by their corresponding controller and
// action. For example, the function that draws the chart data for
// +MemoryMetrics#show+ is in the file
// +app/javascripts/tracebin/charts/memory_metrics.js+, and the function itself
// is namespaced under +Tracebin.charts.memoryMetrics.show()+. The function
// that draws the chart should contain the end-to-end logic needed to display
// the chart on the page. The format is as follows:
//
// *Naming*: Per above, each function is named according to its corresponding
// controller/action combination. For example, +MemoryMetricsController#show+
// corresponds to the +Tracebin.charts.memoryMetrics.show()+ function.
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
Tracebin.charts = {};
