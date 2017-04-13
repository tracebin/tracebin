class ChangeEventTypeToEnum < ActiveRecord::Migration[5.0]
  def up
    remove_column :transaction_events, :event_type

    execute <<~SQL
      CREATE TYPE transaction_event_type AS ENUM ('sql', 'view', 'route', 'controller_action', 'other');
    SQL

    add_column :transaction_events, :event_type, :transaction_event_type, default: 'other', index: true
  end

  def down
    remove_column :transaction_events, :event_type

    execute <<~SQL
      DROP TYPE transaction_event_type;
    SQL

    add_column :transaction_events, :event_type, :string
  end
end
