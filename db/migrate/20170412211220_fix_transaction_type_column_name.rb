class FixTransactionTypeColumnName < ActiveRecord::Migration[5.0]
  def change
    rename_column :transactions, :type, :transaction_type
  end
end
