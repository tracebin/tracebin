class AddCycleTransactionIdToTransactionEvents < ActiveRecord::Migration[5.0]
  def change
    add_column :transaction_events, :cycle_transaction_id, :integer
  end
end
