class CycleTransaction < ApplicationRecord
  has_many :transaction_events
end
