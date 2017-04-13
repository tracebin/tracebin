class CreateSystemHealthSamples < ActiveRecord::Migration[5.0]
  def change
    create_table :system_health_samples do |t|
      t.timestamp :sampled_at

      t.jsonb :metrics

      t.timestamps
    end
  end
end
