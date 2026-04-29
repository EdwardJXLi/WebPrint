import { useCallback, useEffect, useMemo, useState } from 'react';

import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import { apiRequest } from '../lib/api.js';
import { formatDateTime, titleCase } from '../utils/format.js';

const initialPrinterForm = {
  id: null,
  name: '',
  ippUri: '',
  description: '',
  enabled: true,
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [printers, setPrinters] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [liveStatus, setLiveStatus] = useState({});
  const [printerForm, setPrinterForm] = useState(initialPrinterForm);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [printerResponse, jobResponse] = await Promise.all([
        apiRequest('/api/printers'),
        apiRequest('/api/jobs?status=all'),
      ]);
      setPrinters(printerResponse.printers);
      setJobs(jobResponse.jobs);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const resetForm = () => {
    setPrinterForm(initialPrinterForm);
  };

  const handleSavePrinter = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: printerForm.name,
        ippUri: printerForm.ippUri,
        description: printerForm.description,
        enabled: printerForm.enabled,
      };

      if (printerForm.id) {
        await apiRequest(`/api/printers/${printerForm.id}`, { method: 'PUT', body: payload });
        setSuccess('Printer updated successfully.');
      } else {
        await apiRequest('/api/printers', { method: 'POST', body: payload });
        setSuccess('Printer added successfully.');
      }

      setPrinterForm(initialPrinterForm);
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrinter = async () => {
    setTesting(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiRequest('/api/printers/test', {
        method: 'POST',
        body: { ippUri: printerForm.ippUri },
      });
      setSuccess(
        `Connectivity OK — ${response.status.printerState}${
          response.status.stateMessage ? ` (${response.status.stateMessage})` : ''
        }`,
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setTesting(false);
    }
  };

  const handleDetectPrinters = async () => {
    setDetecting(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiRequest('/api/printers/sync', { method: 'POST' });
      const createdCount = response.sync.created.length;
      const updatedCount = response.sync.updated.length;
      const skippedCount = response.sync.skipped.length;

      setPrinters(response.printers);
      setSuccess(
        `CUPS detection complete. Added ${createdCount}, refreshed ${updatedCount}${
          skippedCount ? `, skipped ${skippedCount}` : ''
        }.`,
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDetecting(false);
    }
  };

  const handleDeletePrinter = async (printerId) => {
    try {
      await apiRequest(`/api/printers/${printerId}`, { method: 'DELETE' });
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const refreshPrinterStatus = async (printerId) => {
    try {
      const response = await apiRequest(`/api/printers/${printerId}/status`);
      setLiveStatus((current) => ({ ...current, [printerId]: response.status }));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const cancelJob = async (jobId) => {
    try {
      await apiRequest(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const sortedPrinters = useMemo(() => printers, [printers]);

  if (loading) {
    return <LoadingScreen label="Loading admin tools" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Admin</h1>
        <p className="mt-1 text-sm text-slate-500">Printers, queues, and job oversight.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="panel space-y-5 p-6" onSubmit={handleSavePrinter}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-950">
              {printerForm.id ? 'Edit Printer' : 'Add Printer'}
            </h2>
            {printerForm.id && (
              <button className="button-secondary" onClick={resetForm} type="button">
                Clear
              </button>
            )}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
            <input
              className="field"
              onChange={(event) => setPrinterForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Office Printer"
              required
              value={printerForm.name}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">IPP URI or queue name</span>
            <input
              className="field"
              onChange={(event) => setPrinterForm((current) => ({ ...current, ippUri: event.target.value }))}
              placeholder="ipp://cups:631/printers/office or office"
              required
              value={printerForm.ippUri}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Description</span>
            <textarea
              className="field min-h-28 resize-y"
              onChange={(event) => setPrinterForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Floor 2 monochrome laser printer"
              value={printerForm.description}
            />
          </label>

          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              checked={printerForm.enabled}
              className="h-4 w-4 rounded border-slate-300 accent-green-700"
              onChange={(event) => setPrinterForm((current) => ({ ...current, enabled: event.target.checked }))}
              type="checkbox"
            />
            Printer enabled
          </label>

          <div className="flex flex-wrap justify-end gap-3">
            <button className="button-secondary" disabled={testing} onClick={handleTestPrinter} type="button">
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            <button className="button-primary" disabled={saving} type="submit">
              {saving ? 'Saving…' : printerForm.id ? 'Update Printer' : 'Add Printer'}
            </button>
          </div>
        </form>

        <div className="panel p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-950">Configured Printers</h2>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="button-secondary" disabled={detecting} onClick={handleDetectPrinters} type="button">
                {detecting ? 'Detecting…' : 'Detect from CUPS'}
              </button>
              <button className="button-secondary" onClick={loadAdminData} type="button">
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {sortedPrinters.length ? (
              sortedPrinters.map((printer) => {
                const status = liveStatus[printer.id];
                return (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={printer.id}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="font-medium text-slate-950">{printer.name}</div>
                          <Badge tone={printer.enabled ? 'idle' : 'stopped'}>
                            {printer.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                        <div className="mt-1 text-sm text-slate-600">{printer.description || printer.ipp_uri}</div>
                        <div className="mt-2 text-xs text-slate-500">{printer.ipp_uri}</div>

                        {status && (
                          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                            <div className="flex items-center gap-3">
                              <Badge tone={status.printerState}>{titleCase(status.printerState)}</Badge>
                              <span>
                                {status.acceptingJobs ? 'Accepting jobs' : 'Not accepting jobs'} • Queue: {status.queuedJobCount}
                              </span>
                            </div>
                            {status.jobs.length ? (
                              <div className="mt-3 space-y-2">
                                {status.jobs.map((job) => (
                                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" key={`${printer.id}-${job.externalJobId}`}>
                                    <div className="flex items-center justify-between gap-4">
                                      <span className="text-slate-950">{job.name}</span>
                                      <Badge tone={job.status}>{titleCase(job.status)}</Badge>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      Job #{job.externalJobId} • {job.owner || 'Unknown owner'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-3 text-xs text-slate-500">No live jobs currently in queue.</div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          className="button-secondary"
                          onClick={() => setPrinterForm({
                            id: printer.id,
                            name: printer.name,
                            ippUri: printer.ipp_uri,
                            description: printer.description,
                            enabled: printer.enabled,
                          })}
                          type="button"
                        >
                          Edit
                        </button>
                        <button className="button-secondary" onClick={() => refreshPrinterStatus(printer.id)} type="button">
                          Live Queue
                        </button>
                        <button className="button-secondary" onClick={() => handleDeletePrinter(printer.id)} type="button">
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                title="No printers configured"
                description="Add a printer to start receiving jobs from the portal."
              />
            )}
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 pt-6">
          <h2 className="text-lg font-semibold text-slate-950">Job Oversight</h2>
          <span className="text-sm text-slate-500">All users</span>
        </div>

        {jobs.length ? (
          <div className="overflow-x-auto px-6 py-4">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="pb-3 pr-4 font-medium">User</th>
                  <th className="pb-3 pr-4 font-medium">Document</th>
                  <th className="pb-3 pr-4 font-medium">Printer</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Submitted</th>
                  <th className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="py-4 pr-4 align-top">
                      <div className="text-slate-950">{job.userName}</div>
                      <div className="text-xs text-slate-500">{job.userEmail}</div>
                    </td>
                    <td className="py-4 pr-4 align-top text-slate-950">{job.original_file_name}</td>
                    <td className="py-4 pr-4 align-top text-slate-700">{job.printerName}</td>
                    <td className="py-4 pr-4 align-top">
                      <Badge tone={job.status}>{titleCase(job.status)}</Badge>
                    </td>
                    <td className="py-4 pr-4 align-top text-slate-600">{formatDateTime(job.created_at)}</td>
                    <td className="py-4 align-top">
                      {job.canCancel ? (
                        <button className="button-secondary" onClick={() => cancelJob(job.id)} type="button">
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
        ) : (
          <div className="px-6 pb-6 pt-2">
            <EmptyState
              title="No jobs available"
              description="Jobs from all users will appear here for review."
            />
          </div>
        )}
      </section>
    </div>
  );
}
