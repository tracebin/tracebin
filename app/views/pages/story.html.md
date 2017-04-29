# Our Story

We are [Tyler Guillen](http://tylerguillen.com) and [Konstantin Minevskiy](http://minevskiy.com), two software developers who met through [Launch School](https://launchschool.com) and decided to pair on a project together. We set out to make a fast and easy way for a developer to keep a finger on the pulse of their web application, with minimal configuration and setup. Four weeks and many cups of coffee later, Tracebin was born. This is the story of the development process of Tracebin.

<<<< FULL PAGE SCREENSHOT OF AN UP-AND-RUNNING APP HERE >>>>

Tracebin takes the concept of "Bin" projects like [JS Bin](https://jsbin.com) and [RequestBin](https://requestb.in) and applies it to application performance monitoring. The developer creates a "bin," installs our agent, and Tracebin collects various performance metrics to help detect slow endpoints, background jobs, and other common performance issues. We wrote a Ruby agent to begin with, but plan to expand our platform to Python and JavaScript in the future. Therefore, while most of this article will contain code in Ruby, it can mostly be generalized to any language that runs a web application.

## Instrumenting Web Application Components
The nice thing about the web is that anything worth measuring comes in discrete units: request/response cycles. The vast majority of the basic performance concerns for a web application involve the time it takes to process this cycle. Thus, we decided to focus on the primary parts of that cycle that affect its duration: template compilation (i.e. the response body) and database queries. We also provide a way for the developer to manually instrument other workflows, if the need arises.

### The Benchmark Pattern
The general pattern for instrumenting a chunk of code is to sandwich it between two measurements of the current time. Since computers are fast, it's best to use a library that can measure it down to a fairly high degree of precision.

```ruby
start = Time.now
do_the_thing
stop = Time.now

duration = stop - start
```

Replace `do_the_thing` with your own chunk of code and congratulations! You've written your own instrumentation library. Joking aside, it honestly isn’t much more difficult. That’ll be the pattern throughout this exploration: most of the stuff that goes into an agent like this doesn’t require much code. As always, though, the devil is in the details.

Side note: Ruby’s standard library has a `Benchmark` module which provides some additional details about the runtime of the process, but we’re going to focus on the basic start-time/stop-time pattern.

For a web app, we want to wrap bits of code like that around three basic processes: the overall request/response cycle, database queries, and templating engines that format the body of the HTTP response. A naïve way to implement this would be to expose a public API that the developer can use to declaratively instruct the agent what components that the agent should be measuring.

```ruby
Tracebin.instrument 'load users' do
  @user = User.all
end
```

This is in fact what we do for any custom instrumentation that the developer might want to implement for things that we don’t support. However, this isn’t very elegant for a full-blown agent. We’d need to put bits of code like this everywhere in our web app. We’ll need to find a way to make this process much more transparent, which means we need to move that code closer to the components we’re measuring. Furthermore, we’d also want a way to get additional information about that process, so this will require some extra logic outside of the start-time/stop-time pattern.

Based on what we’ve discovered looking at other agents like the one we set out to build, this can be done in three ways: instrumentation libraries, middleware, and patches.

### Instrumentation Libraries
Rails gives us some useful tools to measure different components of a Rails application with `ActiveSupport::Notifications`. Baked into Rails are “notifications” for the major components, like `ActiveRecord`, `ActionView`, and others. We just need to subscribe to those notifications and give them a callback to collect their data. `ActiveSupport::Notifications` is actually very extensible, and can be used to plug into just about anything in a Rails app. We decided not to take  this route, because (1) it would require us to write the same code that we would’ve written for other components, with an additional layer of complexity; and (2) more importantly, it would require a hard dependency on `ActiveSupport`.

Even for Rails, `ActiveSupport::Notifications` doesn’t cover every important Rails component. For example, the `ActionView` instrumentation that it provides will measure templates and partials, but layouts (which are sometimes the slowest parts of the process) don’t have a notification built in at the time of writing.

### Middleware
Some popular libraries have middleware frameworks that we can plug in to, allowing us to wrap a process with timestamps and gather information from it. Rack is the main middleware framework that we use, but some other libraries adopt a similar pattern, including Sidekiq and Faraday.

The pattern for middleware typically goes as follows: create a class that implements a `#call` method or similar, use the benchmark pattern for the execution of the process. We then tell the library to add this class to its middleware stack. Here’s a simplified version of our Rack middleware’s `#call` method:

```ruby
# Extra logic omitted for brevity
def call(env)
  @tracebin_timer = Timer.new
  @tracebin_timer.start!

  status, headers, response = @app.call(env)

  @tracebin_timer.transaction_name = fetch_endpoint_name(env)

  @tracebin_timer.stop!

  ::Tracebin.process_timer @timer, response

  [status, headers, response]
end
```

Notice how we can collect information from the `env` variable as needed.

### Patches
If a library doesn’t have built-in support that allows us to instrument components, we’ll need to use a bit of metaprogramming to accomplish this. This technique varies widely depending on the component we wish to instrument, but the pattern goes generally like so:

1. Find the method that executes the code that you want to measure. For example, the `pg` gem for connecting to a PostgreSQL database calls the `PG::Connection#exec` or `#exec_params` method whenever it passes a string of SQL to the database.
2. Open up the method’s class (we like to use `class_eval` for this, but it can be accomplished through other means) and alias the method out.

```ruby
::PG::Connection.class_eval do
  alias_method :exec_without_tracebin, :exec
end
```

3. Re-implement the method, wrapping the original method call with our benchmark pattern:

```ruby
def exec(*args, &block)
  start_time = Time.now
  result = exec_without_tracebin *args, &block
  end_time = Time.now

  ::Tracebin.process_event start_time, end_time, result

  result
end
```

This isn’t exactly how we implement our patch for `PG::Connection#exec`, but it’s the general idea. It’s important to make sure that this method returns what the original method was expected to return, or else we’ll wind up with some unintended consequences. We’ll explore how this information gets processed later on.

### Putting it All Together
Once we’ve implemented our instrumentation, we just need to tell the library where and how it should be installed. We want to cover as much of the application that we can cover while avoiding redundancy. If we instrument `ActiveRecord`, we don’t need to patch the underlying database connection. To accomplish this, we make several `defined?` calls for various libraries and filter out the instrumentation we don’t need.

## Handling Instrumentation Data
Now that we’ve found a way to gather information about the components we’re interested in, let’s find a way to
