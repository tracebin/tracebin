# tracebin

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
