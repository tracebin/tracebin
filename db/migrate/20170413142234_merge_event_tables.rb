class MergeEventTables < ActiveRecord::Migration[5.0]
  def change
    drop_table :template_events
    drop_table :controller_events
    drop_table :sql_events

    create_table :transaction_events do |t|
      t.string :type

      t.timestamp :start
      t.timestamp :stop
      t.numeric :duration

      t.jsonb :data

      t.timestamps
    end
  end
end
