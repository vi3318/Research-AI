const { getResult } = require("../services/jobStore");
const { fetchBibTeX } = require("../services/crossrefService");
const { toBibTeX } = require("../utils/bibtex");
const { asyncHandler, notFound, badRequest } = require("../utils/errorHandler");

const exportJson = asyncHandler(async (req, res) => {
  const jobId = req.params.jobId;
  const result = await getResult(jobId);
  if (!result) throw notFound("Results not found");
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(result, null, 2));
});

const exportCsv = asyncHandler(async (req, res) => {
  const jobId = req.params.jobId;
  const result = await getResult(jobId);
  if (!result) throw notFound("Results not found");
  const rows = [["topic","title","authors","year","publication","url","doi","citationCount"]];
  for (const [topic, papers] of Object.entries(result.papersByTopic || {})) {
    for (const p of papers) {
      rows.push([topic, p.title||"", p.authors||"", p.year||"", p.publication||"", p.url||"", p.doi||"", p.citationCount||""]);
    }
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.send(csv);
});

const exportBibtex = asyncHandler(async (req, res) => {
  const jobId = req.params.jobId;
  const result = await getResult(jobId);
  if (!result) throw notFound("Results not found");
  const items = [];
  for (const papers of Object.values(result.papersByTopic || {})) {
    for (const p of papers) {
      let entry = null;
      if (p.doi) entry = await fetchBibTeX(p.doi);
      if (!entry) entry = toBibTeX(p);
      items.push(entry);
    }
  }
  res.setHeader("Content-Type", "application/x-bibtex");
  res.send(items.join("\n\n"));
});

module.exports = { exportJson, exportCsv, exportBibtex };

