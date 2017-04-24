class BackgroundJobsController < ApplicationController
  before_action :set_app_bin

  def index
    render json: fetch_background_jobs_stats.to_json
  end

  private

  def set_app_bin
    @app_bin = AppBin.find_by app_key: params[:app_bin_id]
  end

  def fetch_background_jobs_stats
    BackgroundJobsIndexData.new(@app_bin.id).fetch!
  end
end
