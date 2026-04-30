import express from 'express';

import { getDashboardStats, listPrinters, listRecentJobs } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { canCancelJob, refreshJobs } from '../services/jobs.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const stats = getDashboardStats({ userId: req.user.id });
    const printers = listPrinters({ includeDisabled: false });
    const recentJobs = await refreshJobs(
      listRecentJobs({ userId: req.user.id, limit: 8 }),
    );

    res.json({
      stats,
      printers,
      recentJobs: recentJobs.map((job) => ({
        ...job,
        canCancel: canCancelJob(job, req.user),
      })),
    });
  }),
);

export default router;
