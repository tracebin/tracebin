class MemoryMetricsController < ApplicationController
  before_action :set_app_bin

  def show
    info = fetch_memory_info
    render json: fetch_memory_info.to_json
  end

  private

  def set_app_bin
    @app_bin = AppBin.find_by app_key: params[:app_bin_id]
  end


  def fetch_memory_info
    sql = <<~SQL
      WITH blank_intervals AS (
        SELECT
          interval,
          0 AS blank_val
          FROM generate_series('2017-04-15 09:40', current_timestamp, '10 minutes') AS interval
      ),
      active_intervals AS (
        SELECT
          to_timestamp(floor((extract('epoch' FROM sampled_at) / 600)) * 600)
            AS interval,
          round(avg((metrics->'memory'->>'total_memory')::INTEGER))
            AS avg_total,
          round(avg((metrics->'memory'->>'free_memory')::INTEGER))
            AS avg_free
          FROM system_health_samples
          GROUP BY interval
          ORDER BY interval ASC
      )
      SELECT
        blank_intervals.interval,
        coalesce(active_intervals.avg_total, blank_intervals.blank_val)
          AS avg_total,
        coalesce(active_intervals.avg_free, blank_intervals.blank_val)
          AS avg_free
        FROM blank_intervals
        LEFT JOIN active_intervals
          ON blank_intervals.interval = active_intervals.interval
        ORDER BY blank_intervals.interval ASC;
    SQL

    tuples = ActiveRecord::Base.connection.execute sql

    tuples.map do |tuple|
      {
        d: tuple['interval'],
        used: tuple['avg_total'].to_i - tuple['avg_free'].to_i
      }
    end
  end
end
