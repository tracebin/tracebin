var Tracebin = Tracebin || {};

////
// Divide this code up with comments like this:
//
//   // ====--------------------------====
//   // Header
//   // ====--------------------------====
//
// We can break up/namespace this object later on.
//
Tracebin.helpers = {
  // ====--------------------------====
  // Chart Components
  // ====--------------------------====

  addSubtitle: function(chart, container, titleText, subtitle) {
    google.visualization.events.addListener(chart, 'ready', function() {
      Array.prototype.forEach.call(container.getElementsByTagName('text'), function(labelNode) {
        if (labelNode.innerHTML === titleText) {
          var subNode = labelNode.parentNode.appendChild(labelNode.cloneNode(true));
          labelNode.setAttribute('y', 20);
          subNode.innerHTML = subtitle;
          subNode.setAttribute('y', parseFloat(labelNode.getAttribute('y')) + 20);
          subNode.setAttribute('style', Tracebin.chartStyles.subtitleTextStyle);
        }
      });
    });
  },

  // ====--------------------------====
  // AJAX Presentation Helpers
  // ====--------------------------====

  showLoading: function() {
    $(this).text('');
    $(this).closest('.load-overlay').addClass('loading');
  },

  hideLoading: function() {
    $(this).closest('.load-overlay').removeClass('loading');
  },

  // ====--------------------------====
  // Text Formatters
  // ====--------------------------====

  prettifySQLText: function(text) {
    var sqlRegex = /(select |insert |update |delete ).*(from |into |table )[\"\']?([^\"\'\s]*)/i
    var matches = text.match(sqlRegex);

    if (matches) {
      return matches[1] + matches[2] + matches[3];
    } else {
      return text;
    }
  },

  prettifyViewText: function(text) {
    var viewRegex = /\/views\/(.*)/;
    var matchedPath = text.match(viewRegex);

    if (matchedPath) {
      return matchedPath[1];
    } else {
      return text;
    }
  },

  // ====--------------------------====
  // Waterfall helpers
  // ====--------------------------====

  formatWaterfallData: function(rawData) {
    return rawData.map(function(row) {
      return [
        row[4],
        row[1],
        row[1],
        row[2],
        row[2],
        Tracebin.helpers.waterfallStyle(row),
        Tracebin.helpers.waterfallTooltip(row),
      ];
    });
  },

  waterfallStyle: function(row) {
    var waterfallStyles = {
      'transaction': {
        'single': 'color: ' + Tracebin.styles.colors.red,
        'multiple': 'color: ' + Tracebin.styles.colors.red,
      },

      'endpoint': {
        'single': 'color: ' + Tracebin.styles.colors.red,
        'multiple': 'color: ' + Tracebin.styles.colors.red,
      },

      'sql': {
        'single': 'color: ' + Tracebin.styles.colors.blue,
        'multiple': 'color: ' + Tracebin.styles.colors.green,
        'sqlTransaction': 'color: ' + Tracebin.styles.colors.lightBlue,
      },

      'view': {
        'single': 'color: ' + Tracebin.styles.colors.yellow,
        'multiple': 'color: ' + Tracebin.styles.colors.orange,
      },
    };

    var styleObj = waterfallStyles[row[0]];

    if (row[0] === 'sql' && Tracebin.helpers.isSqlTransaction(row[4])) {
      return styleObj['sqlTransaction'];
    } else if (row[3] <= 1) {
      return styleObj['single'];
    } else {
      return styleObj['multiple'];
    }
  },

  waterfallTooltip: function(row) {
    var nPlusOne = row[3] > 1;
    var identifier = Tracebin.helpers.waterfallTooltipIdentifier(row[0], row[4]);
    var duration = row[2] - row[1];
    duration = Math.round(duration * 100.0) / 100.0;

    return identifier +
      " (" + (duration ? duration : '< 1') + "ms)" +
      (nPlusOne ? ' - n+1' : '');
  },

  waterfallTooltipIdentifier: function(type, identifier) {
    if (type === 'sql') {
      return Tracebin.helpers.prettifySQLText(identifier);
    } else if (type === 'view') {
      return Tracebin.helpers.prettifyViewText(identifier);
    } else {
      return identifier;
    }
  },

  isSqlTransaction: function(query) {
    return query.match(/^begin/i) || query.match(/^commit/i);
  },
};
