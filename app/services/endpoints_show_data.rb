class EndpointsShowData
  attr_reader :app_bin_id, :endpoint_id

  def initialize(app_bin_id, endpoint_id)
    @app_bin_id = app_bin_id
    @endpoint_id = endpoint_id
  end

  def fetch!
    tuples = fetch_tuples.map(&:to_a).flatten.map(&:values).sort_by do |tuple|
      tuple[1].to_datetime.to_f
    end

    first_start = tuples[0][1].to_datetime.to_f

    data = tuples.each_with_object([]) do |event, a|
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

    {
      endpoint: endpoint_id,
      sample_time: tuples[0][1].to_datetime,
      data: data
    }
  end

  private

  def fetch_tuples
    transaction_sql = <<~SQL
      SELECT
        'transaction' AS event_type,
        start,
        stop,
        1 AS count,
        'Rack Transaction' AS identifier
      FROM cycle_transactions
      WHERE
        app_bin_id = #{ActiveRecord::Base.sanitize app_bin_id} AND
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
            app_bin_id = #{ActiveRecord::Base.sanitize app_bin_id} AND
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
            app_bin_id = #{ActiveRecord::Base.sanitize app_bin_id} AND
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
            app_bin_id = #{ActiveRecord::Base.sanitize app_bin_id} AND
            name = #{ActiveRecord::Base.sanitize endpoint_id}
          ORDER BY id DESC
          LIMIT 1
        ) AND
        event_type = 'view'
      GROUP BY identifier;
    SQL

    other_sql = <<~SQL
      SELECT
        'other' AS event_type,
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
            app_bin_id = #{ActiveRecord::Base.sanitize app_bin_id} AND
            name = #{ActiveRecord::Base.sanitize endpoint_id}
          ORDER BY id DESC
          LIMIT 1
        ) AND
        event_type = 'other'
      GROUP BY identifier;
    SQL

    [
      ActiveRecord::Base.connection.execute(transaction_sql),
      ActiveRecord::Base.connection.execute(endpoint_sql),
      ActiveRecord::Base.connection.execute(sql_sql),
      ActiveRecord::Base.connection.execute(view_sql),
      ActiveRecord::Base.connection.execute(other_sql)
    ]
  end
end
