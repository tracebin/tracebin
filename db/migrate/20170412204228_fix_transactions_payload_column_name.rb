class FixTransactionsPayloadColumnName < ActiveRecord::Migration[5.0]
  def change
    rename_column :transactions, :payload, :data
  end
end
