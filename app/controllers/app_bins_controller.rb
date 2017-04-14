class AppBinsController < ApplicationController
  before_action :set_app_bin

  def show
    sql = <<~SQL
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

    tuples = ActiveRecord::Base.connection.execute sql
    @actions = {}
    tuples.each do |tuple|
      c_a = "#{tuple['c']}##{tuple['a']}"
      @actions[c_a] ||= {}
      event_values = Hash[tuple.slice('avg_time_spent', 'avg_count', 'total_requests').
        map do |k, v|
          [k, v.to_i == v.to_f ? v.to_i : v.to_f]
        end]
      @actions[c_a][tuple['event_type']] = event_values
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
