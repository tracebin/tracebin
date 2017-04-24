class EndpointsController < ApplicationController
  before_action :set_app_bin

  def index
    render json: fetch_endpoints_stats.to_json
  end

  def show
    endpoint = params[:id]
    render json: {
      endpoint: endpoint,
      data: fetch_endpoint_stats(endpoint)
    }.to_json
  end

  private

  def set_app_bin
    @app_bin = AppBin.find_by app_key: params[:app_bin_id]
  end

  def fetch_endpoints_stats
    EndpointsIndexData.new(@app_bin.id).fetch!
  end

  def fetch_endpoint_stats(endpoint_id)
    EndpointsShowData.new(@app_bin.id, endpoint_id).fetch!
  end
end
