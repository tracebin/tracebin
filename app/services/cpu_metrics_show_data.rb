class CpuMetricsShowData
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
        date_trunc('hour', ct.start) AS interval,
        round(avg((metrics->'cpu'->>'usage')::NUMERIC))
          AS usage,
      FROM system_health_samples
      WHERE
        app_bin_id = #{ActiveRecord::Base.sanitize @app_bin_id} AND
        date_trunc('hour', ct.start) > (current_timestamp - interval '1 day')
      GROUP BY interval
      ORDER BY interval ASC;
    SQL

    tuples = ActiveRecord::Base.connection.execute sql
  end

  def process_tuples(tuples)
    tuples.map do |tuple|
      [
        tuple['interval'],
        tuple['usage'].to_f.round(1)
      ]
    end
  end
end
