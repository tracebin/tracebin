class ReportsController < ActionController::API
  def create
    payload = report_params
    report_klass = payload[:type].classify.constantize
    @report = report_klass.new payload[:data]

    @report.save
  end

  private

  def report_params
    params.require(:report).permit!
  end
end
