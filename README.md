# tracebin

## SQL Notes

Here is a list of our query plans for aggregating data from the database.

### Accessing JSON Objects

```sql
SELECT (data->'sql.active_record'->1->'event_payload'->'query')::text AS sql_payload, AVG(duration)
  FROM cycle_transactions
  GROUP BY sql_payload;
```

The above query takes an average of about 3.9ms. Note that we're only retrieving the first element of each `sql.active_record` array. To do that, we need to aggregate on the set:

```sql
SELECT id, (event->'event_payload'->'query')::text AS query, AVG(duration)
  FROM (
    SELECT id, json_array_elements(data->'sql.active_record') AS event, duration
      FROM cycle_transactions
  ) AS elements
  GROUP BY id, query;
```

This takes an average of 5ms.

### Using JOINs

```sql
SELECT ct.id, sql_events.query, AVG(sql_events.duration)
  FROM sql_events
  INNER JOIN cycle_transactions AS ct
    ON ct.id = sql_events.cycle_transaction_id
  GROUP BY ct.id, query;
```

This takes a 1.25ms on average.
