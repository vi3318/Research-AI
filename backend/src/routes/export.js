const express = require("express");
const { exportJson, exportCsv, exportBibtex } = require("../controllers/exportController");

const router = express.Router();

router.get("/json/:jobId", exportJson);
router.get("/csv/:jobId", exportCsv);
router.get("/bibtex/:jobId", exportBibtex);

module.exports = router;

