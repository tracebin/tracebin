class EndpointsController < ApplicationController
  before_action :set_app_bin

  def index
    render json: fetch_endpoint_stats.to_json
  end

  private

  def set_app_bin
    @app_bin = AppBin.find_by app_key: params[:app_bin_id]
  end

  def fetch_endpoint_stats
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
end
