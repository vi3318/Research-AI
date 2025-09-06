const express = require('express');
const router = express.Router();
const databaseCleanupService = require('../services/databaseCleanupService');

/**
 * @swagger
 * /api/admin/cleanup:
 *   post:
 *     summary: Perform database cleanup
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Cleanup completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 summary:
 *                   type: object
 */
router.post('/cleanup', async (req, res) => {
  try {
    const summary = await databaseCleanupService.performCleanup();
    res.json({
      message: 'Database cleanup completed successfully',
      summary
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed', details: error.message });
  }
});

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get database statistics
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Database statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   type: object
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await databaseCleanupService.getDatabaseStats();
    res.json({ stats });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats', details: error.message });
  }
});

module.exports = router;