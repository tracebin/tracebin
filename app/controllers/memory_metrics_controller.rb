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
    MemoryMetricsShowData.new(@app_bin.id).fetch!
  end
end
