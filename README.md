# tracebin

[traceb.in](https://traceb.in)

## Deployment Notes

Tracebin requires the `quantile` PostgreSQL extension. We use it because it's a fast way to generate medians and percentiles from a dataset. To install, we first need `pgxn`, which requires `easy_install`:

```
sudo apt-get install python-setuptools
sudo easy_install pgxnclient
```

Then we use `pgxn` to install our extension, and add it to our database:

```
sudo pgxn install quantile
sudo -u postgres -i pgxn load -d tracebin_production quantile
```

## Data Interchange

Data received from agents must have a certain schema in order for Tracebin to be able to parse it. For now, that data can fall into two categories: `cycle_transaction`, and `system_health_sample`. We'll call a single instance of either of these a "unit."

All data sent to the `/reports` endpoint must come in a form of an object with two keys: the bin ID (the random string generated when the bin was created) and an array of units.

```javascript
{
  "bin_id": "abcd...",
  "report": [ {}, {}, {} ] // Each object is a unit, explained just below.
}
```

Each unit must take the following form:

```javascript
{
  "type": "unit_type", // e.g. `cycle_transaction` or `system_health_sample`
  "data": {
    // Unit data
  }
}
```

### `cycle_transaction` Schema

`cycle_transaction`s are any top-level transaction that take place during the runtime of a web application. Examples are request/response cycles and background job executions. We separate these two because background jobs happen asynchronously, and therefore their performance should be considered independently from the normal response time of an application's endpoint. Here's an example of what a `cycle_transaction` unit object looks like:

```javascript
{
  "type": "cycle_transaction",
  "data": {
    "transaction_type": "request_response",
    "name": "VideosController#show",

    "start": "2017-04-26 10:09:43 -0400",
    "stop": "2017-04-26 10:09:43 -0400",
    "duration": 7.5680000000000005,
    "events": [ {}, {}, {} ]
  }
}
```

Here are what the values for each of the keys in `data` should be:

**`transaction_type`**: Either `"request_response"` or `"background_job"`, depending on what it refers to.
**`name`**: This should be the identifier of the process you are trying to measure. A web application's method/route combintaion (e.g. `GET /users`) would be a perfect example of this. For a Rails application, an even better string to put here would be the controller#action combination. Background jobs could be identified by their names.
**`start` and `stop`**: These should refer to then the overall transaction started and ended. They should be strings in a format that can be parsed directly by PostgreSQL, with milliseconds included (meaning the above example isn't all that useful).
**`duration`**: A floating point number representing the time it took for the transaction to complete in milliseconds.
**`events`**: This is an array of objects representing each event that took place during the runtime of the transaction. We'll discuss these objects below.

#### `cycle_transaction` Events Object Schemae

The `"events"` key in the `"data"` object of a `cycle_transaction` should point to an array of objects, per the above example. Below is an example of one such object:

```javascript
{
  "event_type": "route",
  "start": "2017-04-26 10:09:43 -0400",
  "stop": "2017-04-26 10:09:43 -0400",
  "duration": 0.5820000000000001,
  "data": {}
}
```

The schema of the `"data"` depends on the type of event. Below are schemae the kinds of events we're currently measuring.

##### `sql`

```javascript
{
  "sql": "SELECT foo FROM bar",
  "name": "Load Bar", // Optional
  "statement_name": "a1" // Optional
}
```

##### `controller_action`

Rails specific, although other MVC frameworks might conceivably take on this schema as well. This format will possibly merge with `route` to become a unified `endpoint` event type.

```javascript
{
  "controller": "FooController",
  "action": "bar",
  "format": "html",         // Optional from here on down
  "method": "GET",
  "status": 200,
  "path": "/foo/bar",
  "status": "ok",
  "view_runtime": 20.5343,
  "db_runtime": 5.2328
}
```

##### `route`

The non-rails-specific iteration of `controller_action`.

```javascript
{
  "endpoint": "GET /users",
  "format": "html",         // Optional from here on down
  "method": "GET",
  "status": 200,
  "path": "/foo/bar",
  "status": "ok"
}
```

##### `view`

```javascript
{
  "identifier": "templates/foo.html.haml",
  "layout": "layouts/bar" // Optional - obviously, if the view event itself is
                          // a layout, this won't be here.
}
```

### `system_health_sample` Schema

Here is an example of a `system_health_sample` unit object:

```javascript
{
  "type": "system_health_sample",
  "data": {
    "sampled_at": "SOME TIME STRING",
    "metrics": {
      "process": "web",
      "machine_id": {},
      "cpu": {},
      "memory": {},
      "disks": {}
    }
  }
}
```

**`sampled_at`**: Per above, this must be the datetime string that can be directly parsed by PostgreSQL.

#### `metrics` Object Schema

##### `process`

Either `"web"` or `"worker"` -- these aren't currently used, but it will be useful eventually.

##### `machine_id`

This will be used to build a string to identify the machine sending the data.

```javascript
{
  "hostname": "some-hostname",
  "ip": "333.333.333.333",  // <- The machine's EXTERNAL ip address
  "kernel": "linux"         // <- Whatever kernel the machine is running
}
```

##### `cpu`

```javascript
{
  "model_name": "Intel Foo i5",
  "processor_count": 1,   // <- Number of physical CPU units
  "core_count": 4,        // <- Total number of CPU cores
  "logical_cpu_count": 8  // <- Total number of logical CPUs/threads
}
```

##### `memory`

All values are in MB.

```javascript
{
  "total_memory": 16000,
  "wired_memory": 1000,    // <- Either 'wired' or 'cache', depending on the kernel
  "free_memory": 10000,
  "used_memory": 6000,
  "available_memory": 1200 // <- Optional
}
```

##### `disk`

This is no-man's land--we don't yet have a good schema for this.

## SQL Notes

Here is a list of our query plans for aggregating data from the database.

### Accessing `transaction_events` table alone

```sql
SELECT cycle_transaction_id AS t_id, data->>'controller' AS controller, data->>'action' AS action
  FROM transaction_events
  WHERE event_type = 'controller_action';
```

This returns the transaction IDs, along with the controller and action corresponding to each transaction. Let's `JOIN` this table with all other events for each transaction:

```sql
SELECT t_id, MAX(ca.controller) AS c, MAX(ca.action) AS a, e.event_type, AVG(e.duration) AS avg_duration, SUM(e.duration) AS tot_duration, COUNT(e.duration) AS event_count
  FROM transaction_events AS e
  INNER JOIN (
    SELECT cycle_transaction_id AS t_id, data->>'controller' AS controller, data->>'action' AS action
      FROM transaction_events
      WHERE event_type = 'controller_action'
  ) AS ca
    ON ca.t_id = e.cycle_transaction_id
  GROUP BY t_id, e.event_type;
```

This returns quite a bit of useful information: the transaction ID, controller and action, as well as average duration, total duration, and number of events for each type per transaction.

We can also group by controller/action:

```sql
SELECT ca.controller AS c, ca.action AS a, e.event_type, AVG(e.duration) AS avg_duration
  FROM transaction_events AS e
  INNER JOIN (
    SELECT cycle_transaction_id AS t_id, data->>'controller' AS controller, data->>'action' AS action
      FROM transaction_events
      WHERE event_type = 'controller_action'
  ) AS ca
    ON ca.t_id = e.cycle_transaction_id
  GROUP BY c, a, e.event_type;
```

Obviously, we can remove event count and total duration since they're not really relevant here. This will take each controller/action combination and give us the average duration for each event type within that action. But that only gives us the average duration for each event type. It would be nice if we could get the average total time spent for each event type. Here's a brute force solution, adding the table from above and performing a query on it:

```sql
SELECT c, a, event_type, AVG(tot_duration) AS avg_time_spent, ROUND(AVG(event_count)) AS avg_count
FROM (
  SELECT t_id, MAX(ca.controller) AS c, MAX(ca.action) AS a, e.event_type, AVG(e.duration) AS avg_duration, SUM(e.duration) AS tot_duration, COUNT(e.duration) AS event_count
  FROM transaction_events AS e
  INNER JOIN (
    SELECT cycle_transaction_id AS t_id, data->>'controller' AS controller, data->>'action' AS action
    FROM transaction_events
    WHERE event_type = 'controller_action'
  ) AS ca
    ON ca.t_id = e.cycle_transaction_id
  GROUP BY t_id, e.event_type
) AS totals
GROUP BY c, a, event_type
ORDER BY c, a, event_type;
```

### Accessing endpoint data after normalizing the `name` column in `cycle_transactions`

The previous section had some pretty gnarly queries, since we needed to get information about the endpoints from deep in the JSON. We've since modified the `name` column in `cycle_transactions` so that they reflect the name of the endpoint being accessed. In the case of a Rails app, it's the `Controller#action`. We now need a JOIN in order to get these clean groupings.

```sql
SELECT name
FROM cycle_transactions
WHERE
  transaction_type = 'request_response' AND
  name <> 'RackTransaction' AND
  start > (current_timestamp - interval '1 day')
GROUP BY name;
```

This returns the names for each endpoint that has been accessed within the last 24 hours. It's currently pretty slow, but we can optimize it later on.

Now let's get some more metrics on these endpoints. We can start by getting all the stuff we can get from the `cycle_transactions` table minus the `events` column.

```sql
SELECT
  name AS endpoint,
  avg(duration) AS avg_response_time,
  count(*) AS total_requests
FROM cycle_transactions
WHERE
  transaction_type = 'request_response' AND
  name <> 'RackTransaction' AND
  start > (current_timestamp - interval '1 day')
GROUP BY name
ORDER BY name;
```

JOINing with the `transaction_events` table might be a little tricky, especially since we want to keep our aggregates in tact. Instead, let's perform a second query to gather the events and average them out by type. We'll need a JOIN here to make it easy to group by the endpoint. We'll also need to create a virtual table in order to get the average time in each event type.

```sql
WITH event_durations AS (
  SELECT
    ct.id,
    ct.name AS endpoint,
    te.event_type,
    sum(te.duration) AS total_event_type_duration,
    count(*) AS event_type_count
  FROM cycle_transactions AS ct
    INNER JOIN transaction_events AS te
      ON ct.id = te.cycle_transaction_id
  WHERE
    ct.transaction_type = 'request_response' AND
    ct.name <> 'RackTransaction' AND
    ct.start > (current_timestamp - interval '1 day')
  GROUP BY ct.id, endpoint, event_type
)
SELECT
  endpoint,
  event_type,
  avg(total_event_type_duration) AS avg_duration,
  round(avg(event_type_count)) AS avg_count
FROM event_durations
GROUP BY endpoint, event_type
ORDER BY endpoint, event_type;
```

There is a slight problem with this: if an event type for a particular transaction doesn't exist, then it isn't reflected in our results. In order to do this, it might be easier to delve into our jsonb column of our `cycle_transactions` table. We still need to do separate queries, but we may have the opportunity to join them into one query in the end.

```postgresql
SELECT
  name AS endpoint,
  duration,
  (
    SELECT sum(duration)
    FROM jsonb_to_recordset(events->'sql') AS x(duration NUMERIC)
  ) AS time_in_sql,
  (
    SELECT sum(duration)
    FROM jsonb_to_recordset(events->'view') AS x(duration NUMERIC)
  ) AS time_in_view,
  (
    SELECT sum(duration)
    FROM jsonb_to_recordset(events->'other') AS x(duration NUMERIC)
  ) AS time_in_other
FROM cycle_transactions
WHERE
  transaction_type = 'request_response' AND
  name <> 'RackTransaction' AND
  start > (current_timestamp - interval '1 day');
```

This returns each endpoint hit, with the time it spent in SQL, view, etc.. Now let's aggregate that with our totals:

```postgresql
WITH event_timings AS (
  SELECT
    name AS endpoint,
    duration,
    (
      SELECT sum(duration)
      FROM jsonb_to_recordset(events->'sql') AS x(duration NUMERIC)
    ) AS time_in_sql,
    (
      SELECT sum(duration)
      FROM jsonb_to_recordset(events->'view') AS x(duration NUMERIC)
    ) AS time_in_view,
    (
      SELECT sum(duration)
      FROM
        jsonb_to_recordset(events->'controller_action')
          AS x(duration NUMERIC)
    ) AS time_in_controller,
    (
      SELECT sum(duration)
      FROM jsonb_to_recordset(events->'other') AS x(duration NUMERIC)
    ) AS time_in_other
  FROM cycle_transactions
  WHERE
    transaction_type = 'request_response' AND
    name <> 'RackTransaction' AND
    start > (current_timestamp - interval '1 day')
)
SELECT
  endpoint,
  count(*) AS hits,
  avg(duration) AS avg_duration,
  avg(time_in_sql) AS avg_time_in_sql,
  avg(time_in_view) AS avg_time_in_view,
  avg(time_in_controller) AS avg_time_in_controller,
  avg(time_in_other) AS avg_time_in_other
FROM event_timings
GROUP BY endpoint
ORDER BY hits DESC;
```

We can cut down on the time this query takes (about a half second in our test environment) by combining these queries:

```postgresql
SELECT
  name AS endpoint,
  avg(duration) AS avg_duration,
  count(*) AS hits,
  avg((
    SELECT sum(duration)
    FROM jsonb_to_recordset(events->'sql') AS x(duration NUMERIC)
  )) AS avg_time_in_sql,
  avg((
    SELECT sum(duration)
    FROM jsonb_to_recordset(events->'view') AS x(duration NUMERIC)
  )) AS avg_time_in_view,
  avg((
    SELECT sum(duration)
    FROM
      jsonb_to_recordset(events->'controller_action')
        AS x(duration NUMERIC)
  )) AS avg_time_in_controller,
  avg((
    SELECT sum(duration)
    FROM jsonb_to_recordset(events->'other') AS x(duration NUMERIC)
  )) AS avg_time_in_other
FROM cycle_transactions
WHERE
  transaction_type = 'request_response' AND
  name <> 'RackTransaction' AND
  start > (current_timestamp - interval '1 day')
GROUP BY endpoint
ORDER BY hits DESC;
```

### Background Jobs

Let's first group by ID, just to see what our transactions looks like. We want an outer join because not all transactions will have events attached to them. We want the number of each kind of event

```sql
SELECT ct.id AS ct_id, ct.name AS job_name, MAX(ct.duration) AS job_duration, te.event_type, COUNT(event_type) AS event_count, MAX(te.duration) AS avg_event_duration, SUM(te.duration) AS total_event_duration
FROM cycle_transactions AS ct
LEFT JOIN transaction_events AS te
  ON ct.id = te.cycle_transaction_id
WHERE ct.transaction_type = 'background_job'
GROUP BY ct_id, job_name, event_type;
```

Now let's aggregate over this dataset, averaging out the averages for each job type:

```sql
SELECT COUNT(ct_id) AS total_executions, job_name, AVG(job_duration) AS avg_job_duration, event_type, ROUND(AVG(event_count)) AS avg_count, AVG(avg_event_duration) AS avg_duration_per_event, AVG(total_event_duration) AS avg_duration_per_event_type
FROM (
  SELECT ct.id AS ct_id, ct.name AS job_name, MAX(ct.duration) AS job_duration, te.event_type, COUNT(event_type) AS event_count, MAX(te.duration) AS avg_event_duration, SUM(te.duration) AS total_event_duration
    FROM cycle_transactions AS ct
    LEFT JOIN transaction_events AS te
      ON ct.id = te.cycle_transaction_id
    WHERE ct.transaction_type = 'background_job'
    GROUP BY ct_id, job_name, event_type
) AS events_per_job
GROUP BY job_name, event_type
ORDER BY total_executions DESC;
```

This is great, but we might want to consider using two queries, since we want separate groupings for per-job averages and per-event averages. This will also simplify our queries in general. First, let's find the average time spent per job:

```sql
SELECT name AS job_name, COUNT(*) AS total_executions, AVG(duration) AS avg_duration
  FROM cycle_transactions
  WHERE transaction_type = 'background_job'
  GROUP BY name;
```

So far so good. Now we can slightly simplify our gnarly query from before to exclude the per-job aggregates:

```sql
SELECT job_name, event_type, ROUND(AVG(event_count)) AS avg_count, AVG(avg_event_duration) AS avg_duration_per_event, AVG(total_event_duration) AS avg_duration_per_event_type
FROM (
  SELECT ct.id AS ct_id, ct.name AS job_name, MAX(ct.duration) AS job_duration, te.event_type, COUNT(event_type) AS event_count, MAX(te.duration) AS avg_event_duration, SUM(te.duration) AS total_event_duration
    FROM cycle_transactions AS ct
    INNER JOIN transaction_events AS te
      ON ct.id = te.cycle_transaction_id
    WHERE ct.transaction_type = 'background_job'
    GROUP BY ct_id, job_name, event_type
) AS events_per_job
GROUP BY job_name, event_type;
```

This is all nice, but as it stands it's not only slow, but requires additional computation after we're done with the query. Let's try to utilize our `jsonb` object to get a single, cleaner, faster query.

```sql
SELECT
  name AS job_name,
  avg(duration) AS avg_duration,
  count(*) AS hits,
  avg((
    SELECT sum(duration)
    FROM jsonb_to_recordset(events->'sql') AS x(duration NUMERIC)
  )) AS avg_time_in_sql,
  avg((
    SELECT sum(duration)
    FROM jsonb_to_recordset(events->'view') AS x(duration NUMERIC)
  )) AS avg_time_in_view,
  avg((
    SELECT sum(duration)
    FROM
      jsonb_to_recordset(events->'controller_action')
        AS x(duration NUMERIC)
  )) AS avg_time_in_controller,
  avg((
    SELECT sum(duration)
    FROM jsonb_to_recordset(events->'other') AS x(duration NUMERIC)
  )) AS avg_time_in_other
FROM cycle_transactions
WHERE
  transaction_type = 'background_job' AND
  start > (current_timestamp - interval '1 day')
GROUP BY job_name
ORDER BY hits DESC;
```

This is almost 1/4 of our previous query's time, and we get all the data we need right off the bat!

### Time Series Data

#### Memory Stats

We have a bunch of data points from samples taken about every 10 seconds. We want to aggregate those over some discrete periods of time to represent our datapoints. The first way to do this is to use `date_trunc` to reduce the precision of our `sampled_at` column:

```sql
SELECT
  date_trunc('minute', sampled_at) AS mins,
  round(avg((metrics->'memory'->>'free_memory')::INTEGER)) AS avg_free
  FROM system_health_samples
  GROUP BY mins
  ORDER BY mins ASC;
```

This works fairly well if we only need precision on time units (hours, minutes, etc.), but we'll need to use a different aggregate function if we want to group by, say, 10 minute intervals. For that, we need to do something a little bit more tricky:

```sql
SELECT to_timestamp(floor((extract('epoch' FROM sampled_at) / 600)) * 600) AS interval, round(avg((metrics->'memory'->>'free_memory')::INTEGER)) AS avg_free
  FROM system_health_samples
  GROUP BY interval
  ORDER BY interval ASC;
```

We take the epoch from our `sampled_at` column, which in effect converts it to an integer for seconds. This allows us to truncate the precision to an arbitrary amount and renormalize it to a timestamp. This is fairly slow (an hour of data yields a 3ms query), and we may need to alter this query for larger datasets, or add an index.

This is indiscriminate w/r/t machine IDs, so let's parse out the machines by their ID. Here's the data structure we're using to identify each machine:

```javascript
{
  'machine_id': hostname,
  'ip': ip
}
```

So let's concatenate those values together.

```sql
SELECT
  ((metrics->'machine_id'->>'hostname') || '@' || (metrics->'machine_id'->>'ip'))
    AS machine_id,
  to_timestamp(floor((extract('epoch' FROM sampled_at) / 600)) * 600)
    AS interval,
  round(avg((metrics->'memory'->>'free_memory')::INTEGER))
    AS avg_free
  FROM system_health_samples
  GROUP BY machine_id, interval
  ORDER BY interval ASC;
```

There's a slight problem with these results. If there is an outage, we will not get rows for the periods during which that outage persisted. We can use `generate_series` to generate a series of `0` values for our intervals. We'll use a magic value as the start of our interval, but we'll need to adjust this later on:

```sql
WITH blank_intervals AS (
  SELECT
    interval,
    0 AS blank_val
    FROM generate_series('2017-04-15 09:40', current_timestamp, '10 minutes') AS interval
),
active_intervals AS (
  SELECT
    to_timestamp(floor((extract('epoch' FROM sampled_at) / 600)) * 600)
      AS interval,
    round(avg((metrics->'memory'->>'free_memory')::INTEGER))
      AS avg_free
    FROM system_health_samples
    GROUP BY interval
    ORDER BY interval ASC
)
SELECT
  blank_intervals.interval,
  coalesce(active_intervals.avg_free, blank_intervals.blank_val)
    AS avg_free
  FROM blank_intervals
  LEFT JOIN active_intervals
    ON blank_intervals.interval = active_intervals.interval
  ORDER BY blank_intervals.interval ASC;
```

This doesn't make our initial query any slower. Now let's add all of our metrics to our query:

```sql
WITH blank_intervals AS (
  SELECT
    interval,
    0 AS blank_val
    FROM generate_series('2017-04-15 09:40', current_timestamp, '10 minutes') AS interval
),
active_intervals AS (
  SELECT
    to_timestamp(floor((extract('epoch' FROM sampled_at) / 600)) * 600)
      AS interval,
    round(avg((metrics->'memory'->>'total_memory')::INTEGER))
      AS avg_total,
    round(avg((metrics->'memory'->>'free_memory')::INTEGER))
      AS avg_free
    FROM system_health_samples
    GROUP BY interval
    ORDER BY interval ASC
)
SELECT
  blank_intervals.interval,
  coalesce(active_intervals.avg_total, blank_intervals.blank_val)
    AS avg_total,
  coalesce(active_intervals.avg_free, blank_intervals.blank_val)
    AS avg_free
  FROM blank_intervals
  LEFT JOIN active_intervals
    ON blank_intervals.interval = active_intervals.interval
  ORDER BY blank_intervals.interval ASC;
```

#### Requests and Traffic

With this in mind, it should be easy to get some time series data on requests per span of time. Let's also add an additional data point for average response time. We'll start an hourly sample.

```sql
SELECT
  date_trunc('hour', start) AS interval,
  count(*) AS hits
  FROM cycle_transactions
  WHERE transaction_type = 'request_response'
  GROUP BY date_trunc('hour', start)
  HAVING date_trunc('hour', start) > '2017-04-17 09:00'::timestamp
  ORDER BY date_trunc('hour', start) ASC;
```

This is super slow since `transaction_type` isn't indexed. We'll fix that later on.

Let's take it a step further: we can disaggregate by controller/action using either JOINs or our jsonb column. Let's see which is faster.

```sql
SELECT
  date_trunc('hour', ct.start) AS interval,
  te.data->>'controller' AS controller,
  te.data->>'action' AS action,
  count(*) AS hits
  FROM cycle_transactions AS ct
  INNER JOIN transaction_events AS te
    ON ct.id = te.cycle_transaction_id
  WHERE
    ct.transaction_type = 'request_response' AND
    te.event_type = 'controller_action'
  GROUP BY
    date_trunc('hour', ct.start),
    controller,
    action
  HAVING date_trunc('hour', ct.start) > '2017-04-17 09:00'::timestamp
  ORDER BY date_trunc('hour', ct.start) ASC;
```

This is still very slow, but we'll optimize later on. Perhaps we can avoid using a JOIN by changing how the data is structured.

```ruby
a.each do |t|
  if t.events.is_a? Array
    event_dump = t.events

    new_event_data = {
      sql: events_of_type(event_dump, 'sql'),
      view: events_of_type(event_dump, 'view'),
      controller_action: events_of_type(event_dump, 'controller_action'),
      other: other_events_from(event_dump)
    }

    t.update events: new_event_data
  end
end
```

### Querying Individual Endpoints

For our waterfall diagram, we're going to take a random sample of an individual endpoint. For now, let's just take the most recent run of our `VideosController#show` action.

```sql
SELECT start, stop, events
FROM cycle_transactions
WHERE
  app_bin_id = 7 AND
  name = 'VideosController#show'
ORDER BY id DESC
LIMIT 1;
```

Now let's pull data from our `transaction_events` table, since it'll be easier to work with than JSON:

```sql
SELECT
  data->>'sql' AS query,
  min(start) AS start,
  max(stop) AS stop,
  count(*)
FROM transaction_events
WHERE
  cycle_transaction_id = (
    SELECT id
    FROM cycle_transactions
    WHERE app_bin_id = 7 AND name = 'VideosController#show'
    ORDER BY id DESC
    LIMIT 1
  ) AND
  event_type = 'sql'
GROUP BY query;
```

This gives us all the sql queries for a given action. Since our JSON structure varies between each event type, our first approach will be to use a separate query for each event type.

Here's the query for the transaction as a whole:

```sql
SELECT start, stop
FROM cycle_transactions
WHERE
  app_bin_id = 7 AND
  name = 'VideosController#show'
ORDER BY id DESC
LIMIT 1;
```

Endpoint:

```sql
SELECT
  ((data->>'controller') || '#') || (data->>'action') AS endpoint,
  min(start) AS start,
  max(stop) AS stop,
  count(*)
FROM transaction_events
WHERE
  cycle_transaction_id = (
    SELECT id
    FROM cycle_transactions
    WHERE app_bin_id = 7 AND name = 'VideosController#show'
    ORDER BY id DESC
    LIMIT 1
  ) AND
  event_type = 'controller_action'
GROUP BY endpoint;
```

We want to keep it general, so we'll keep the groupings for this.

Views:

```sql
SELECT
  data->>'identifier' AS template,
  min(start) AS start,
  max(stop) AS stop,
  count(*)
FROM transaction_events
WHERE
  cycle_transaction_id = (
    SELECT id
    FROM cycle_transactions
    WHERE app_bin_id = 7 AND name = 'VideosController#show'
    ORDER BY id DESC
    LIMIT 1
  ) AND
  event_type = 'view'
GROUP BY template;
```

Now it's a matter of splicing them all together. For the first iteration we'll do that on the application layer.
