class ReportsController < ActionController::API
  def create
    Rails.logger.silence do
      @app_bin = AppBin.find_by app_key: params[:bin_id]
      payload = report_params
      report_table = payload[:type].tableize
      @report = @app_bin.send(report_table).build payload[:data]

      @report.save
    end
  end

  private

  def report_params
    params.require(:report).permit!
  end
end
