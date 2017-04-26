class MemoryMetricsShowData
  def initialize(app_bin_id)
    @app_bin_id = app_bin_id
  end

  def fetch!
    tuples = fetch_tuples
    process_tuples tuples
  end

  private

  def fetch_tuples
    sql = <<~SQL
      SELECT
        to_timestamp(floor((extract('epoch' FROM sampled_at) / 600)) * 600) AT TIME ZONE 'UTC'
          AS interval,
        round(avg((metrics->'memory'->>'total_memory')::INTEGER))
          AS avg_total,
        round(avg((metrics->'memory'->>'free_memory')::INTEGER))
          AS avg_free
      FROM system_health_samples
      WHERE
        app_bin_id = #{ActiveRecord::Base.sanitize @app_bin_id} AND
        to_timestamp(floor((extract('epoch' FROM sampled_at) / 600)) * 600) AT TIME ZONE 'UTC' > (current_timestamp - interval '1 day') AT TIME ZONE 'UTC'
      GROUP BY interval
      ORDER BY interval ASC;
    SQL

    tuples = ActiveRecord::Base.connection.execute sql
  end

  def process_tuples(tuples)
    tuples.map do |tuple|
      [
        tuple['interval'],
        tuple['avg_free'].to_i,
        tuple['avg_total'].to_i - tuple['avg_free'].to_i
      ]
    end
  end
end
