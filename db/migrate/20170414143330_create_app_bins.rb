class CreateAppBins < ActiveRecord::Migration[5.0]
  def change
    create_table :app_bins do |t|
      t.string :app_key, unique: true, index: true

      t.timestamps
    end

    add_reference :cycle_transactions, :app_bin, foreign_key: true, index: true
  end
end
