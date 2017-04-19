class BackgroundJobsController < ApplicationController
  before_action :set_app_bin

  def index
    render json: fetch_background_job_stats.to_json
  end

  private

  def set_app_bin
    @app_bin = AppBin.find_by app_key: params[:app_bin_id]
  end

  def fetch_background_job_stats
    sql = <<~SQL
      SELECT
        name AS job_name,
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
        transaction_type = 'background_job' AND
        start > (current_timestamp - interval '1 day')
      GROUP BY job_name
      ORDER BY hits DESC;
    SQL

    tuples = ActiveRecord::Base.connection.execute sql

    tuples.to_a.map do |tuple|
      [
        tuple['job_name'],
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
