class RenameTransactionsToSomethingElse < ActiveRecord::Migration[5.0]
  def change
    rename_table :transactions, :cycle_transactions
  end
end
