class AddAppBinReferenceToSystemHealthSamples < ActiveRecord::Migration[5.0]
  def change
    add_reference :system_health_samples, :app_bin, foreign_key: true, index: true
  end
end
