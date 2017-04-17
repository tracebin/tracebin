class TrafficMetricsController < ApplicationController
  before_action :set_app_bin

  def show
    render json: fetch_traffic_info.to_json
  end

  private

  def set_app_bin
    @app_bin = AppBin.find_by app_key: params[:app_bin_id]
  end

  def fetch_traffic_info
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

    # All Endpoints
    #

    sql = <<~SQL
      SELECT
        date_trunc('hour', ct.start) AS interval,
        count(*) AS hits
        FROM cycle_transactions AS ct
        WHERE
          ct.transaction_type = 'request_response'
        GROUP BY
          date_trunc('hour', ct.start)
        HAVING date_trunc('hour', ct.start) > (current_timestamp - interval '1 day')
        ORDER BY date_trunc('hour', ct.start) ASC;
    SQL

    # popular_ca = ActiveRecord::Base.connection.execute popular_ca_sql
    # disag_ca = popular_ca.to_a[0..1].map do |ca|
    #   "#{ca['controller']}##{ca['action']}"
    # end

    tuples = ActiveRecord::Base.connection.execute sql

    tuples.to_a.map do |tuple|
      [tuple['interval'], tuple['hits']]
    end
    # c_a = {}

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

    # {
    #   columns: c_a.keys,
    #   rows:
    # }
  end
end
