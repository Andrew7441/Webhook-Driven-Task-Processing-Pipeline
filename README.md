# Webhook-Driven Task Processing Pipeline

A TypeScript backend service that receives webhooks, queues them as jobs, processes them in the background, and delivers the processed
result to registered subscriber URLs.

## Features

- Create and manage pipelines
- Receive webhooks through unique pipeline source URLs
- Queue jobs for asynchronous background processing
- Worker safely claims and processes pending jobs
- Three processing action types:
    - extract_commits
    - uppercase_repo
    - echo
- Register subscribers per pipeline
- Deliver processed results to subscribers 
- Retry failed deliveries with a simple backoff
- Track delivery attempts in the database
- Query job status, result, error, and delivery history
- Run the full system with Docker Compose
- GitHub Actions CI/CD for linting, build, and Docker verification

## Technology Stack

- TypeScript
- Express
- PostgreSQL
- Docker / Docker Compose
- GitHub Actions

## Architecture

The system is split into three main parts:

1. API Service

Responsible for:
- pipeline creation and listing
- subscriber registration
- webhook ingestion
- job status / history endpoints

2. PostgreSQL

Stores:
- pipelines
- subscribers
- jobs
- delivery attempts

3. Worker

Responsible For:
- polling for pending jobs
- safely claiming jobs using database locking
- processing payloads based on 'action_type'
- updating job status/results
- delivering processed results to subscribers
- retrying failed deliveries

### High-Level Flow
```text
Create pipeline
      │
      ▼
Send webhook to /hooks/:sourceKey
      │
      ▼
API finds matching pipeline
      │
      ▼
Job inserted into jobs table (pending)
      │
      ▼
Worker claims job
      │
      ▼
runAction(action_type, payload)
      │
      ├─ success -> mark completed -> deliver to subscribers
      │
      └─ failure -> mark failed
```

## Database Schema

### pipelines
Stores workflow configuration
- id
- name
- source_key
- action_type
- created_at

### pipeline_subscribers
Stores subscriber URLs for each pipeline
- id 
- pipeline_id
- target_url
- created_at

### jobs
Stores queued webhook events and processing results
- id 
- pipeline_id
- payload
- status
- created_at
- processed_at 
- result
- error

### job_deliveries
Stores subscriber delivery attempts

- id
- job_id
- subscriber_url
- attempt
- status
- response_code
- created_at

## Processing Action Types

### extract_commits
Returns only commit and repository information

Example:
```json
{
  "commit": "abc123",
  "repository": "demo-repo"
}
```

### uppercase_repo
Uppercases the repository name

Example:
```json
{
  "repository": "DEMO-REPO"
}
```

### echo 
Returns the payload unchanged
Example:
```json
{
  "payload": {
    "hello": "world"
  }
}
```
## Quick Start 
```bash
docker compose up --build
```
This starts:
- PostgreSQL
- API service
- Worker service

## Reliability notes

- Jobs are processed asynchronously so webhook requests return quickly without waiting for processing to finish.

- The worker claims pending jobs safely using database locking (FOR UPDATE SKIP LOCKED) to prevent multiple workers from processing the same job.

- Failed subscriber deliveries are retried with simple backoff, and each attempt is recorded in job_deliveries.

- Job processing failures are stored in the jobs table, while delivery failures are tracked separately in job_deliveries.

## Continuous Integration

- Lint the code with ESLint
- Build the TypeScript project
- Verify Docker containers build successfully with GitHub Actions

## Design Decisions

- PostgreSQL is used both as the main database and as the job queue to keep the architecture simple and easy to inspect.

- A separate worker process handles background jobs so webhook ingestion stays fast and non-blocking.

- Delivery attempts are stored in a separate table to make retry tracking and debugging clearer.

- Processing actions are kept simple and separated by 'action_type' so the system is easy to extend later.
