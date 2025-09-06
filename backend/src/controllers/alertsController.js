const { scheduleAlert } = require("../services/alertsService");
const { asyncHandler, badRequest } = require("../utils/errorHandler");
const { scanKeys, getManyJson, redis } = require("../utils/cache");

const createAlert = asyncHandler(async (req, res) => {
  const { alertId, topic, cron, sources, maxResults } = req.body || {};
  if (!alertId || !topic || !cron) throw badRequest("alertId, topic and cron are required");
  await scheduleAlert(alertId, topic, cron, sources, maxResults);
  res.status(200).json({ success: true });
});

const listAlerts = asyncHandler(async (_req, res) => {
  const keys = await scanKeys("alert:*", 500);
  const vals = await getManyJson(keys);
  const items = keys.map((k, i) => ({ key: k, ...((vals[i] || {})) }));
  res.status(200).json({ items });
});

const listAlertResults = asyncHandler(async (req, res) => {
  const { alertId } = req.params;
  const keys = await scanKeys(`alert_result:${alertId}:*`, 50);
  // Sort by timestamp descending extracted from key suffix
  const sorted = keys
    .map((k) => ({ key: k, ts: Number(k.split(":").pop()) }))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 20)
    .map((x) => x.key);
  const vals = await getManyJson(sorted);
  res.status(200).json({ items: vals.filter(Boolean) });
});

const deleteAlert = asyncHandler(async (req, res) => {
  const { alertId } = req.params;
  const key = `alert:${alertId}`;
  await redis.del(key);
  res.status(200).json({ success: true });
});

module.exports = { createAlert, listAlerts, listAlertResults, deleteAlert };

