import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { z } from 'zod';

import {
  createJob,
  getJobById,
  getPrinterById,
  listJobs,
  updateJob,
} from '../db/index.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { cancelPrintJob, submitPrintJob } from '../services/ipp.js';
import {
  canCancelJob,
  isTerminalStatus,
  refreshJobs,
} from '../services/jobs.js';
import { asyncHandler } from '../utils/async-handler.js';
import { detectAllowedFileType, extensionForMimeType } from '../utils/mime.js';
import { sanitizeFileName, sanitizeText } from '../utils/sanitize.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxUploadBytes,
  },
});

const jobSchema = z.object({
  printerId: z.coerce.number().int().positive(),
  copies: z.coerce.number().int().min(1).max(99).default(1),
  duplex: z
    .enum(['one-sided', 'two-sided-long-edge', 'two-sided-short-edge'])
    .default('one-sided'),
  colorMode: z.enum(['color', 'monochrome']).default('color'),
});

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const statusGroup = z.enum(['all', 'active', 'completed']).catch('all').parse(req.query.status || 'all');
    const jobs = listJobs({
      role: req.user.role,
      userId: req.user.id,
      statusGroup,
      limit: 200,
    });

    const refreshedJobs = await refreshJobs(jobs);
    res.json({
      jobs: refreshedJobs.map((job) => ({
        ...job,
        canCancel: canCancelJob(job, req.user),
      })),
    });
  }),
);

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'A file is required.');
    }

    const parsed = jobSchema.parse(req.body);
    const printer = getPrinterById(parsed.printerId);
    if (!printer) {
      throw new AppError(404, 'Printer not found.');
    }

    if (!printer.enabled && req.user.role !== 'admin') {
      throw new AppError(403, 'Printer is currently disabled.');
    }

    const allowedType = detectAllowedFileType(req.file.buffer);
    if (!allowedType) {
      throw new AppError(400, 'Unsupported file type. Upload a PDF or common image format.');
    }

    const safeOriginalName = sanitizeFileName(req.file.originalname || 'print-job');
    const extension = extensionForMimeType(allowedType.mimeType);
    const storedFileName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const filePath = path.join(env.uploadDir, storedFileName);

    await fs.writeFile(filePath, req.file.buffer);
    req.savedUploadPath = filePath;

    const jobRecord = createJob({
      userId: req.user.id,
      printerId: printer.id,
      originalFileName: safeOriginalName,
      storedFileName,
      filePath,
      mimeType: allowedType.mimeType,
      copies: parsed.copies,
      duplex: parsed.duplex,
      colorMode: parsed.colorMode,
      status: 'submitting',
      statusDetail: 'Submitting job to CUPS',
    });

    try {
      const printResult = await submitPrintJob({
        printerUri: printer.ipp_uri,
        username: sanitizeText(req.user.email || req.user.name || 'cloudprint-user'),
        fileBuffer: req.file.buffer,
        fileName: safeOriginalName,
        mimeType: allowedType.mimeType,
        copies: parsed.copies,
        duplex: parsed.duplex,
        colorMode: parsed.colorMode,
      });

      const updatedJob = updateJob(jobRecord.id, {
        status: printResult.status,
        status_detail: printResult.statusDetail,
        external_job_id: printResult.externalJobId,
        external_job_uri: printResult.externalJobUri,
      });

      delete req.savedUploadPath;
      res.status(201).json({ job: { ...updatedJob, canCancel: canCancelJob(updatedJob, req.user) } });
    } catch (error) {
      const failedJob = updateJob(jobRecord.id, {
        status: 'error',
        status_detail: error.message,
        completed_at: new Date().toISOString(),
      });

      delete req.savedUploadPath;
      res.status(502).json({ job: failedJob, error: 'Failed to submit the job to CUPS.' });
    }
  }),
);

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const job = getJobById(Number(req.params.id));
    if (!job) {
      throw new AppError(404, 'Job not found.');
    }

    if (req.user.role !== 'admin' && job.user_id !== req.user.id) {
      throw new AppError(403, 'You do not have permission to cancel this job.');
    }

    if (!job.external_job_id) {
      throw new AppError(400, 'This job has not been submitted to the printer.');
    }

    if (isTerminalStatus(job.status)) {
      throw new AppError(400, 'This job is already finished.');
    }

    await cancelPrintJob({
      printerUri: job.printerIppUri,
      jobId: job.external_job_id,
      username: sanitizeText(req.user.email || req.user.name || 'cloudprint-user'),
    });

    const updatedJob = updateJob(job.id, {
      status: 'canceled',
      status_detail: 'Canceled by user request',
      completed_at: new Date().toISOString(),
    });

    res.json({ job: { ...updatedJob, canCancel: false } });
  }),
);

export default router;
