class MemoryMetricsController < ApplicationController
  before_action :set_app_bin

  def show
    render json: fetch_memory_info.to_json
  end

  private

  def set_app_bin
    @app_bin = AppBin.find_by app_key: params[:app_bin_id]
  end

  def fetch_memory_info
    sql = <<~SQL
      SELECT
        to_timestamp(floor((extract('epoch' FROM sampled_at) / 600)) * 600)
          AS interval,
        round(avg((metrics->'memory'->>'total_memory')::INTEGER))
          AS avg_total,
        round(avg((metrics->'memory'->>'free_memory')::INTEGER))
          AS avg_free
        FROM system_health_samples
        WHERE to_timestamp(floor((extract('epoch' FROM sampled_at) / 600)) * 600) > (current_timestamp - interval '1 day')
        GROUP BY interval
        ORDER BY interval ASC;
    SQL

    tuples = ActiveRecord::Base.connection.execute sql

    tuples.map do |tuple|
      {
        interval: tuple['interval'],
        value: tuple['avg_total'].to_i - tuple['avg_free'].to_i
      }
    end
  end
end
