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
dotenv.config({ path: require('path').join(__dirname, '..', '.env') });

// Import routes
const researchRoutes = require("./routes/research");
const literatureRoutes = require("./routes/literature");
const semanticRoutes = require("./routes/semantic");
const exportRoutes = require("./routes/export");
const alertRoutes = require("./routes/alerts");
const chatRoutes = require("./routes/chat");
const simpleChatRoutes = require("./routes/simple-chat");
const enhancedResearchRoutes = require("./routes/enhancedResearch");
// const adminRoutes = require("./routes/admin");
const presentationRoutes = require("./routes/presentation");
const autoPptRoutes = require("./routes/autoPpt");
const simpleAutoPptRoutes = require("./routes/simple-auto-ppt");
const humanizerRoutes = require("./routes/humanizer");
const simpleHumanizerRoutes = require("./routes/simpleHumanizer");
const citationRoutes = require("./routes/citations");
const rmriRoutes = require("./routes/rmri");

// New collaborative features routes
const workspacesRoutes = require("./routes/workspaces");
const notesRoutes = require("./routes/notes");
const analyticsRoutes = require("./routes/analytics");
const documentsRoutes = require("./routes/documents");
const collaborativeDocsRoutes = require("./routes/collaborative-documents");
const pinnedPapersRoutes = require("./routes/pinnedPapers");
const chartsRoutes = require("./routes/charts");

// New semantic search routes
const semanticSearchRoutes = require("./routes/semanticSearchRoutes");

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
// Increase payload size limit for PDF uploads (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan("dev"));

// Basic rate limiting - increased for RMRI status polling
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to 500 to accommodate status polling
});
app.use(limiter);

// Routes
app.use("/api/research", researchRoutes);
app.use("/api/literature", literatureRoutes);
app.use("/api/semantic", semanticRoutes);
app.use("/api/semantic-search", semanticSearchRoutes); // New semantic search with vector DB
app.use("/api", semanticSearchRoutes); // Also mount at /api for /api/papers routes
app.use("/api/export", exportRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/chat", simpleChatRoutes);
app.use("/api/enhanced-research", enhancedResearchRoutes);
// app.use("/api/admin", adminRoutes);
app.use("/api/presentation", presentationRoutes);
app.use("/api/auto-ppt", autoPptRoutes);
app.use("/api/simple-auto-ppt", simpleAutoPptRoutes);
app.use("/api/humanizer", humanizerRoutes);
app.use("/api/simple-humanizer", simpleHumanizerRoutes);
app.use("/api/citations", citationRoutes);
app.use("/api/rmri", rmriRoutes);

// New collaborative features routes
app.use("/api", workspacesRoutes);
app.use("/api", notesRoutes);
app.use("/api", analyticsRoutes);
app.use("/api", documentsRoutes);
app.use("/api/collab-docs", collaborativeDocsRoutes);
app.use("/api", pinnedPapersRoutes);
app.use("/api", chartsRoutes);

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
