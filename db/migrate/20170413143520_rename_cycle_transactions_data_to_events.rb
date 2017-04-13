class RenameCycleTransactionsDataToEvents < ActiveRecord::Migration[5.0]
  def change
    rename_column :cycle_transactions, :data, :events
  end
end
