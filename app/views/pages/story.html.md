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

### Gotchas and Difficulties
While we were developing the agent, there were a several interesting problems that we came across that we needed to tackle. Here are a few, and how we solved them.

#### Where to Initialize
Most of Tracebin’s patches and subscriptions work by detecting whether the top-level namespaced constants are defined. For example, we know that we can patch the `pg` gem if `defined? ::PG` returns a truthy value. In some cases, we might add some additional logic to ensure compatibility, but this seems to be the standard practice for libraries that want to interact with other libraries. These checks will only work if our library loads after those other libraries are initialized. This means that if we run this code right when our library is required/imported (Bundler imports all gems from the `Gemfile` right away be default), we will not catch the libraries that are included after our gem is listed in the `Gemfile`. It isn’t a very ideal situation, since we would need to instruct the developer where to put our gem.

There are a few ways to approach this issue. We’ve seen some existing tools patch `Kernel#require`, Ruby’s library import method, to patch libraries as they are imported into the application. Others will run several checks throughout the lifetime of the application for patchable libraries. We chose a slightly different approach. Since our agent, at its core, is a Rack middleware, we decided to run those checks when it is included in the rack. This is done automatically on a Rails application (via a simple `Railtie`), but will be needed to be manually done in other frameworks, such as Sinatra. This way, we can be sure that all the files we want to patch have already been included. The downside to this approach is that we forgo compatibility to any possible non-Rack framework.

#### Forking Web Servers
Most production web servers, such as Puma, Unicorn, and Passenger, run multiple worker processes to help handle many requests at once. These worker processes are initialized (or “forked”) after the application process starts, but before any requests are handled. After this fork takes place, any variables initialized before the fork are inaccessible to the worker processes. This presented an issue, since any transaction data generated by those worker processes end up being inaccessible to the “reporter,” the class responsible for transmitting the data to the server, because it was initialized in the parent process.

Most web servers offer a “after-fork” hook that allows the developer to let the application wait until after the workers fork before executing some code. However, this would require a certain amount of monkeypatching, which means adding an additional degree of specific, declarative support for specific versions of these libraries. While support like this isn’t completely off the roadmap, we decided to go a different route.

Our approach was to create an additional “reporter” object for not only the parent process, but for each child process as it spawns. To do this, we added some initialization code in a place that we knew wouldn’t be executed until after a worker spawned. For now, that place was the `#call` method of our Rack middleware, but we are considering other places as well.

### Wrapping Up the Agent
When we built our agent, we set out to create a lightweight, transparent performance monitor that doesn't get in the way of an application's development process. Here are some things we learned:

1. The core functionality of measuring application components does not require much code at all.
2. `concurrent-ruby` is an unmistakably better alternative to the low-level APIs that Ruby has built in for multi-threaded workflows. It catches the language up to other languages that offer better abstractions for concurrent functionality. This is something that the core Ruby libraries are lacking.
3. It is very important to pay attention to when and how a library’s code is executed during the lifetime of its host application. Concurrency adds an additional level of complexity to this consideration.

## Part 2: The Server
The server side of Tracebin is a Ruby on Rails application. The user clicks a button that generates a “bin,” which is identified by a randomly-generated token, and can be accessed via a special URL. The page returned at that URL displays the statistics that we’ve made available based on the data sent by the agent. Each chart is asynchronously loaded via a separate endpoint. Agents send all data to a single route, and the app organizes the data accordingly.

The server side of Tracebin presented several engineering challenges for us to account for. Here are a few ways in which such an application was unique with respect to a standard Rails app:

- The app as a whole is extremely write-heavy. For every read operation, there may be hundreds or  thousands of writes.
- Rather than loading specific records, our read operations are more oriented around aggregating over large sets of records.

Here, we’ll discuss the application and data architecture decisions we made, as well as other alternatives we may eventually consider.

### Writing Data
Most of our application’s activity involves the ingestion of large sets of data at a more-or-less constant rate. By default, the server receives data from each agent every minute. Data is received in a JSON array of object, with each object needing to be organized in the correct table.

How, then, should this data be organized? We have many decisions to make for this at nearly every level, from which database to which indexes we need to create. We’ll start from the very top and work our way down from there.

#### SQL or Not?
Our service seems like the core target for many NoSQL databases, particularly MongoDB and Cassandra. They excel in write-heavy applications with predefined query paths, sacrificing flexibility for QPS. They are extremely performant, as long as you work with their constraints. Since interactions with our application are fairly constant (that is, user interaction is constrained and predictable), NoSQL stood as a fairly solid choice.

However, we decided to stick with SQL—namely, PostgreSQL—for the current iteration of our service for the following reasons. First, our current knowledge of SQL far exceeds that of other databases, so ended up being a little more time-efficient to wrangle with any of SQL’s shortcomings that might pop up than it would be to learn a new database.

The more interesting reasons involved a single concept: queryability. PostgreSQL’s robust set of features especially shines in this respect, with numerous datatype options and robust extensions ecosystem. With virtual tables, SQL provides us with a more intuitive mental model for understanding our datasets, and it allows us to conjure up data based on what we need. PostgreSQL itself also gives us a little more flexibility on how we choose to represent our data. This will prove especially useful later on in our exploration.

Here’s the big takeaway, which has been the main theme for the database decisions we’ve made throughout this process: we want to store the data in a way that lends it self to how we plan to query it. Not only do SQL databases provide us with several additional degrees of freedom for the kinds of queries we plan to make, but they, especially PostgreSQL, allow us to perform more complicated aggregate operations closer to the database than other solutions, at least with our current level of knowledge.

#### The Schema Dilemma: How normalized are your tables?
With our current model, we have two basic entity types: transactions and events. They exist in a one-to-many relationship. Events can be subdivided into three or four categories, each with their own kinds of attributes. For example, database operations don’t have the same kinds of characteristics as controller actions. Therefore, we might imagine a schema in which we have separate tables for each event type.

[![Tracebin schema](/images/tracebin_db_schema_1.png)](/images/tracebin_db_schema_1.png)

Missing from There are a few problems with this. First, while this schema provides a great deal of flexibility, it comes at a cost of performance, especially when we keep in mind how we plan to query this data. With this in mind, it helps to recognize what kind of data we want from these tables. Here’s an example of the output we’re expecting:

[![Tracebin schema](/images/tracebin_output_endpoints_index.png)](/images/tracebin_output_endpoints_index.png)

In order to obtain data for a table like this in a single query, we would need to perform JOINs on four tables, which will seriously impact performance when our application is up and running. Furthermore, there are a lot of repeated columns between our three `Events` tables, which indicates that it might be wise to combine them.

At the other end of the normalization spectrum, we end up with a completely denormalized schema in which all event data is stored in the `Transactions` table. PostgreSQL’s JSON datatype makes this possible while keeping the relation sane.

[![Tracebin schema](/images/tracebin_db_schema_2.png)](/images/tracebin_db_schema_2.png)

The `events` column stores an array of JSON objects, each of which contains all the data related for the event. With this, we end up with what is essentially a NoSQL datastore. We can’t perform direct JOINs and aggregates on that JSON column, which means the table we’re trying to obtain may be difficult. Thankfully, there are several functions in PostgreSQL that help us to convert JSON structures into virtual tables, which we do end up doing with some endpoints.

Now, we could’ve used MongoDB all along if we wanted to structure our data like this! This also isn’t really the best schema for the table we’re trying to create, so let’s normalize out all events into their own table:

[![Tracebin schema](/images/tracebin_db_schema_3.png)](/images/tracebin_db_schema_3.png)

Here, we have columns for all the information common to each event type, and put the data unique to each event type in a JSON object. We also add a custom ENUM datatype to indicate the event’s type. This way, if we need to get information specific to a certain event, we just need to put that type in the `WHERE` clause of our query. Notice how we keep the `events` column in `Transactions`, giving us two representations of each event. We do this because, as we will see, some queries will be easier to perform on the JSON objects, while others will be much easier with the `Events` table.

We must accept some tradeoffs with this model, and we’ll discuss these in the next section.

#### Data Interchange
Now that we have the first stages of our database schema, we need to account for how our data gets transmitted over the wire from the agent. For now, we’ve chosen JSON as our format to accomplish this.

Per above, all data gets sent in an array of JSON objects. Each object needs to tell the application where it needs to be stored, along with what needs to be stored. For transactions, we chose a format that looks essentially like the `Transactions` table illustrated above:

```javascript
{
  "type": "transaction",
  "data": {
    "type": "request_response",
    "name": "VideosController#show",

    "start": "2017-04-26 10:09:43 -0400",
    "stop": "2017-04-26 10:09:43 -0400",
    "duration": 7.5680000000000005,
    "events": [ {}, {}, {} ]
  }
}
```

One consideration to make when choosing how our data should be transmitted is computation location and strategy. To understand this challenge, let’s go back to our mantra: data must be persisted to reflect how it will be queried. The raw data collected by our agent comes in pieces that aren’t extremely useful for presenting our data. For instance, `name` and `duration` must be computed, since they aren’t present. Any computed data like this must be computed on either the side of the agent or the server. Since we don’t want to impact the host application’s performance with extra computational tasks, we let the server handle most tasks, with the exception of computing `duration` and `type`, both of which can be completed in synchronously in a reasonable amount of time.

One thing do on the server side is organize the “events” JSON array by event type, spanning across four categories: endpoint, database, view, and other. This allows us to more easily generate runtime profiles like the one below:

[![Tracebin screenshot](/images/tracebin_output_endpoints_show.png)](/images/tracebin_output_endpoints_show.png)

As we mentioned in the previous section, we also iterate through the `events` array to store individual records for each event associated with a transaction. All this data processing happens asynchronously with a background job engine (at the time of writing, we’re using Sidekiq), so that the agent isn’t stuck waiting for the server to finish persisting all of the event data.

Our goal here is to do all the computation ahead of time so that we can pull the data as directly as possible when we go to aggregate it. However, this is where we run into a bit of a problem. The more computation we do ahead of time, the longer it takes for us to process incoming payloads. We therefore want to be conscious of the amount of time this takes, since we don’t want it to exceed the frequency at which we receive payloads, since we will never be able to process every payload, and we’ll very quickly run out of memory. As it turns out, there is a considerable amount of overhead involved with saving individual events in their own table (per the strategy we discussed in the previous section), so this may not be the best possible strategy as our application grows.

One way to curb this is to leave enough “breadcrumbs” in our data interchange so that the server knows exactly where and how to store it, effectively transforming most O(n) logic into O(1) logic. For instance, since we’re organizing each bit of data by type, we need to make sure the server knows which type it right off the bat.

What we get in the end is a structure like this:

```javascript
{
  "identifier": "some_identifier",
  "params": {
    // This is where the object's actual data goes.
    "nested_objects": [
    {
      "identifier": "some_other_identifier",
      "params": {
      // These are the nested object attributes
      }
    },
    // More objects
    ]
  }
}
```

The `identifier` key (or equivalent) serves as a way to tell the server where it will be storing the data. Any nested objects follow this same pattern. What we get is a pipeline of data that makes it fast and easy for the application to know where to put the data.

One interesting quirk of Rails (and ActiveRecord in particular) is that there is no way to create multiple records with a single query right out of the box. This is a bit of a performance problem, especially with our process of ingesting agent payloads in mind. In our current model, we create event records for each transaction. This is a major bottleneck for our ingestion process, especially if it means creating individual ActiveRecord objects and and saving them to the database one by one. Luckily, there exists a gem called `activerecord-import` in active development that optimizes this process, allowing us to save multiple records in a single query. This reduces the amount of time it takes to persist an entire payload by about an order of magnitude. We can make this even faster by curtailing ActiveRecord validations, which is something we are currently experimenting with.

### Reading Data
Now that we’ve found an efficient way to persist our agent’s data, we need to find out a way to generate datasets for the charts in our UI. For this post, we’ll focus on two charts: the “Endpoints” table and the “endpoint sample profile” waterfall graph.

[![Tracebin screenshot](/images/tracebin_output_endpoints_index_and_show.png)](/images/tracebin_output_endpoints_index_and_show.png)

We’re using two charting libraries for these charts: Datatables.net and the Google visualization library (now known as Google Charts). We chose them among the countless other charting libraries because they’re both flexible and take similar data structures as input. For each, we need an array of arrays, the elements of whom closely reflect the output. For Datatables (which we use for the Endpoints table), we just need to send data straight across to fill in the rows on the table. For Google Charts (which we use for the waterfall chart), the rows in the dataset reflect the size and positions of their respective bars.

This array-of-arrays data structure lends itself to fairly easily pulling data straight from an SQL query’s output, allowing us to delegate most of the heavy computational lifting to the database engine, rather than the slower application layer.

Here’s the first iteration of the query we use to generate the data for the “endpoints” table:

```sql
SELECT
  name AS endpoint,
  quantile(duration, 0.5) AS median_duration,
  quantile(duration, 0.95) AS ninety_fith_percentile_duration,
  count(*) AS hits,
  avg(coalesce((
    SELECT sum(duration)
    FROM jsonb_to_recordset(events->'sql') AS x(duration NUMERIC)
  ), 0)) AS avg_time_in_sql,
  avg(coalesce((
    -- View events happen within each other, so we just need to take the
    -- highest value here.
    SELECT max(duration) - (
      SELECT sum(duration)
      FROM
        jsonb_to_recordset(events->'sql')
          AS y(duration NUMERIC, start TIMESTAMP, stop TIMESTAMP)
      WHERE
        y.start >= min(x.start) AND y.stop <= max(x.stop)
    )
    FROM
      jsonb_to_recordset(events->'view')
        AS x(duration NUMERIC, start TIMESTAMP, stop TIMESTAMP)
  ), 0)) AS avg_time_in_view,
  avg(coalesce((
    SELECT sum(duration)
    FROM
      jsonb_to_recordset(events->'controller_action')
        AS x(duration NUMERIC)
  ), 0)) AS avg_time_in_app,
  avg(coalesce((
    SELECT sum(duration)
    FROM jsonb_to_recordset(events->'other') AS x(duration NUMERIC)
  ), 0)) AS avg_time_in_other
FROM transactions
WHERE
  app_bin_id = #{ActiveRecord::Base.sanitize @app_bin_id} AND
  type = 'request_response' AND
  start > (current_timestamp - interval '1 day')
GROUP BY endpoint
ORDER BY hits DESC;
```

This generates almost what we need to fill in the chart. The only missing pieces, such as the percentages, can be quickly formatted on the application layer. Notice how we are able to directly locate the transaction’s events by type. This is because we perform an operation at the time of creation to organize them in this fashion.

There is one major issue with this query: it is extremely slow (i.e., on the scale of seconds) when when the dataset gets reasonably large. This is due to the fact that we’re averaging over the entire dataset multiple times, with each record generating a set of at least five virtual tables.

We are in the process of curbing this by computing most of these values ahead of time. For example, we could add columns to the Transactions table where we compute the values for SQL/View/etc. time, thus curtailing the need for those virtual tables. We have to be careful, however, since this would add some time to our data intake workflow. This may be negligible for less complicated transactions, but it’s worth it to consider transactions with hundreds of events.

Another way to optimize massive aggregate queries like this would be to cache the results. While caching strategies almost always sacrifice “freshness” of data for speed, we don’t necessarily need to worry about this, especially since we are only receiving data from our agents on a minute-by-minute bases, rather than a millisecond-by-millisecond basis. For now, we don’t currently utilize a caching solution for this, but it’s on the roadmap.

In the case of the waterfall diagram, we perform a similar query, except for a single transaction record. We simply pull its events and order them by start time. This alone would be sufficient, but we decided that we wanted to group “n+1” operations together, so that we can both compress the chart and provide more useful information for those wanting to optimize their workflows. To accomplish this, we add an additional “count” column to our query output, grouping by “identifier.” This identifier is what we use to further sort out events. For example, a `SELECT` query will have a different signature from an `INSERT` query. If we are `SELECT`ing multiple times from a certain table in a row, this indicates a possible n+1 query. We just use some simple regular expressions to parse out these identifiers.

Here are the main ideas we took away when planning out how we query our data:

- Database-level computation is almost always faster than application-level computation. Calculations that span across thousands of records should be performed as close to the database as possible.
- With that in mind, it’s a good practice to have the data ready for consumption and presentation by the time it reaches the interface. This practice allows us to focus on presentation on the front end. While it is sometimes necessary to transform the data in the browser to some degree (especially since, in our case, JSON does not have a “date” datatype built in), it’s good to let our server handle most of that work.
- It is best to find ways minimize operations that impact query performance, such as JOINs and aggregates. SQL provides a great deal of flexibility when it comes to performing different kinds of queries, but this comes at the cost of performance, especially when we are dealing with many records at once. Indexes can only go so far in this regard.

### Further Considerations
Our application is unique in the world of application performance monitoring solutions in that we only need to consider 24 hours of data. If we wanted to expand our service to include more historical data, we would need to take into consideration datasets that are considerably larger than the ones with which we are currently working.

## Conclusion
Tracebin is the result of a month of studying, building, and head-to-wall contact. Through the process, we learned not only how to deal with several problems across multiple domains, but also how to plan, communicate, and manage a sizable project of fairly significant scope.

We’d like to give special thanks to our mentors at Launch School. Without their gracious support and advice, this project wouldn’t be a tenth of what it is today.
