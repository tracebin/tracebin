class CycleTransaction < ApplicationRecord
  has_many :template_events
  has_many :controller_events
  has_many :sql_events
end
