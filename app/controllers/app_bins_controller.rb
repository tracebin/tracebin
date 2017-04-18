class AppBinsController < ApplicationController
  before_action :set_app_bin

  def show
    endpoint_sql = <<~SQL
      SELECT c, a, event_type, AVG(tot_duration) AS avg_time_spent, ROUND(AVG(event_count)) AS avg_count, COUNT(*) AS total_requests
        FROM (
          SELECT t_id, ca.controller AS c, ca.action AS a, e.event_type, AVG(e.duration) AS avg_duration, SUM(e.duration) AS tot_duration, COUNT(e.duration) AS event_count
            FROM transaction_events AS e
            INNER JOIN (
              SELECT cycle_transaction_id AS t_id, data->>'controller' AS controller, data->>'action' AS action
                FROM transaction_events
                WHERE event_type = 'controller_action'
            ) AS ca
              ON ca.t_id = e.cycle_transaction_id
            GROUP BY t_id, ca.controller, ca.action, e.event_type
        ) AS totals
        GROUP BY c, a, event_type
        ORDER BY total_requests DESC, c, a, event_type;
    SQL

    endpoint_tuples = ActiveRecord::Base.connection.execute endpoint_sql
    @actions = {}
    endpoint_tuples.each do |tuple|
      c_a = "#{tuple['c']}##{tuple['a']}"
      @actions[c_a] ||= {}
      event_values = Hash[tuple.slice('avg_time_spent', 'avg_count', 'total_requests').
        map do |k, v|
          [k, v.to_i == v.to_f ? v.to_i : v.to_f]
        end]
        @actions[c_a][tuple['event_type']] = event_values
    end

    job_agg_sql = <<~SQL
      SELECT name AS job_name, COUNT(*) AS total_executions, AVG(duration) AS avg_duration
        FROM cycle_transactions
        WHERE transaction_type = 'background_job'
        GROUP BY name;
    SQL

    job_event_sql = <<~SQL
      SELECT job_name, event_type, ROUND(AVG(event_count)) AS avg_count, AVG(avg_event_duration) AS avg_duration_per_event, AVG(total_event_duration) AS avg_duration_per_event_type
        FROM (
          SELECT ct.id AS ct_id, ct.name AS job_name, MAX(ct.duration) AS job_duration, te.event_type, COUNT(event_type) AS event_count, MAX(te.duration) AS avg_event_duration, SUM(te.duration) AS total_event_duration
            FROM cycle_transactions AS ct
            INNER JOIN transaction_events AS te
              ON ct.id = te.cycle_transaction_id
            WHERE ct.transaction_type = 'background_job'
            GROUP BY ct_id, job_name, event_type
        ) AS events_per_job
        GROUP BY job_name, event_type;
    SQL

    job_agg_tuples = ActiveRecord::Base.connection.execute job_agg_sql
    job_event_tuples = ActiveRecord::Base.connection.execute job_event_sql

    @jobs = job_agg_tuples.map do |tuple|
      job_name = tuple['job_name']
      events = job_event_tuples.select do |event_tuple|
        event_tuple['job_name'] == job_name
      end

      sql_info = events.find { |e| e['event_type'] == 'sql' }
      avg_sql = sql_info ? sql_info['avg_duration_per_event_type'].to_f : 0.0

      view_info = events.find { |e| e['event_type'] == 'view' }
      avg_view = view_info ? view_info['avg_duration_per_event_type'].to_f : 0.0

      {
        job_name: job_name,
        total_executions: tuple['total_executions'].to_i,
        avg_duration: tuple['avg_duration'].to_f,
        avg_sql: avg_sql,
        avg_view: avg_view
      }
    end
  end

  def new
    @app_bin = AppBin.new
  end

  def create
    if @app_bin = AppBin.create
      redirect_to @app_bin.reload
    else
      render :new
    end
  end

  private

  def set_app_bin
    @app_bin = AppBin.find_by app_key: params[:id]
  end
end
