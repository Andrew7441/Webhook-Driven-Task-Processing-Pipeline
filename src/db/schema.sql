-- pipelines define webhook workflows
CREATE TABLE pipelines(
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    source_key TEXT UNIQUE NOT NULL,
    action_type TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- endpoints that receive processed results
CREATE TABLE pipeline_subscribers(
    id SERIAL PRIMARY KEY,
    pipeline_id INTEGER REFERENCES pipelines(id) ON DELETE CASCADE,
    target_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- each webhook becomes a background job
CREATE TABLE jobs(
    id SERIAL PRIMARY KEY,
    pipeline_id INTEGER REFERENCES pipelines(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- delivery attempts to subscribers
CREATE TABLE job_deliveries(
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    subscriber_url TEXT NOT NULL,
    attempt INTEGER DEFAULT 1,
    status TEXT,
    response_code INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);