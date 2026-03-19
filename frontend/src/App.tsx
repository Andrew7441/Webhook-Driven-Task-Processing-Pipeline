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

interface Metrics {
  pipelines: number;
  jobs: { total: number; completed: number; failed: number };
  deliveries: { total: number };
}

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

export default function App() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchData() {
    try {
      setError(null);
      // Use relative /api URLs – these will be proxied by vite.config.ts
      const [pRes, jRes, mRes] = await Promise.all([
        fetch("/api/pipelines"),
        fetch("/api/jobs"),
        fetch("/api/metrics"),
      ]);

      if (!pRes.ok || !jRes.ok || !mRes.ok) {
      throw new Error(
          `API error: pipelines=${pRes.status}, jobs=${jRes.status}, metrics=${mRes.status}`
        );
      }

      const [p, j, m] = await Promise.all([
        pRes.json() as Promise<Pipeline[]>,
        jRes.json() as Promise<Job[]>,
        mRes.json() as Promise<Metrics>,
      ]);

      setPipelines(p);
      setJobs(j);
      setMetrics(m);
    } catch (err: any) {
      setError(err?.message ?? "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(fetchData, 5000);
    return () => window.clearInterval(interval);
  }, []);

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

      <section>
        <h2 className="text-2xl font-semibold mb-4">Jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No jobs found.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((j) => (
              <div
                key={j.id}
                className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex justify-between items-center"
              >
                <div>
                  <p className="font-medium">
                    Job #{j.id}
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      (Pipeline {j.pipeline_id})
                    </span>
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
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}