import express from 'express';
import { z } from 'zod';

import {
  createPrinter,
  deletePrinter,
  getPrinterById,
  listPrinters,
  syncDiscoveredPrinters,
  updatePrinter,
} from '../db/index.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { discoverCupsPrinters, getPrinterStatus, testPrinterConnectivity } from '../services/ipp.js';
import { asyncHandler } from '../utils/async-handler.js';
import { resolvePrinterUri, sanitizeText } from '../utils/sanitize.js';

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
