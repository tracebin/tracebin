class CycleTransaction < ApplicationRecord
  has_many :transaction_events
  belongs_to :app_bin

  enum transaction_type: {
    background_job: 'background_job',
    request_response: 'request_response'
  }

  before_create :organize_events
  after_create :create_transaction_events

  private

  def organize_events
    if self.events.is_a? Array
      event_dump = self.events

      new_event_data = {
        sql: events_of_type(event_dump, 'sql'),
        view: events_of_type(event_dump, 'view'),
        controller_action: events_of_type(event_dump, ['controller_action', 'route']),
        other: other_events_from(event_dump)
      }

      self.events = new_event_data
    end
  end

  def events_of_type(event_dump, event_types)
    event_types = event_types.is_a?(Array) ? event_types : [event_types]
    event_dump.select { |event| event_types.include? event['event_type'] }
  end

  def other_events_from(event_dump)
    event_dump.select do |event|
      !['sql', 'view', 'controller_action'].include? event['event_type']
    end
  end

  def create_transaction_events
    return unless events.present?

    events.values.flatten.each do |event|
      params = event.merge({ cycle_transaction_id: self.id })
      TransactionEvent.create params
    end
  end
end
