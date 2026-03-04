# Webhook-Driven Task Processing Pipeline

A webhook ingestion service that queues jobs for background processing and delivers processed results to registered subscribers

## Features

- Pipelines: a source webhook URL + processing action + subscribers
- Webhook ingestion: enqueue job (asynchronous)
- Worker executes job from queue
- Multiple action types
- Delivery attempts with retry + backoff + handle edge cases
- Job status + history + delivery attempt inspection 
- Docker Compose local stack
- Github Actions Continuous Integration

## Technology Stack

- TypeScript
- PostgreSQL
- Docker / Docker compose
- Github Actions

## QuickStart 
```bash
docker compose up --build
```

## API (High-Level)
- Pipeline CRUD: create/list/get/update/delete
- Webhook ingest: POST /hooks/:sourcekey
- Jobs: list/get/status + history
- Deliveries: attempts per job/subscriber

## Architecture
- API Service: validates request, writes DB, enqueues jobs
- Queue: Stores pending jobs 
- Worker: Pulls jobs, runs action, records output, delivers to subscribers
- Delivery: retry logic, attempt logs, terminal states

## Action Types

- TODO min. 3

## Reliability notes

- Retry/Backoff strategy: TODO
- Failure Modes: TODO

## Continuous Integration

- Lint + Typecheck + tests
- Build docker images

## Design Decisions

- TODO: why queue choice, schema choice, retry approach, etc.