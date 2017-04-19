class ReportsSaveJob < ApplicationJob
  queue_as :default

  def perform(reports, app_bin)
    reports.each do |payload|
      report_table = payload[:type].tableize
      report = app_bin.send(report_table).build payload[:data]

      report.save
    end
  end
end
