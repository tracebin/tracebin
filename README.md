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
