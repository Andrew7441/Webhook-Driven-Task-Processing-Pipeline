import { useEffect, useState } from "react";

interface Pipeline {
  id: number;
  name: string;
  source_key: string;
  action_type: string;
  created_at?: string;
}

interface Job {
  id: number;
  pipeline_id: number;
  status: string;
  created_at?: string;
}

interface JobDetails extends Job {
  payload: unknown;
  result?: unknown;
  error?: string | null;
  processed_at?: string | null;
}

interface DeliveryAttempt {
  id: number;
  job_id: number;
  subscriber_url: string;
  attempt: number;
  status?: string | null;
  response_code?: number | null;
  created_at?: string;
}

interface Metrics {
  pipelines: number;
  jobs: {
    total: number;
    completed: number;
    failed: number;
  };
  deliveries: {
    total: number;
  };
}

//UI component that displays metric label with values as a styled card
function MetricCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="p-4 border rounded-xl bg-white dark:bg-gray-800 shadow-sm flex flex-col">
      <span className="text-sm text-gray-500 dark:text-gray-400">{title}</span>
      <span className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">
        {value}
      </span>
    </div>
  );
}

//helper function that formats date string into readable date/time
function formatDate(value?: string | null) {
  if (!value) return "—"; // if value is missing return -
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value; // if value invalid, it returns the original value
  return date.toLocaleString();
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-xl bg-gray-100 dark:bg-gray-900 p-4 text-sm text-gray-800 dark:text-gray-200">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function App() {    //useState is for storing and updating data in the UI
  const [pipelines, setPipelines] = useState<Pipeline[]>([]); // useState gives the current pipelines value and a setter; setPipelines(newData) updates pipelines
  const [jobs, setJobs] = useState<Job[]>([]); // stores the recent jobs shown in the dashboard
  const [metrics, setMetrics] = useState<Metrics | null>(null); // stores system summary metrics like counts
  const [error, setError] = useState<string | null>(null); // stores a user-friendly error message if fetching fails
  const [isLoading, setIsLoading] = useState(true); // controls the initial loading screen while dashboard data is being fetched

  const [selectedJobId, setSelectedJobId] = useState<number | null>(null); // stores which job the user clicked, then 
  const [selectedJob, setSelectedJob] = useState<JobDetails | null>(null); // stores the full details of that job, and shows it to user
  const [deliveries, setDeliveries] = useState<DeliveryAttempt[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  async function fetchData() {
    try {

      const [pRes, jRes, mRes] = await Promise.all([
        fetch("/api/pipelines"),
        fetch("/api/jobs"),
        fetch("/api/metrics"),
      ]);

      //edge case
      if (!pRes.ok || !jRes.ok || !mRes.ok) {
        throw new Error(
          `API error: pipelines=${pRes.status}, jobs=${jRes.status}, metrics=${mRes.status}`
        );
      }

      // parse all three successful API responses into typed JSON objects, do all 3 at the same time 
      const [p, j, m] = await Promise.all([
        pRes.json() as Promise<Pipeline[]>,
        jRes.json() as Promise<Job[]>,
        mRes.json() as Promise<Metrics>,
      ]);

      // pass in data 
      setPipelines(p);
      setJobs(j);
      setMetrics(m);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchJobDetails(jobId: number) {
    try {
      setDetailsLoading(true);
      setDetailsError(null);

      const [jobRes, deliveriesRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}`),
        fetch(`/api/jobs/${jobId}/deliveries`),
      ]);

      //edge case
      if (!jobRes.ok || !deliveriesRes.ok) {
        throw new Error(
          `Job details error: job=${jobRes.status}, deliveries=${deliveriesRes.status}`
        );
      }

      //same thing as pipeline, parse successful api responses as json objects
      const [jobData, deliveriesData] = await Promise.all([
        jobRes.json() as Promise<JobDetails>,
        deliveriesRes.json() as Promise<DeliveryAttempt[]>,
      ]);

      setSelectedJob(jobData);
      setDeliveries(deliveriesData);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDetailsError(err.message);
      } else {
        setDetailsError("Failed to load job details");
      }
    } finally {
      setDetailsLoading(false);
    }
  }
  // select a job and load its details
  function handleSelectJob(jobId: number) {
    setSelectedJobId(jobId);
    fetchJobDetails(jobId);
  }
  // runs side effects after component renders
  //loads dashboard data on mount, and auto refresh every 5 sec
  useEffect(() => {
    // load main dashboard data when component mounts
    fetchData();

    // refresh dashboard data every 5 seconds.
    const interval = window.setInterval(() => {
      fetchData();
      if (selectedJobId !== null) {
        fetchJobDetails(selectedJobId);
      }
    }, 5000);

    // clear interval when component unmounts or when selected jobId changes
    return () => window.clearInterval(interval);
  }, [selectedJobId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-300">Loading dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-lg w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Error loading data
          </h1>
          <p className="text-gray-700 dark:text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => {
              setIsLoading(true);
              fetchData();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-6">
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Webhook Pipeline Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor pipelines, jobs, and metrics in real time
          </p>
        </div>
        <button
          onClick={fetchData}
          className="mt-4 md:mt-0 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          Refresh Now
        </button>
      </header>

      {metrics && (
        <section className="mb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <MetricCard title="Total Pipelines" value={metrics.pipelines} />
          <MetricCard title="Total Jobs" value={metrics.jobs.total} />
          <MetricCard title="Deliveries" value={metrics.deliveries.total} />
          <MetricCard title="Jobs Completed" value={metrics.jobs.completed} />
          <MetricCard title="Jobs Failed" value={metrics.jobs.failed} />
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Pipelines</h2>
        {pipelines.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No pipelines found.</p>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {pipelines.map((p) => (
              <div
                key={p.id}
                className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl hover:shadow-lg transition-shadow"
              >
                <h3 className="font-bold mb-1">{p.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Action: {p.action_type}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Source Key: {p.source_key}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No jobs found.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => handleSelectJob(j.id)}
                className={`w-full text-left p-3 bg-white dark:bg-gray-800 border rounded-xl flex justify-between items-center transition ${
                  selectedJobId === j.id
                    ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900"
                    : "border-gray-200 dark:border-gray-700 hover:shadow-md"
                }`}
              >
                <div>
                  <p className="font-medium">
                    Job #{j.id}
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      (Pipeline {j.pipeline_id})
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Created: {formatDate(j.created_at)}
                  </p>
                </div>

                <span
                  className={`text-sm font-semibold px-2 py-1 rounded-full ${
                    j.status === "completed"
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : j.status === "failed"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                  }`}
                >
                  {j.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Job Details</h2>
          {selectedJobId !== null && (
            <button
              onClick={() => {
                setSelectedJobId(null);
                setSelectedJob(null);
                setDeliveries([]);
                setDetailsError(null);
              }}
              className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Clear Selection
            </button>
          )}
        </div>

        {selectedJobId === null ? (
          <p className="text-gray-500 dark:text-gray-400">
            Click a job to view payload, result, error, processed time, and delivery attempts.
          </p>
        ) : detailsLoading ? (
          <div className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl">
            <p className="text-gray-600 dark:text-gray-300">Loading job details…</p>
          </div>
        ) : detailsError ? (
          <div className="p-5 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900 rounded-2xl">
            <p className="text-red-600 dark:text-red-400">{detailsError}</p>
          </div>
        ) : selectedJob ? (
          <div className="space-y-6">
            <div className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Job ID</p>
                  <p className="font-semibold">#{selectedJob.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Pipeline ID</p>
                  <p className="font-semibold">{selectedJob.pipeline_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                  <p className="font-semibold">{selectedJob.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Processed At</p>
                  <p className="font-semibold">{formatDate(selectedJob.processed_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Created At</p>
                  <p className="font-semibold">{formatDate(selectedJob.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Error</p>
                  <p className="font-semibold text-red-600 dark:text-red-400">
                    {selectedJob.error ?? "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl">
              <h3 className="text-lg font-semibold mb-2">Payload</h3>
              <JsonBlock value={selectedJob.payload} />
            </div>

            <div className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl">
              <h3 className="text-lg font-semibold mb-2">Result</h3>
              <JsonBlock value={selectedJob.result ?? { message: "No result available" }} />
            </div>

            <div className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl">
              <h3 className="text-lg font-semibold mb-4">Delivery Attempts</h3>

              {deliveries.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  No delivery attempts recorded for this job.
                </p>
              ) : (
                <div className="space-y-3">
                  {deliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Subscriber URL: </span>
                          <span className="break-all">{delivery.subscriber_url}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Attempt: </span>
                          <span>{delivery.attempt}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Status: </span>
                          <span>{delivery.status ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Response Code: </span>
                          <span>{delivery.response_code ?? "—"}</span>
                        </div>
                        <div className="md:col-span-2">
                          <span className="text-gray-500 dark:text-gray-400">Created At: </span>
                          <span>{formatDate(delivery.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}