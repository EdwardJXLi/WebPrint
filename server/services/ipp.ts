import ipp from 'ipp';

import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';

const CUPS_GET_PRINTERS_OPERATION = 0x4002;
const ippRuntime = ipp as any;

if (!ippRuntime.operations['CUPS-Get-Printers']) {
  ippRuntime.operations['CUPS-Get-Printers'] = CUPS_GET_PRINTERS_OPERATION;
  ippRuntime.operations.lookup[CUPS_GET_PRINTERS_OPERATION] = 'CUPS-Get-Printers';
}

const asArray = (value) => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const httpTransportUri = (printerUri) => {
  const url = new URL(printerUri);
  if (url.protocol === 'ipp:') {
    url.protocol = 'http:';
  }

  if (url.protocol === 'ipps:') {
    url.protocol = 'https:';
  }

  return url.toString();
};

const canonicalPrinterUri = (printerUri) => {
  const url = new URL(printerUri);
  if (url.protocol === 'http:') {
    url.protocol = 'ipp:';
  }

  if (url.protocol === 'https:') {
    url.protocol = 'ipps:';
  }

  return url.toString();
};

const cupsSchedulerUri = () => {
  if (!env.cupsIppUrl) {
    throw new AppError(400, 'CUPS_IPP_URL is required to detect printers from CUPS.');
  }

  const url = new URL(env.cupsIppUrl);
  url.pathname = '/';
  url.search = '';
  url.hash = '';

  return url.toString();
};

const buildPrinterUriFromQueueName = (queueName) => {
  const base = new URL(cupsSchedulerUri());
  base.pathname = `/printers/${encodeURIComponent(queueName)}`;
  return canonicalPrinterUri(base.toString());
};

const queueNameFromUri = (printerUri) => {
  if (!printerUri) {
    return null;
  }

  try {
    const url = new URL(printerUri);
    const queueName = url.pathname.split('/').filter(Boolean).pop();
    return queueName ? decodeURIComponent(queueName) : null;
  } catch {
    return null;
  }
};

const execute = (printerUri, operation, payload): Promise<any> =>
  new Promise((resolve, reject) => {
    const printer = ippRuntime.Printer(httpTransportUri(printerUri));
    printer.execute(operation, payload, (error, response) => {
      if (error) {
        reject(new AppError(502, `IPP request failed: ${error.message}`));
        return;
      }

      resolve(response);
    });
  });

const mapPrinterState = (state) => {
  if (['idle', 'processing', 'stopped'].includes(state)) {
    return state;
  }

  switch (Number(state)) {
    case 3:
      return 'idle';
    case 4:
      return 'processing';
    case 5:
      return 'stopped';
    default:
      return 'unknown';
  }
};

const mapJobState = (state) => {
  const knownStates = new Set([
    'pending',
    'pending-held',
    'processing',
    'processing-stopped',
    'canceled',
    'aborted',
    'completed',
  ]);

  if (knownStates.has(state)) {
    return state;
  }

  switch (Number(state)) {
    case 3:
      return 'pending';
    case 4:
      return 'pending-held';
    case 5:
      return 'processing';
    case 6:
      return 'processing-stopped';
    case 7:
      return 'canceled';
    case 8:
      return 'aborted';
    case 9:
      return 'completed';
    default:
      return 'queued';
  }
};

const timestampToIso = (timestamp) => {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return new Date(seconds * 1000).toISOString();
};

const normalizeJobAttributes = (rawJob) => ({
  externalJobId: rawJob['job-id'] || null,
  externalJobUri: rawJob['job-uri'] || null,
  status: mapJobState(rawJob['job-state']),
  statusDetail: rawJob['job-state-message'] || rawJob['job-detailed-status-message'] || null,
  name: rawJob['job-name'] || 'Untitled job',
  owner: rawJob['job-originating-user-name'] || null,
  createdAt: rawJob['time-at-creation'] || null,
  completedAt: timestampToIso(rawJob['time-at-completed']),
});

const normalizeDiscoveredPrinter = (attributes) => {
  const supportedUris = asArray(attributes['printer-uri-supported']);
  const firstSupportedUri = supportedUris.find(Boolean);
  const printerName = attributes['printer-name'] || queueNameFromUri(firstSupportedUri);

  if (!printerName) {
    return null;
  }

  return {
    name: printerName,
    ippUri: buildPrinterUriFromQueueName(printerName),
    description:
      attributes['printer-info'] ||
      attributes['printer-location'] ||
      attributes['printer-make-and-model'] ||
      '',
    printerState: mapPrinterState(attributes['printer-state']),
  };
};

const discoverCupsPrinters = async () => {
  const schedulerUri = cupsSchedulerUri();
  const response = await execute(schedulerUri, 'CUPS-Get-Printers', {
    'operation-attributes-tag': {
      'printer-uri': canonicalPrinterUri(schedulerUri),
      'requesting-user-name': 'cloudprint-portal',
      'requested-attributes': [
        'printer-name',
        'printer-info',
        'printer-location',
        'printer-make-and-model',
        'printer-uri-supported',
        'printer-state',
      ],
    },
  });

  if (!String(response.statusCode || '').startsWith('successful-')) {
    throw new AppError(502, `CUPS printer discovery failed: ${response.statusCode || 'unknown status'}`);
  }

  return asArray(response['printer-attributes-tag'])
    .map(normalizeDiscoveredPrinter)
    .filter(Boolean);
};

const testPrinterConnectivity = async (printerUri) => {
  const response = await execute(printerUri, 'Get-Printer-Attributes', {
    'operation-attributes-tag': {
      'printer-uri': canonicalPrinterUri(printerUri),
      'requesting-user-name': 'cloudprint-portal',
      'requested-attributes': [
        'printer-name',
        'printer-info',
        'printer-state',
        'printer-state-message',
        'queued-job-count',
      ],
    },
  });

  const attributes = response['printer-attributes-tag'] || {};
  return {
    printerName: attributes['printer-name'] || null,
    description: attributes['printer-info'] || null,
    printerState: mapPrinterState(attributes['printer-state']),
    stateMessage: attributes['printer-state-message'] || null,
    queuedJobCount: attributes['queued-job-count'] || 0,
  };
};

const getPrinterStatus = async (printerUri) => {
  const printerAttributesResponse = await execute(printerUri, 'Get-Printer-Attributes', {
    'operation-attributes-tag': {
      'printer-uri': canonicalPrinterUri(printerUri),
      'requesting-user-name': 'cloudprint-portal',
      'requested-attributes': [
        'printer-name',
        'printer-info',
        'printer-state',
        'printer-state-message',
        'printer-is-accepting-jobs',
        'queued-job-count',
      ],
    },
  });

  const jobsResponse = await execute(printerUri, 'Get-Jobs', {
    'operation-attributes-tag': {
      'printer-uri': canonicalPrinterUri(printerUri),
      'requesting-user-name': 'cloudprint-portal',
      'which-jobs': 'not-completed',
      'requested-attributes': [
        'job-id',
        'job-uri',
        'job-name',
        'job-state',
        'job-state-message',
        'job-originating-user-name',
      ],
    },
  });

  const attributes = printerAttributesResponse['printer-attributes-tag'] || {};
  const liveJobs = asArray(jobsResponse['job-attributes-tag']).map(normalizeJobAttributes);

  return {
    printerState: mapPrinterState(attributes['printer-state']),
    stateMessage: attributes['printer-state-message'] || null,
    acceptingJobs: Boolean(attributes['printer-is-accepting-jobs']),
    queuedJobCount: attributes['queued-job-count'] || liveJobs.length,
    jobs: liveJobs,
  };
};

const submitPrintJob = async ({ printerUri, username, fileBuffer, fileName, mimeType, copies, duplex, colorMode }) => {
  const response = await execute(printerUri, 'Print-Job', {
    'operation-attributes-tag': {
      'printer-uri': canonicalPrinterUri(printerUri),
      'requesting-user-name': username,
      'job-name': fileName,
      'document-format': mimeType,
    },
    'job-attributes-tag': {
      copies,
      sides: duplex,
      'print-color-mode': colorMode,
    },
    data: fileBuffer,
  });

  const attributes = response['job-attributes-tag'] || response['operation-attributes-tag'] || {};
  return {
    externalJobId: attributes['job-id'] || null,
    externalJobUri: attributes['job-uri'] || null,
    status: mapJobState(attributes['job-state']) || 'queued',
    statusDetail: attributes['job-state-message'] || 'Job accepted by CUPS',
  };
};

const getJobAttributes = async ({ printerUri, jobId }) => {
  const response = await execute(printerUri, 'Get-Job-Attributes', {
    'operation-attributes-tag': {
      'printer-uri': canonicalPrinterUri(printerUri),
      'requesting-user-name': 'cloudprint-portal',
      'job-id': Number(jobId),
      'requested-attributes': [
        'job-id',
        'job-uri',
        'job-state',
        'job-state-message',
        'job-name',
        'time-at-completed',
      ],
    },
  });

  return normalizeJobAttributes(response['job-attributes-tag'] || {});
};

const cancelPrintJob = async ({ printerUri, jobId, username }) => {
  await execute(printerUri, 'Cancel-Job', {
    'operation-attributes-tag': {
      'printer-uri': canonicalPrinterUri(printerUri),
      'requesting-user-name': username,
      'job-id': Number(jobId),
    },
  });
};

export {
  cancelPrintJob,
  discoverCupsPrinters,
  getJobAttributes,
  getPrinterStatus,
  mapJobState,
  submitPrintJob,
  testPrinterConnectivity,
};
