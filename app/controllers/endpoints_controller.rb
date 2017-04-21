class EndpointsController < ApplicationController
  before_action :set_app_bin

  def index
    render json: fetch_endpoints_stats.to_json
  end

  def show
    render json: fetch_endpoint_stats(params[:id]).to_json
  end

  private

  def set_app_bin
    @app_bin = AppBin.find_by app_key: params[:app_bin_id]
  end

  def fetch_endpoints_stats
    sql = <<~SQL
      SELECT
        name AS endpoint,
        avg(duration) AS avg_duration,
        count(*) AS hits,
        avg((
          SELECT sum(duration)
          FROM jsonb_to_recordset(events->'sql') AS x(duration NUMERIC)
        )) AS avg_time_in_sql,
        avg((
          SELECT sum(duration)
          FROM jsonb_to_recordset(events->'view') AS x(duration NUMERIC)
        )) AS avg_time_in_view,
        avg((
          SELECT sum(duration)
          FROM
            jsonb_to_recordset(events->'controller_action')
              AS x(duration NUMERIC)
        )) AS avg_time_in_controller,
        avg((
          SELECT sum(duration)
          FROM jsonb_to_recordset(events->'other') AS x(duration NUMERIC)
        )) AS avg_time_in_other
      FROM cycle_transactions
      WHERE
        app_bin_id = #{ActiveRecord::Base.sanitize @app_bin.id} AND
        transaction_type = 'request_response' AND
        name <> 'RackTransaction' AND
        start > (current_timestamp - interval '1 day')
      GROUP BY endpoint
      ORDER BY hits DESC;
    SQL

    tuples = ActiveRecord::Base.connection.execute sql

    tuples.to_a.map do |tuple|
      [
        tuple['endpoint'],
        tuple['avg_duration'].to_f.round(2),
        tuple['hits'],
        tuple['avg_time_in_sql'].to_f.round(2),
        tuple['avg_time_in_view'].to_f.round(2),
        tuple['avg_time_in_controller'].to_f.round(2),
        tuple['avg_time_in_other'].to_f.round(2)
      ]
    end
  end

  def fetch_endpoint_stats(endpoint_id)
    transaction_sql = <<~SQL
      SELECT
        'transaction' AS event_type,
        start,
        stop,
        1 AS count,
        'Rack Transaction' AS identifier
      FROM cycle_transactions
      WHERE
        app_bin_id = #{ActiveRecord::Base.sanitize @app_bin.id} AND
        name = #{ActiveRecord::Base.sanitize endpoint_id}
      ORDER BY id DESC
      LIMIT 1;
    SQL

    endpoint_sql = <<~SQL
      SELECT
        'endpoint' AS event_type,
        min(start) AS start,
        max(stop) AS stop,
        count(*),
        ((data->>'controller') || '#') || (data->>'action') AS identifier
      FROM transaction_events
      WHERE
        cycle_transaction_id = (
          SELECT id
          FROM cycle_transactions
          WHERE
            app_bin_id = #{ActiveRecord::Base.sanitize @app_bin.id} AND
            name = #{ActiveRecord::Base.sanitize endpoint_id}
          ORDER BY id DESC
          LIMIT 1
        ) AND
        event_type = 'controller_action'
      GROUP BY identifier;
    SQL

    sql_sql = <<~SQL
      SELECT
        'sql' AS event_type,
        start,
        stop,
        1 AS count,
        data->>'sql' AS identifier
      FROM transaction_events
      WHERE
        cycle_transaction_id = (
          SELECT id
          FROM cycle_transactions
          WHERE
            app_bin_id = #{ActiveRecord::Base.sanitize @app_bin.id} AND
            name = #{ActiveRecord::Base.sanitize endpoint_id}
          ORDER BY id DESC
          LIMIT 1
        ) AND
        event_type = 'sql';
    SQL

    view_sql = <<~SQL
      SELECT
        'view' AS event_type,
        min(start) AS start,
        max(stop) AS stop,
        count(*),
        data->>'identifier' AS identifier
      FROM transaction_events
      WHERE
        cycle_transaction_id = (
          SELECT id
          FROM cycle_transactions
          WHERE
            app_bin_id = #{ActiveRecord::Base.sanitize @app_bin.id} AND
            name = #{ActiveRecord::Base.sanitize endpoint_id}
          ORDER BY id DESC
          LIMIT 1
        ) AND
        event_type = 'view'
      GROUP BY identifier;
    SQL

    transaction_tuples = ActiveRecord::Base.connection.execute transaction_sql
    endpoint_tuples = ActiveRecord::Base.connection.execute endpoint_sql
    sql_tuples = ActiveRecord::Base.connection.execute sql_sql
    view_tuples = ActiveRecord::Base.connection.execute view_sql

    all_events = (transaction_tuples.to_a.map(&:values) +
      endpoint_tuples.to_a.map(&:values) +
      sql_tuples.to_a.map(&:values) +
      view_tuples.to_a.map(&:values)).sort_by do |tuple|
        tuple[1].to_datetime.to_f
    end

    first_start = all_events[0][1].to_datetime.to_f

    all_events.each_with_object([]) do |event, a|
      if a.last && a.last[4] == event[4]
        a.last[2] = (event[2].to_datetime.to_f - first_start) * 1000
        a.last[3] += event[3]
      else
        a << [
            event[0],
            (event[1].to_datetime.to_f - first_start) * 1000,
            (event[2].to_datetime.to_f - first_start) * 1000,
            event[3].to_i,
            event[4]
          ]
      end
    end
  end
end
