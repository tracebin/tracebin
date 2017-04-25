Tracebin::Agent.configure do |config|
  config.bin_id = ENV['TRACEBIN_ID']
  config.ignored_paths = ['/assets', '/reports']

  if Rails.env.test? || Rails.env.development?
    config.enabled = false
  end
end
