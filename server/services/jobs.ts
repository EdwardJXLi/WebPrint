import { updateJob } from '../db/index.js';
import { getJobAttributes } from './ipp.js';

const terminalStatuses = new Set(['completed', 'canceled', 'aborted', 'error']);

const isTerminalStatus = (status) => terminalStatuses.has(status);

const canCancelJob = (job, user) => {
  if (!job || !user || isTerminalStatus(job.status)) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  return job.user_id === user.id;
};

const refreshSingleJob = async (job) => {
  if (!job?.external_job_id || !job?.printerIppUri || isTerminalStatus(job.status)) {
    return job;
  }

  try {
    const liveJob = await getJobAttributes({
      printerUri: job.printerIppUri,
      jobId: job.external_job_id,
    });

    return updateJob(job.id, {
      status: liveJob.status,
      status_detail: liveJob.statusDetail,
      external_job_uri: liveJob.externalJobUri,
      completed_at: isTerminalStatus(liveJob.status)
        ? liveJob.completedAt || new Date().toISOString()
        : null,
    });
  } catch {
    return job;
  }
};

const refreshJobs = async (jobs) => {
  const refreshed = await Promise.all(jobs.map((job) => refreshSingleJob(job)));
  return refreshed;
};

export { canCancelJob, isTerminalStatus, refreshJobs };
