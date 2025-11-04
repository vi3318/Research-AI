# Environment Configuration Guide

Complete environment variable reference for the ResearchAI backend services.

## Table of Contents
- [Core Configuration](#core-configuration)
- [LLM Providers](#llm-providers)
- [Rate Limiting](#rate-limiting)
- [Background Jobs](#background-jobs)
- [Storage & Database](#storage--database)
- [Optional Features](#optional-features)

---

## Core Configuration

### Required Variables

```bash
# Supabase Configuration (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server Configuration
PORT=3000
NODE_ENV=development  # or 'production'

# Redis (REQUIRED for job queue)
REDIS_URL=redis://localhost:6379
# For Redis with password:
# REDIS_URL=redis://:password@localhost:6379
# For Redis Cloud:
# REDIS_URL=redis://username:password@redis-12345.cloud.redislabs.com:12345
```

---

## LLM Providers

At least one LLM provider is recommended for humanizer functionality. The system will automatically select the best available provider or fall back to offline sandbox mode.

### Cerebras (Recommended - Primary Provider)

**Best for:** Fast inference, low latency  
**Cost:** Free tier available  
**Signup:** https://cloud.cerebras.ai/

```bash
CEREBRAS_API_KEY=your_cerebras_api_key_here
```

### HuggingFace

**Best for:** Fallback, diverse models  
**Cost:** Free tier available  
**Signup:** https://huggingface.co/settings/tokens

```bash
# HuggingFace Inference API
HUGGINGFACE_API_KEY=hf_...
# or
HF_API_KEY=hf_...
```

### Google Gemini

**Best for:** Advanced reasoning, analysis  
**Cost:** Free tier available  
**Signup:** https://makersuite.google.com/app/apikey

```bash
GEMINI_API_KEY=AIzaSy...
```

### Provider Priority

The humanizer service uses this priority order:
1. **Cerebras** (if `CEREBRAS_API_KEY` set)
2. **Gemini** (if `GEMINI_API_KEY` set)
3. **HuggingFace** (if `HUGGINGFACE_API_KEY` or `HF_API_KEY` set)
4. **Sandbox Mode** (offline, rule-based, no API key needed)

---

## Rate Limiting

Control request rates per user per minute. All values are optional with sensible defaults.

```bash
# Humanizer Rate Limits
RATE_LIMIT_HUMANIZE_POINTS=20     # Max requests (default: 20)
RATE_LIMIT_HUMANIZE_DURATION=60   # Time window in seconds (default: 60)

# Chart Generation Rate Limits
RATE_LIMIT_CHART_POINTS=10        # Max requests (default: 10)
RATE_LIMIT_CHART_DURATION=60      # Time window in seconds (default: 60)

# Paper Metadata Rate Limits
RATE_LIMIT_PAPER_POINTS=50        # Max requests (default: 50)
RATE_LIMIT_PAPER_DURATION=60      # Time window in seconds (default: 60)

# General API Rate Limits
RATE_LIMIT_API_POINTS=100         # Max requests (default: 100)
RATE_LIMIT_API_DURATION=60        # Time window in seconds (default: 60)
```

### Rate Limit Examples

**Conservative (Production):**
```bash
RATE_LIMIT_HUMANIZE_POINTS=10
RATE_LIMIT_CHART_POINTS=5
```

**Generous (Development):**
```bash
RATE_LIMIT_HUMANIZE_POINTS=100
RATE_LIMIT_CHART_POINTS=50
```

**Disable (Testing):**
```bash
RATE_LIMIT_HUMANIZE_POINTS=999999
RATE_LIMIT_CHART_POINTS=999999
```

---

## Background Jobs

Configuration for Bull job queues.

```bash
# Redis URL (also used by job queue)
REDIS_URL=redis://localhost:6379

# Job Retention (optional)
JOB_RETENTION_COMPLETED=100       # Keep last N completed jobs (default: 100)
JOB_RETENTION_FAILED=500          # Keep last N failed jobs (default: 500)

# Job Timeouts (optional, in milliseconds)
JOB_TIMEOUT_CHART=60000           # Chart generation timeout (default: 60s)
JOB_TIMEOUT_PAPER=30000           # Paper metadata timeout (default: 30s)
JOB_TIMEOUT_HUMANIZE=10000        # Per-text humanize timeout (default: 10s)
```

---

## Storage & Database

### Supabase Storage

For chart images, PDF uploads, etc.

```bash
# Storage bucket name (default: 'chart-exports')
STORAGE_BUCKET_CHARTS=chart-exports
STORAGE_BUCKET_PAPERS=paper-pdfs
```

### Database

Database connection is handled through `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

**Required Tables:**
- workspaces
- workspace_users
- workspace_papers
- documents
- document_content
- document_collaborators
- users
- humanizer_logs
- chart_exports
- papers (for metadata caching)

See `.sql` files in project root for schema.

---

## Optional Features

### Debugging

Enable debug logs for specific modules:

```bash
# All modules
DEBUG=researchai:*

# Specific modules
DEBUG=researchai:humanizer,researchai:charts,researchai:jobs

# Node.js debug levels
LOG_LEVEL=info  # error, warn, info, debug, trace
```

### External APIs

#### OpenAlex (Paper Metadata)

Free, no API key required. Automatic fallback.

**Optional:** Add email for higher rate limits
```bash
OPENALEX_EMAIL=your-email@example.com
```

#### arXiv (Paper Metadata)

Free, no API key required. Automatic fallback.

### Chart Configuration

```bash
# Chart dimensions (pixels)
CHART_WIDTH=800
CHART_HEIGHT=600

# Chart background color
CHART_BACKGROUND=white
```

### Security

```bash
# CORS allowed origins (comma-separated)
CORS_ORIGINS=http://localhost:5173,https://app.example.com

# JWT secret (if custom auth)
JWT_SECRET=your_custom_jwt_secret

# API key for admin endpoints (optional)
ADMIN_API_KEY=your_admin_key_here
```

---

## Example Configurations

### Minimal (Development)

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# Server
PORT=3000
NODE_ENV=development

# Redis
REDIS_URL=redis://localhost:6379

# Debug
DEBUG=researchai:*
```

### Production (Full Features)

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# Server
PORT=3000
NODE_ENV=production

# Redis
REDIS_URL=redis://:password@prod-redis.example.com:6379

# LLM Providers (all configured for redundancy)
CEREBRAS_API_KEY=csk-...
HF_API_KEY=hf_...
GEMINI_API_KEY=AIzaSy...

# Rate Limits (conservative for production)
RATE_LIMIT_HUMANIZE_POINTS=10
RATE_LIMIT_HUMANIZE_DURATION=60
RATE_LIMIT_CHART_POINTS=5
RATE_LIMIT_CHART_DURATION=60

# External APIs
OPENALEX_EMAIL=research@example.com

# Security
CORS_ORIGINS=https://app.example.com,https://www.example.com
ADMIN_API_KEY=secure_random_key_here
```

### Testing Environment

```bash
# Supabase (test project)
SUPABASE_URL=https://test-xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# Server
PORT=3001
NODE_ENV=test

# Redis (test instance)
REDIS_URL=redis://localhost:6380

# No LLM keys (will use sandbox mode)
# CEREBRAS_API_KEY=
# HF_API_KEY=

# Disable rate limits for testing
RATE_LIMIT_HUMANIZE_POINTS=999999
RATE_LIMIT_CHART_POINTS=999999

# Debug
DEBUG=researchai:*
LOG_LEVEL=debug
```

---

## Validation

Check which variables are configured:

```bash
npm run check-env
```

Or manually:

```bash
node -e "console.log(process.env.SUPABASE_URL ? '✅ SUPABASE_URL' : '❌ SUPABASE_URL missing')"
```

---

## Troubleshooting

### "Redis connection failed"
- Check `REDIS_URL` is correct
- Ensure Redis server is running: `redis-cli ping`
- Check firewall/network settings

### "Supabase authentication failed"
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check key has not expired
- Confirm project URL matches

### "All LLM providers failed"
- Check API keys are valid
- Verify network can reach provider APIs
- System will fall back to sandbox mode if all fail

### "Rate limit exceeded immediately"
- Check Redis is working (stores rate limit data)
- Verify rate limit settings are reasonable
- Clear rate limits: `redis-cli FLUSHDB` (development only!)

---

## Security Best Practices

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Use different keys for dev/prod** - Separate Supabase projects
3. **Rotate API keys regularly** - Especially in production
4. **Limit CORS origins** - Only allow trusted domains
5. **Use environment-specific Redis** - Separate dev/prod data
6. **Monitor rate limits** - Adjust based on usage patterns

---

## Next Steps

1. Copy `env.example` to `.env`
2. Fill in required variables
3. (Optional) Add LLM provider keys
4. (Optional) Customize rate limits
5. Start server: `npm run dev`
6. Check health: `curl http://localhost:3000/api/health`

For more information, see:
- [API Documentation](./API.md)
- [README](./README.md)
- [Setup Guide](./SETUP.md)
