import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import EmptyState from '../components/EmptyState.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import { apiRequest } from '../lib/api.js';

const initialState = {
  printerId: '',
  copies: 1,
  duplex: 'one-sided',
  colorMode: 'color',
  file: null,
};

export default function NewJobPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [printers, setPrinters] = useState([]);
  const [form, setForm] = useState(initialState);

  useEffect(() => {
    const loadPrinters = async () => {
      try {
        const data = await apiRequest('/api/printers');
        setPrinters(data.printers.filter((printer) => printer.enabled));
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };

    loadPrinters();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.file) {
      setError('Choose a file before submitting.');
      return;
    }

    setSaving(true);

    try {
      const payload = new FormData();
      payload.append('printerId', form.printerId);
      payload.append('copies', String(form.copies));
      payload.append('duplex', form.duplex);
      payload.append('colorMode', form.colorMode);
      payload.append('file', form.file);

      await apiRequest('/api/jobs', {
        method: 'POST',
        body: payload,
      });

      setSuccess('Print job submitted successfully.');
      setForm({ ...initialState, printerId: form.printerId || '' });
      setTimeout(() => navigate('/jobs'), 700);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen label="Loading printers" />;
  }

  if (!printers.length) {
    return (
      <EmptyState
        title="No enabled printers available"
        description="An administrator needs to configure and enable at least one printer."
      />
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">New Print Job</h1>
        <p className="mt-1 text-sm text-slate-500">Upload a document and choose printer options.</p>
      </div>

      <form className="panel max-w-3xl space-y-5 p-4 sm:space-y-6 sm:p-6" onSubmit={handleSubmit}>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

        <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">File</span>
            <input
              accept="application/pdf,image/png,image/jpeg,image/gif,image/webp,image/bmp,image/tiff"
              className="field file:mr-4 file:rounded-md file:border-0 file:bg-green-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              onChange={(event) => setForm((current) => ({ ...current, file: event.target.files?.[0] || null }))}
              type="file"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Printer</span>
            <select
              className="field"
              onChange={(event) => setForm((current) => ({ ...current, printerId: event.target.value }))}
              required
              value={form.printerId}
            >
              <option value="">Select a printer</option>
              {printers.map((printer) => (
                <option key={printer.id} value={printer.id}>
                  {printer.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Copies</span>
            <input
              className="field"
              max="99"
              min="1"
              onChange={(event) => setForm((current) => ({ ...current, copies: Number(event.target.value) }))}
              type="number"
              value={form.copies}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">Duplex</span>
            <select
              className="field"
              onChange={(event) => setForm((current) => ({ ...current, duplex: event.target.value }))}
              value={form.duplex}
            >
              <option value="one-sided">One-sided</option>
              <option value="two-sided-long-edge">Two-sided (long edge)</option>
              <option value="two-sided-short-edge">Two-sided (short edge)</option>
            </select>
          </label>

          <fieldset className="md:col-span-2">
            <legend className="mb-2 block text-sm font-medium text-slate-700">Color</legend>
            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
              {[
                { label: 'Color', value: 'color' },
                { label: 'Grayscale', value: 'monochrome' },
              ].map((option) => (
                <label
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-sm sm:px-4 sm:py-3 ${
                    form.colorMode === option.value
                      ? 'border-green-700 bg-green-50 text-green-800'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                  key={option.value}
                >
                  <span className="font-medium">{option.label}</span>
                  <input
                    checked={form.colorMode === option.value}
                    className="h-4 w-4 accent-green-700"
                    name="colorMode"
                    onChange={() => setForm((current) => ({ ...current, colorMode: option.value }))}
                    type="radio"
                    value={option.value}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <button className="button-secondary w-full sm:w-auto" onClick={() => navigate('/jobs')} type="button">
            View Jobs
          </button>
          <button className="button-primary w-full sm:w-auto" disabled={saving} type="submit">
            {saving ? 'Submitting…' : 'Submit Print Job'}
          </button>
        </div>
      </form>
    </div>
  );
}
