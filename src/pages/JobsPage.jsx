import { useCallback, useEffect, useMemo, useState } from 'react';

import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import { apiRequest } from '../lib/api.js';
import { formatDateTime, titleCase } from '../utils/format.js';

const filters = [
  { key: 'all', label: 'All jobs' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

const colorModeLabel = (value) => (value === 'monochrome' ? 'grayscale' : 'color');

export default function JobsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [jobs, setJobs] = useState([]);

  const loadJobs = useCallback(async (filter = selectedFilter) => {
    setLoading(true);
    setError('');

    try {
      const data = await apiRequest(`/api/jobs?status=${filter}`);
      setJobs(data.jobs);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [selectedFilter]);

  useEffect(() => {
    loadJobs(selectedFilter);
  }, [loadJobs, selectedFilter]);

  const sortedJobs = useMemo(() => jobs, [jobs]);

  const cancelJob = async (jobId) => {
    try {
      await apiRequest(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
      await loadJobs(selectedFilter);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (loading) {
    return <LoadingScreen label="Loading print jobs" />;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Print Jobs</h1>
          <p className="mt-1 text-sm text-slate-500">Queued, active, and completed jobs.</p>
        </div>
        <div className="flex w-full gap-2 overflow-x-auto sm:w-auto sm:flex-wrap">
          {filters.map((filter) => (
            <button
              className={
                filter.key === selectedFilter ? 'button-primary' : 'button-secondary'
              }
              key={filter.key}
              onClick={() => setSelectedFilter(filter.key)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {sortedJobs.length ? (
        <>
        <div className="space-y-3 sm:hidden">
          {sortedJobs.map((job) => (
            <div className="panel p-4" key={job.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-950">{job.original_file_name}</div>
                  <div className="mt-1 text-xs text-slate-500">{job.mime_type}</div>
                </div>
                <Badge tone={job.status}>{titleCase(job.status)}</Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <div>{job.printerName}</div>
                <div>{job.copies} copies • {job.duplex} • {colorModeLabel(job.color_mode)}</div>
                <div className="text-xs text-slate-500">{formatDateTime(job.created_at)}</div>
                {job.status_detail && <div className="text-xs text-slate-500">{job.status_detail}</div>}
              </div>
              {job.canCancel && (
                <button
                  className="button-secondary mt-4 w-full"
                  onClick={() => cancelJob(job.id)}
                  type="button"
                >
                  Cancel
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="panel hidden overflow-hidden sm:block">
          <div className="overflow-x-auto px-6 py-4">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Document</th>
                  <th className="pb-3 pr-4 font-medium">Printer</th>
                  <th className="pb-3 pr-4 font-medium">Options</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Submitted</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="py-4 pr-4 align-top">
                      <div className="font-medium text-slate-950">{job.original_file_name}</div>
                      <div className="mt-1 text-xs text-slate-500">{job.mime_type}</div>
                    </td>
                    <td className="py-4 pr-4 align-top text-slate-700">{job.printerName}</td>
                    <td className="py-4 pr-4 align-top text-slate-600">
                      {job.copies} copies • {job.duplex} • {colorModeLabel(job.color_mode)}
                    </td>
                    <td className="py-4 pr-4 align-top">
                      <div className="flex flex-col gap-2">
                        <Badge tone={job.status}>{titleCase(job.status)}</Badge>
                        {job.status_detail && (
                          <span className="max-w-xs text-xs text-slate-500">{job.status_detail}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 pr-4 align-top text-slate-600">{formatDateTime(job.created_at)}</td>
                    <td className="py-4 align-top">
                      {job.canCancel ? (
                        <button
                          className="button-secondary"
                          onClick={() => cancelJob(job.id)}
                          type="button"
                        >
                          Cancel
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">No actions</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      ) : (
        <EmptyState
          title="No jobs match this filter"
          description="Try a different filter or submit a new print job."
        />
      )}
    </div>
  );
}
