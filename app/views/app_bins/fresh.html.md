# Thank you for using Tracebin!

Your bin id is: `<%= @app_bin.to_param %>`. Here's how to get started:

### Ruby

Add our agent to your app's `Gemfile`:

```ruby
gem 'tracebin'
```

Make sure you run Bundler:

```
bundle
```

Configure the gem to point to this bin:

```ruby
# your_app/config/initializers/tracebin.rb

Tracebin::Agent.configure do |config|
  config.bin_id = '<%= @app_bin.to_param %>'

  if Rails.env.development? || Rails.env.test?
    config.enabled = false # Disable for test and dev.
  end
end
```

For more configuration options, visit [https://github.com/tracebin/tracebin-ruby](https://github.com/tracebin/tracebin-ruby).

If you're running Sinatra, you'll need to manually add our middleware:

```ruby
use Tracebin::Middleware
```

Next, deploy your app and you're all set! Once we gather some statistics, we'll post them to this page. Just refresh to view the latest stats!
