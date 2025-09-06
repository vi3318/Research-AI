const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const dotenv = require("dotenv");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const client = require("prom-client");

// Load environment variables
dotenv.config();

// Import routes
const researchRoutes = require("./routes/research");
const literatureRoutes = require("./routes/literature");
const semanticRoutes = require("./routes/semantic");
const exportRoutes = require("./routes/export");
const alertRoutes = require("./routes/alerts");
const chatRoutes = require("./routes/chat");
const enhancedResearchRoutes = require("./routes/enhancedResearch");
// const adminRoutes = require("./routes/admin");
const presentationRoutes = require("./routes/presentation");
const autoPptRoutes = require("./routes/autoPpt");
// // const databaseCleanupService = require("./services/databaseCleanupService");

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(morgan("dev"));

// Basic rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// Routes
app.use("/api/research", researchRoutes);
app.use("/api/literature", literatureRoutes);
app.use("/api/semantic", semanticRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/enhanced-research", enhancedResearchRoutes);
// app.use("/api/admin", adminRoutes);
app.use("/api/presentation", presentationRoutes);
app.use("/api/auto-ppt", autoPptRoutes);

// Swagger setup
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "ResearchAI API",
      version: "1.0.0",
      description: "Multi-source literature search, PDF parsing, LLM analysis, and semantic search",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
      },
    ],
  },
  apis: [
    __filename,
    __dirname + "/routes/*.js",
  ],
});
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Metrics
client.collectDefaultMetrics();
app.get("/api/metrics", async (req, res) => {
  try {
    res.set("Content-Type", client.register.contentType);
    res.send(await client.register.metrics());
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

// Test endpoint for presentation
app.get("/api/test", (req, res) => {
  res.status(200).json({ message: "Test endpoint working" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    error: true,
    message: err.message || "An unknown error occurred",
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.ENABLE_RESEARCH_WORKER === "false") {
    console.log("Research worker disabled in this process (ENABLE_RESEARCH_WORKER=false). Run a separate worker to process jobs.");
  }
  
  // Initialize database cleanup service
  // databaseCleanupService.scheduleCleanup();
  // console.log("Database cleanup service initialized");
});
