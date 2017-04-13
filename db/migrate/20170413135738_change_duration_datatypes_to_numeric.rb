class ChangeDurationDatatypesToNumeric < ActiveRecord::Migration[5.0]
  def change
    change_column :cycle_transactions, :duration, :numeric
    change_column :template_events, :duration, :numeric
    change_column :controller_events, :duration, :numeric
    change_column :sql_events, :duration, :numeric
  end
end
