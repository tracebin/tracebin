class EventsSaveJob < ApplicationJob
  queue_as :default

  rescue_from(ActiveJob::DeserializationError) do
    EventsSaveJob.perform_later arguments[0], arguments[1]
  end

  def perform(ct_id, events)
    return unless events.present?

    events.values.flatten.each do |event|
      params = event.merge({ cycle_transaction_id: ct_id })
      TransactionEvent.create params
    end
  end
end
