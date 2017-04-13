class EventsSaveJob < ApplicationJob
  queue_as :default

  def perform(ct_id, events)
    return unless events.present?

    events.each do |event|
      params = event.merge({ cycle_transaction_id: ct_id })
      TransactionEvent.create params
    end
  end
end
