class AppBinsController < ApplicationController
  before_action :set_app_bin

  def show
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
