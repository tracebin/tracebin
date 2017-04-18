class AddStartIndexToCycleTransactions < ActiveRecord::Migration[5.0]
  def change
    add_index :cycle_transactions, :start
  end
end
