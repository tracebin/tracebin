class TransactionEvent < ApplicationRecord
  belongs_to :cycle_transaction

  enum event_type: {
    sql: 'sql',
    controller_action: 'controller_action',
    view: 'view',
    route: 'route',
    other: 'other'
  }
end
