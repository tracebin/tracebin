class CreateTransactions < ActiveRecord::Migration[5.0]
  def change
    create_table :transactions do |t|
      t.string :type
      t.string :name

      t.datetime :start
      t.datetime :stop
      t.integer :duration

      t.json :payload

      t.timestamps
    end

    create_table :template_events do |t|
      t.text :file
      t.string :layout

      t.datetime :start
      t.datetime :stop
      t.integer :duration

      t.integer :transaction_id

      t.timestamps
    end

    create_table :controller_events do |t|
      t.string :controller
      t.string :action
      t.string :path
      t.string :format

      t.datetime :start
      t.datetime :stop
      t.integer :duration

      t.integer :transaction_id

      t.timestamps
    end

    create_table :sql_events do |t|
      t.string :query

      t.datetime :start
      t.datetime :stop
      t.integer :duration

      t.integer :transaction_id

      t.timestamps
    end
  end
end
