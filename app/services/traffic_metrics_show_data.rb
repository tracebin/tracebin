class TrafficMetricsShowData
  def initialize(app_bin_id)
    @app_bin_id = app_bin_id
  end

  def fetch!
    tuples = fetch_tuples
    process_tuples tuples
  end

  private

  def fetch_tuples
    # Per Endpoint:
    #
    # popular_ca_sql = <<~SQL
    #   SELECT
    #     data->>'controller' AS controller,
    #     data->>'action' AS action,
    #     count(*) AS hits
    #   FROM transaction_events
    #   WHERE
    #     start > (current_timestamp - interval '1 day') AND
    #     event_type = 'controller_action'
    #   GROUP BY controller, action
    #   ORDER BY hits DESC;
    # SQL
    #
    # sql = <<~SQL
    #   SELECT
    #     date_trunc('hour', ct.start) AS interval,
    #     te.data->>'controller' AS controller,
    #     te.data->>'action' AS action,
    #     count(*) AS hits
    #   FROM cycle_transactions AS ct
    #   INNER JOIN transaction_events AS te
    #     ON ct.id = te.cycle_transaction_id
    #   WHERE
    #     ct.transaction_type = 'request_response' AND
    #     te.event_type = 'controller_action'
    #   GROUP BY
    #     date_trunc('hour', ct.start),
    #     controller,
    #     action
    #   HAVING date_trunc('hour', ct.start) > (current_timestamp - interval '1 day')
    #   ORDER BY date_trunc('hour', ct.start) ASC;
    # SQL
    #
    # popular_ca = ActiveRecord::Base.connection.execute popular_ca_sql
    # disag_ca = popular_ca.to_a[0..1].map do |ca|
    #   "#{ca['controller']}##{ca['action']}"
    # end

    # All Endpoints
    #
    sql = <<~SQL
      SELECT
        date_trunc('hour', ct.start) AS interval,
        count(*) AS hits,
        quantile(duration, 0.5) AS median_response_time,
        quantile(duration, 0.95) AS ninety_fifth_percentile_response_time
      FROM cycle_transactions AS ct
      WHERE
        ct.app_bin_id = #{ActiveRecord::Base.sanitize @app_bin_id} AND
        ct.transaction_type = 'request_response' AND
        ct.start > (current_timestamp - interval '1 day')
      GROUP BY
        date_trunc('hour', ct.start)
      ORDER BY date_trunc('hour', ct.start) ASC;
    SQL

    tuples = ActiveRecord::Base.connection.execute sql
  end

  def process_tuples(tuples)
    # Per Endpoint
    #
    # c_a = {}
    #
    # tuples.each do |tuple|
    #   action = "#{tuple['controller']}##{tuple['action']}"
    #   if disag_ca.include? action
    #     c_a[action] ||= []
    #     c_a[action] << { tuple['interval'] => tuple['hits'].to_i }
    #   else
    #     c_a['other'] ||= {}
    #     if c_a['other'][:interval]
    #       c_a['other'][:interval] += tuple['hits']
    #     else
    #       c_a['other'][:interval] = tuple['hits']
    #     end
    #   end
    # end
    #
    # {
    #   columns: c_a.keys,
    #   rows:
    # }

    # All Endpoints
    #
    tuples.to_a.map do |tuple|
      [
        tuple['interval'],
        tuple['hits'],
        tuple['median_response_time'].to_f.round(3),
        tuple['ninety_fifth_percentile_response_time'].to_f.round(3)
      ]
    end
  end
end
