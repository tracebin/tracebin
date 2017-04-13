class ReportsController < ActionController::API
  def create
    payload = report_params
    report_klass = payload[:type].classify.constantize
    @report = report_klass.new payload[:data]

    if @report.save && @report.is_a?(CycleTransaction)
      # EventsSaveJob.perform_later @report
    end
  end

  private

  def report_params
    params.require(:report).permit!
  end
end
