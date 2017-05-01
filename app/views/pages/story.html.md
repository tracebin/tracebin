# Our Story

We are [Tyler Guillen](http://tylerguillen.com) and [Konstantin Minevskiy](http://minevskiy.com), two software developers who met through [Launch School](https://launchschool.com) and decided to pair on a project together. We set out to make a fast and easy way for a developer to keep a finger on the pulse of their web application, with minimal configuration and setup. Four weeks and many cups of coffee later, Tracebin was born. This is the story of the development process of Tracebin.

[![Tracebin screenshot](/images/tracebin_screenshot_1.png)](/images/tracebin_screenshot_1.png)

Tracebin takes the concept of "Bin" projects like [JS Bin](https://jsbin.com) and [RequestBin](https://requestb.in) and applies it to application performance monitoring. The developer creates a "bin," installs our agent, and Tracebin collects various performance metrics to help detect slow endpoints, background jobs, and other common performance issues. We wrote a Ruby agent to begin with, but plan to expand our platform to Python and JavaScript in the future. Therefore, while most of this article will contain code in Ruby, it can mostly be generalized to any language that runs a web application.

## Part 1: The Agent
Tracebin is composed of two components: the agent and the server. The agent is a language module that gets installed on an application server. The agent’s job is to gather raw performance information from the application and periodically send it to the server. Here are a few considerations we wanted to take into account when we set out to design our agent:

1. **Footprint**: We wanted to be conscious of our application’s footprint, both in terms of memory usage, as well as runtime dependencies. With that in mind, we wanted to only load components that we need (as lazily as possible), and code as close to the metal as we can.
2. **Performance Impact**: Obviously, we don’t want a tool that measures application performance to have its finger on the scale. Therefore, as a rule, we wanted our agent to handle most of its administrative tasks asynchronously. This includes loading and unloading data from storage, measuring system health metrics, as well as communicating with the server.
3. **Transparency**: We wanted to create a set-it-and-forget-it style agent that doesn't require any extra engineering overhead to get it to work well.

We studied multiple existing projects that address these considerations, adopting the solutions that worked best for our project's nature and scope.

### Instrumenting Web Application Components
The nice thing about the web is that anything worth measuring comes in discrete units: the request/response cycle. The vast majority of the basic performance concerns for a web application involve the time it takes to process this cycle. Thus, we decided to focus on the primary parts of that cycle that affect its duration: template compilation (i.e. the response body) and database queries. We also provide a way for the developer to manually instrument other workflows, if the need arises.

#### The Benchmark Pattern
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

#### Instrumentation/Notification Libraries
Rails gives us some useful tools to measure different components of a Rails application with `ActiveSupport::Notifications`. Baked into Rails are “notifications” for many of the major components, like `ActiveRecord`, `ActionView`, and others. We just need to subscribe to those notifications and give them a callback to collect their data. `ActiveSupport::Notifications` is actually very extensible, and can be used to plug into just about anything in a Rails app. We decided not to take  this route, because (1) it would require us to write the same code that we would’ve written for other components, with an additional layer of complexity; and (2) more importantly, it would require a hard dependency on `ActiveSupport`.

Even for Rails, `ActiveSupport::Notifications` doesn’t cover every important Rails component. For example, the `ActionView` instrumentation that it provides will measure templates and partials, but layouts (which are sometimes the slowest parts of the process) don’t have a notification built in at the time of writing.

Notification libraries are a useful abstraction for what we’re setting out to accomplish, and Rails’ built-in library has provided a great deal of groundwork for the patterns we’ve implemented throughout our agent.

#### Middleware
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

#### Patches
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

#### Putting it All Together
Once we’ve implemented our instrumentation, we just need to tell the library where and how it should be installed. We want to cover as much of the application that we can cover while avoiding redundancy. If we instrument `ActiveRecord`, we don’t need to patch the underlying database connection. To accomplish this, we make several `defined?` calls for various libraries and filter out the instrumentation we don’t need.

### Handling Instrumentation Data
Now that we’ve found a way to gather information about the components we’re interested in, let’s find a way to bundle it all up so we can send it to our server.

First, let’s get some terminology out of the way. We refer to a full request/response cycle as a “transaction.” A background job is a transaction of a different type. At the time of writing, these are the two varieties of transaction supported by our agent and server. Anything that happens synchronously during the execution of a transaction is referred to as an “event.” This includes database queries, template rendering, and so on.

#### Collecting Events
Most libraries that we’ve seen build its measurements of a transaction in a nested, graph-like structure. When an event starts, any other event that occurs during its runtime gets added as one of its children. A pointer keeps track of the currently running event. When the event ends, that pointer is moved to the event’s parent event. When the “root” event ends (i.e. the transaction, in our terms), we process the data.

[![Tracebin screenshot](/images/tracebin_event_diagram_nested.png)](/images/tracebin_event_diagram_nested.png)

The main advantage of this model is we simply need to iterate through its structure depth-first in order to follow the execution flow of the transaction, since the data is already sorted by the time at which the event occurred. Furthermore, each transaction is bundled in a neat package for easy data transmission. It also allows us to more easily detect n+1 queries and other repeated operations.

The major drawback that we’ve identified with the nested-event model is that it limits the queryability of the data. Similarly to many NoSQL databases, this data structure enforces a specific set of query paths, and are inflexible and inefficient for queries beyond that set. Want to find all events of a certain type that happened during a transaction? With a nested, tree-like model you must perform a full, iterative search through the entire data structure. Of course, we can get around this by reorganizing the data when we deserialize it on the server side (something we suspect most services do—NewRelic indeed uses an SQL database to store their agent data).

Rather than a fully-nested data structure, we instead store our events in a flatter, two-level structure. The full transaction acts as a “root node,” and all events that happen during the transaction are stored in an array. Events are pushed onto the array as they finish, thus they end up in a quasi-sorted order.

[![Tracebin screenshot](/images/tracebin_event_diagram_flat.png)](/images/tracebin_event_diagram_flat.png)

This structure provides a slight performance advantage when the data is deserialized, but will require slightly more computation when we go to trace the execution flow of the transaction. The main advantage with this model, however, is its ease of implementation. Just shovel each new event onto an array!

#### Collecting and Storing Transactions and Events Concurrently
Most web servers running Rack/Rails applications in production provide a degree of concurrency for managing multiple requests at once. With this in mind, we need to account for two considerations:

1. Events must be organized so that those that occur in one transaction don’t contaminate other transactions. If transaction _A_ and _B_ are being executed simultaneously, event _a_ occurs in transaction _A_, then we don’t want it to be added to transaction _B_’s events array.
2. When we collect a transaction and its event data, that process must be thread-safe, since multiple threads are sharing the same “master” resource that merges them together.

The first concern can be addressed with thread-local variables. This is simple to do with Ruby: `Thread.current` is a mutable hash-like structure to which we can add arbitrary key/value pairs. The value for any given key is distinct for each thread, and threads cannot access each other’s `current` object. Nearly every agent we found addresses the concern this way.

To address the second concern, we take two steps: first, we join data from all threads at a single point. This minimizes administrative load, so we can focus on thread safety for one piece of logic. Second, we take advantage of our project’s sole runtime dependency, `concurrent-ruby`. With it, we get several abstractions for various common concurrent operations, including thread-safe wrappers for Ruby’s core data structures. We use `concurrent-ruby`’s Array wrapper for this. Whenever a transaction completes, all data collected gets added to this array, which is locked while it is being mutated. Therefore, we can treat it just like a normal Ruby array without worrying about adding extra logic.

With that in mind, `concurrent-ruby` provides an abstraction for thread-local variables that we don’t use at the time of writing, but this would be an easy component to adopt.

### Transmitting Data
One of the major problems we needed to address involved both the means through which and the frequency at which we send all the data we collect to the server. We’ve seen several ways to address these problems in existing libraries, each with its own set of advantages and tradeoffs. Here are the concerns we needed to keep in mind:

- Memory footprint
- Computational overhead
- Data availability
- Asynchronous communication
- Failure handling

#### Overloading the Server with Requests
The naïve solution is to open a new HTTP connection and transmit the data at the end of each transaction. This would allow us to abandon the need to store any of the data, since it gets sent off as it is generated. Handling this synchronously would affect the overall performance of the application, since the time it takes to open a connection, send a request, and handle the response would be “in-line.” With this in mind, we would at least need to handle this in a separate thread (`concurrent-ruby` provides several solutions for this).

There are several problems with this approach. First, since HTTP requires significant overhead, we would easily begin to overwhelm the machine if it receives even a moderate amount of traffic, even if we perform these actions asynchronously. We’d also start overflowing the available thread pool very quickly, and our server would experience heavy traffic as well.

#### Periodic Transmission
The next solution (which is actually the one we decided to implement as a first iteration of our agent) is to store the data in memory and schedule an interval at which it is unloaded and transmitted. This way we can space out our connections to be certain that we can minimize computational overhead in both the agent’s host process, as well as our server.

Currently, our agent accomplishes this using `concurrent-ruby`’s `TimerTask` object, which executes code from a block on a set time interval. This occurs in its own thread, so we don’t need to worry about interfering with the application’s normal flow of execution.

This may not be the best possible solution for applications that receive hundreds or thousands of requests per minute, as transaction and event data are held as objects in memory, and may eventually use up a great deal of memory as requests are processed. This problem may be curbed by setting a configuration variable to transmit the data more often, but it may end up causing the same sort of problem we saw from the previous solution of sending requests to the server too often.

#### Memory Size Triggers
To address this, we considered putting a cap on the memory footprint of a given set of transaction data, transmitting it to the server when it grows past a certain point. This addresses the memory footprint problem from above, but it may be less optimal for less active applications. An application that receives one request per minute might seldom reach the size cap we set, and therefore the dashboard for that app will rarely be up to date.

It seems, then, that the best way to get around this is to use both time and size triggers, transmitting a payload whenever either is reached. Tracebin’s agent currently does not do this, but it is a future consideration.
