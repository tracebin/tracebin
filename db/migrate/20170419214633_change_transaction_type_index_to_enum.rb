class ChangeTransactionTypeIndexToEnum < ActiveRecord::Migration[5.0]
  def up
    execute <<~SQL
      CREATE TYPE cycle_transaction_type AS ENUM ('background_job', 'request_response', 'other');

      ALTER TABLE cycle_transactions
      ALTER COLUMN transaction_type
        TYPE cycle_transaction_type
          USING transaction_type::cycle_transaction_type;
    SQL
  end

  def down
    change_column :cycle_transactions, :transaction_type, :string

    execute <<~SQL
      ALTER TABLE cycle_transactions
      ALTER COLUMN transaction_type
        TYPE varchar(255);

      DROP TYPE cycle_transaction_type;
    SQL
  end
end
