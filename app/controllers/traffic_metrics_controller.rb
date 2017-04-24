class TrafficMetricsController < ApplicationController
  before_action :set_app_bin

  def show
    render json: fetch_traffic_info.to_json
  end

  private

  def set_app_bin
    @app_bin = AppBin.find_by app_key: params[:app_bin_id]
  end

  def fetch_traffic_info
    TrafficMetricsShowData.new(@app_bin.id).fetch!
  end
end
