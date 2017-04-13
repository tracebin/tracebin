class CycleTransaction < ApplicationRecord
  has_many :transaction_events

  after_create :create_transaction_events

  private

  def create_transaction_events
    EventsSaveJob.perform_later self.id, self.events
  end
end
