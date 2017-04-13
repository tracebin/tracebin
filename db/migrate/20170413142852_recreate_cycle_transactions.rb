class RecreateCycleTransactions < ActiveRecord::Migration[5.0]
  def change
    drop_table :cycle_transactions

    create_table :cycle_transactions do |t|
      t.string :transaction_type
      t.string :name

      t.timestamp :start
      t.timestamp :stop
      t.numeric :duration

      t.jsonb :data

      t.timestamps
    end

    rename_column :transaction_events, :type, :event_type
  end
end
