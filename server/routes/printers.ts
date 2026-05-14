import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { z } from 'zod';

import { env } from '../config/env.js';
import {
  createJob,
  createPrinter,
  deletePrinter,
  getPrinterById,
  listPrinters,
  syncDiscoveredPrinters,
  updateJob,
  updatePrinter,
} from '../db/index.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { discoverCupsPrinters, getPrinterStatus, submitPrintJob, testPrinterConnectivity } from '../services/ipp.js';
import { canCancelJob } from '../services/jobs.js';
import { asyncHandler } from '../utils/async-handler.js';
import { resolvePrinterUri, sanitizeFileName, sanitizeText } from '../utils/sanitize.js';
import { createTestPagePdf } from '../utils/test-page-pdf.js';

const router = express.Router();

const printerSchema = z.object({
  name: z.string().min(2).max(80),
  ippUri: z.string().min(2).max(255),
  description: z.string().max(240).default(''),
  enabled: z.coerce.boolean().default(true),
});

const sanitizeDiscoveredPrinter = (printer) => ({
  name: sanitizeText(printer.name).slice(0, 80),
  ippUri: printer.ippUri,
  description: sanitizeText(printer.description).slice(0, 240),
});

router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const printers = listPrinters({ includeDisabled: req.user.role === 'admin' });
  res.json({ printers });
}));

router.post(
  '/test',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { ippUri } = z.object({ ippUri: z.string().min(2).max(255) }).parse(req.body);
    const normalizedUri = resolvePrinterUri(ippUri);
    const status = await testPrinterConnectivity(normalizedUri);
    res.json({ status });
  }),
);

router.post(
  '/sync',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const detectedPrinters = (await discoverCupsPrinters())
      .map(sanitizeDiscoveredPrinter)
      .filter((printer) => printer.name);
    const sync = syncDiscoveredPrinters(detectedPrinters);
    const printers = listPrinters({ includeDisabled: true });

    res.json({ detectedPrinters, sync, printers });
  }),
);

router.post(
  '/:id/test-page',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const printer = getPrinterById(Number(req.params.id));
    if (!printer) {
      throw new AppError(404, 'Printer not found.');
    }

    if (!printer.enabled) {
      throw new AppError(400, 'Enable this printer before printing a test page.');
    }

    const fileBuffer = createTestPagePdf({
      appName: env.appName,
      appVersion: env.appVersion,
      appBaseUrl: env.appBaseUrl,
      printer,
      user: req.user,
    });
    const originalFileName = sanitizeFileName(`${env.appName}_${printer.name}_Test_Page.pdf`);
    const storedFileName = `${Date.now()}-${crypto.randomUUID()}.pdf`;
    const filePath = path.join(env.uploadDir, storedFileName);

    await fs.writeFile(filePath, fileBuffer);

    const jobRecord = createJob({
      userId: req.user.id,
      printerId: printer.id,
      originalFileName,
      storedFileName,
      filePath,
      mimeType: 'application/pdf',
      copies: 1,
      duplex: 'one-sided',
      colorMode: 'color',
      status: 'submitting',
      statusDetail: `Submitting ${env.appName} test page to CUPS`,
    });

    try {
      const printResult = await submitPrintJob({
        printerUri: printer.ipp_uri,
        username: sanitizeText(req.user.email || req.user.name || 'webprint-user'),
        fileBuffer,
        fileName: originalFileName,
        mimeType: 'application/pdf',
        copies: 1,
        duplex: 'one-sided',
        colorMode: 'color',
      });

      const updatedJob = updateJob(jobRecord.id, {
        status: printResult.status,
        status_detail: printResult.statusDetail,
        external_job_id: printResult.externalJobId,
        external_job_uri: printResult.externalJobUri,
      });

      res.status(201).json({
        printer,
        job: { ...updatedJob, canCancel: canCancelJob(updatedJob, req.user) },
      });
    } catch (error) {
      const failedJob = updateJob(jobRecord.id, {
        status: 'error',
        status_detail: error.message,
        completed_at: new Date().toISOString(),
      });

      res.status(502).json({
        printer,
        job: { ...failedJob, canCancel: false },
        error: 'Failed to submit the test page to CUPS.',
      });
    }
  }),
);

router.get(
  '/:id/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const printer = getPrinterById(Number(req.params.id));
    if (!printer) {
      throw new AppError(404, 'Printer not found.');
    }

    const status = await getPrinterStatus(printer.ipp_uri);
    res.json({ printer, status });
  }),
);

router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = printerSchema.parse(req.body);
    const printerInput = {
      name: sanitizeText(parsed.name),
      ippUri: resolvePrinterUri(parsed.ippUri),
      description: sanitizeText(parsed.description),
      enabled: parsed.enabled,
    };

    await testPrinterConnectivity(printerInput.ippUri);
    const printer = createPrinter(printerInput);
    res.status(201).json({ printer });
  }),
);

router.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existingPrinter = getPrinterById(Number(req.params.id));
    if (!existingPrinter) {
      throw new AppError(404, 'Printer not found.');
    }

    const parsed = printerSchema.parse(req.body);
    const printerInput = {
      name: sanitizeText(parsed.name),
      ippUri: resolvePrinterUri(parsed.ippUri),
      description: sanitizeText(parsed.description),
      enabled: parsed.enabled,
    };

    await testPrinterConnectivity(printerInput.ippUri);
    const printer = updatePrinter(existingPrinter.id, printerInput);
    res.json({ printer });
  }),
);

router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const printer = getPrinterById(Number(req.params.id));
    if (!printer) {
      throw new AppError(404, 'Printer not found.');
    }

    deletePrinter(printer.id);
    res.status(204).send();
  }),
);

export default router;
