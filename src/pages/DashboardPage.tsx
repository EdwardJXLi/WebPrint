import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/LoadingScreen';
import { apiRequest } from '../lib/api';
import type { DashboardStats, Job, Printer } from '../types';
import { getErrorMessage } from '../utils/errors';
import { formatDateTime, titleCase } from '../utils/format';

const statCards = [
  { key: 'activeJobs', label: 'My Active Jobs' },
  { key: 'queuedJobs', label: 'My Queued Jobs' },
  { key: 'completedJobs', label: 'My Completed Jobs' },
  { key: 'availablePrinters', label: 'Available Printers' },
] as const;

interface DashboardResponse {
  stats: DashboardStats;
  printers: Printer[];
  recentJobs: Job[];
}

const emptyDashboard: DashboardResponse = {
  stats: {
    activeJobs: 0,
    queuedJobs: 0,
    completedJobs: 0,
    availablePrinters: 0,
  },
  printers: [],
  recentJobs: [],
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardResponse>(emptyDashboard);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiRequest<DashboardResponse>('/api/dashboard');
      setData(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return <LoadingScreen label="Loading dashboard" />;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Printer availability and your recent activity.</p>
        </div>
        <div className="hidden flex-wrap justify-end gap-2 sm:flex">
          <Link className="button-primary whitespace-nowrap" to="/jobs/new">
            New Print Job
          </Link>
          <button className="button-secondary" onClick={loadDashboard} type="button">
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="panel border-l-4 border-l-green-700 p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950 sm:text-lg">Start a print job</h2>
            <p className="mt-1 text-sm text-slate-600">Upload a document, choose a printer, and submit in one step.</p>
          </div>
          <Link className="button-primary md:min-w-40" to="/jobs/new">
            Print Document
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
        {statCards.map((card) => (
          <div className="panel p-4 sm:p-5" key={card.key}>
            <div className="text-xs font-medium text-slate-500 sm:text-sm">{card.label}</div>
            <div className="mt-1.5 text-2xl font-semibold text-slate-950 sm:mt-2 sm:text-3xl">{data.stats[card.key] ?? 0}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 sm:gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-950">My Recent Jobs</h2>
            <Link className="text-sm font-medium text-green-700 hover:text-green-800" to="/jobs">
              View all
            </Link>
          </div>

          {data.recentJobs.length ? (
            <>
            <div className="mt-4 space-y-3 sm:hidden">
              {data.recentJobs.map((job) => (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={job.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-950">{job.original_file_name}</div>
                      <div className="mt-1 text-xs text-slate-500">{job.printerName}</div>
                    </div>
                    <Badge tone={job.status}>{titleCase(job.status)}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{formatDateTime(job.created_at)}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 hidden overflow-x-auto sm:block">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">Document</th>
                    <th className="pb-3 pr-4 font-medium">Printer</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.recentJobs.map((job) => (
                    <tr key={job.id}>
                      <td className="py-3 pr-4 text-slate-950">{job.original_file_name}</td>
                      <td className="py-3 pr-4 text-slate-700">{job.printerName}</td>
                      <td className="py-3 pr-4">
                        <Badge tone={job.status}>{titleCase(job.status)}</Badge>
                      </td>
                      <td className="py-3 text-slate-600">{formatDateTime(job.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <div className="mt-5">
              <EmptyState
                title="No print jobs yet"
                description="Submit a job to see your recent activity here."
              />
            </div>
          )}
        </div>

        <div className="panel p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-950">Printers</h2>
            <span className="text-sm text-slate-500">Available queues</span>
          </div>

          <div className="mt-4 space-y-3 sm:mt-5">
            {data.printers.length ? (
              data.printers.map((printer) => (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4" key={printer.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-slate-950">{printer.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{printer.description || printer.ipp_uri}</div>
                    </div>
                    <Badge tone={printer.enabled ? 'idle' : 'stopped'}>
                      {printer.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No printers configured"
                description="An administrator must add at least one printer before jobs can be submitted."
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
