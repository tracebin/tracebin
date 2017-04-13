class EventsSaveJob < ApplicationJob
  queue_as :default

  def perform(cycle_transaction)
    return unless cycle_transaction.events.present?
    cycle_transaction.events.each do |event|
      cycle_transaction.transaction_events.create event
    end
  end
end
