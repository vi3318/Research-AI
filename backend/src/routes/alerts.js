const express = require("express");
const { createAlert, listAlerts, listAlertResults, deleteAlert } = require("../controllers/alertsController");

const router = express.Router();

router.post("/", createAlert);
router.get("/", listAlerts);
router.get("/:alertId/results", listAlertResults);
router.delete("/:alertId", deleteAlert);

module.exports = router;

