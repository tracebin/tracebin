class AddTransactionTypeIndexToCycleTransactions < ActiveRecord::Migration[5.0]
  def change
    add_index :cycle_transactions, :transaction_type
  end
end
