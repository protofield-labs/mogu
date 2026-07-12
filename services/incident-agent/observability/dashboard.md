# incident-agent compression dashboard

Cloud Monitoring dashboard panels for I5 compression metrics.

## Counters

| Metric | Emitted when |
| --- | --- |
| `incident_agent.alerts.received` | First Pub/Sub checkpoint for a new `message_id` |
| `incident_agent.incidents.opened` | New `ops.incidents` row enters `investigating` |
| `incident_agent.issues.opened` | `github_issue` outbox row reaches `sent` |
| `incident_agent.investigations.completed` | LoopAgent analysis persisted |

## Example MQL (ratio panels)

Alert → incident compression (higher = more noise absorbed upstream):

```
fetch global
| metric 'workload.googleapis.com/incident_agent.alerts.received'
| align rate(1m)
| every 1m
| group_by [], [value_alerts: sum(value)]
| join
  (fetch global
   | metric 'workload.googleapis.com/incident_agent.incidents.opened'
   | align rate(1m)
   | every 1m
   | group_by [], [value_incidents: sum(value)]),
  on()
| value [value_incidents / value_alerts]
```

Incident → issue compression (target ≈ 1 after outbox delivery):

```
fetch global
| metric 'workload.googleapis.com/incident_agent.incidents.opened'
| align rate(1m)
| every 1m
| group_by [], [value_incidents: sum(value)]
| join
  (fetch global
   | metric 'workload.googleapis.com/incident_agent.issues.opened'
   | align rate(1m)
   | every 1m
   | group_by [], [value_issues: sum(value)]),
  on()
| value [value_issues / value_incidents]
```

Adjust metric names to the exported `custom.googleapis.com/` or
`workload.googleapis.com/` prefix shown in Metrics Explorer after deploy.
