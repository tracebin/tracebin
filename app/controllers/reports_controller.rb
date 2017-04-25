class ReportsController < ActionController::API
  before_action :set_app_bin

  def create
    reports = report_params

    ReportsSaveJob.perform_later reports, @app_bin

    head :created
  end

  private

  def report_params
    params.require(:report).map(&:permit!).map(&:to_h)
  end

  def set_app_bin
    @app_bin = AppBin.find_by app_key: params[:bin_id]

    if @app_bin.nil?
      head :not_found
    end
  end
end
