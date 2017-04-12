class RenameColumnsForTransactionAssociations < ActiveRecord::Migration[5.0]
  def change
    rename_column :template_events, :transaction_id, :cycle_transaction_id
    rename_column :controller_events, :transaction_id, :cycle_transaction_id
    rename_column :sql_events, :transaction_id, :cycle_transaction_id
  end
end
