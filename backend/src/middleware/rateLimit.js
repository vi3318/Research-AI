/**
 * Rate Limiting Middleware
 * Per-user per-minute rate limits for resource-intensive endpoints
 * 
 * Uses Redis for distributed rate limiting
 * Returns 429 with Retry-After header when limit exceeded
 */

const redis = require('redis');
const debug = require('debug')('researchai:ratelimit');

// Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  debug('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  debug('Redis client connected for rate limiting');
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    debug('Failed to connect to Redis:', error.message);
  }
})();

/**
 * Rate limit configuration
 */
const RATE_LIMITS = {
  // Humanizer limits
  humanize: {
    points: parseInt(process.env.RATE_LIMIT_HUMANIZE_POINTS) || 20, // requests
    duration: parseInt(process.env.RATE_LIMIT_HUMANIZE_DURATION) || 60, // seconds
    blockDuration: 60 // seconds to block after limit exceeded
  },
  
  // Chart generation limits
  chart: {
    points: parseInt(process.env.RATE_LIMIT_CHART_POINTS) || 10,
    duration: parseInt(process.env.RATE_LIMIT_CHART_DURATION) || 60,
    blockDuration: 120
  },
  
  // Paper metadata fetch limits
  paper: {
    points: parseInt(process.env.RATE_LIMIT_PAPER_POINTS) || 50,
    duration: parseInt(process.env.RATE_LIMIT_PAPER_DURATION) || 60,
    blockDuration: 30
  },
  
  // API general limits
  api: {
    points: parseInt(process.env.RATE_LIMIT_API_POINTS) || 100,
    duration: parseInt(process.env.RATE_LIMIT_API_DURATION) || 60,
    blockDuration: 60
  }
};

/**
 * Rate limiter using sliding window algorithm
 */
class RateLimiter {
  constructor(config) {
    this.points = config.points;
    this.duration = config.duration;
    this.blockDuration = config.blockDuration;
  }

  /**
   * Check and consume rate limit
   * @param {string} key - Unique identifier (e.g., user_id)
   * @returns {Promise<Object>} { allowed, remaining, resetTime }
   */
  async consume(key) {
    const now = Date.now();
    const windowStart = now - (this.duration * 1000);
    
    // Redis key
    const redisKey = `ratelimit:${key}`;
    
    try {
      // Get current count in window
      const timestamps = await redisClient.zRangeByScore(
        redisKey,
        windowStart,
        now
      );
      
      const currentCount = timestamps.length;
      
      // Check if blocked
      const blockKey = `ratelimit:block:${key}`;
      const blocked = await redisClient.get(blockKey);
      
      if (blocked) {
        const ttl = await redisClient.ttl(blockKey);
        return {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + (ttl * 1000),
          retryAfter: ttl
        };
      }
      
      // Check if limit exceeded
      if (currentCount >= this.points) {
        // Block the key
        await redisClient.setEx(blockKey, this.blockDuration, '1');
        
        return {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + (this.blockDuration * 1000),
          retryAfter: this.blockDuration
        };
      }
      
      // Add current request timestamp
      await redisClient.zAdd(redisKey, {
        score: now,
        value: now.toString()
      });
      
      // Set expiry on the key
      await redisClient.expire(redisKey, this.duration);
      
      // Remove old entries
      await redisClient.zRemRangeByScore(redisKey, 0, windowStart);
      
      return {
        allowed: true,
        remaining: this.points - currentCount - 1,
        resetTime: windowStart + (this.duration * 1000)
      };
      
    } catch (error) {
      debug('Rate limit check failed:', error.message);
      // On Redis error, allow the request (fail open)
      return {
        allowed: true,
        remaining: this.points,
        resetTime: now + (this.duration * 1000),
        error: true
      };
    }
  }

  /**
   * Get current usage for a key
   */
  async getUsage(key) {
    const now = Date.now();
    const windowStart = now - (this.duration * 1000);
    const redisKey = `ratelimit:${key}`;
    
    try {
      const timestamps = await redisClient.zRangeByScore(
        redisKey,
        windowStart,
        now
      );
      
      return {
        used: timestamps.length,
        limit: this.points,
        remaining: Math.max(0, this.points - timestamps.length),
        resetTime: windowStart + (this.duration * 1000)
      };
    } catch (error) {
      debug('Get usage failed:', error.message);
      return {
        used: 0,
        limit: this.points,
        remaining: this.points,
        error: true
      };
    }
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key) {
    const redisKey = `ratelimit:${key}`;
    const blockKey = `ratelimit:block:${key}`;
    
    try {
      await redisClient.del(redisKey);
      await redisClient.del(blockKey);
      return { success: true };
    } catch (error) {
      debug('Reset failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Create rate limiters
const limiters = {
  humanize: new RateLimiter(RATE_LIMITS.humanize),
  chart: new RateLimiter(RATE_LIMITS.chart),
  paper: new RateLimiter(RATE_LIMITS.paper),
  api: new RateLimiter(RATE_LIMITS.api)
};

/**
 * Express middleware factory
 */
function createRateLimitMiddleware(type = 'api') {
  return async (req, res, next) => {
    // Skip if no user (shouldn't happen with requireAuth)
    if (!req.user || !req.user.id) {
      return next();
    }

    const limiter = limiters[type];
    if (!limiter) {
      debug(`Unknown rate limit type: ${type}`);
      return next();
    }

    const key = `${type}:${req.user.id}`;
    
    try {
      const result = await limiter.consume(key);
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });
      
      if (!result.allowed) {
        res.set('Retry-After', result.retryAfter);
        
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
          limit: limiter.points,
          duration: limiter.duration
        });
      }
      
      next();
    } catch (error) {
      debug(`Rate limit middleware error: ${error.message}`);
      // On error, allow the request
      next();
    }
  };
}

/**
 * Get rate limit status for user
 */
async function getRateLimitStatus(userId) {
  const status = {};
  
  for (const [type, limiter] of Object.entries(limiters)) {
    const key = `${type}:${userId}`;
    status[type] = await limiter.getUsage(key);
  }
  
  return status;
}

/**
 * Reset all rate limits for user
 */
async function resetUserRateLimits(userId) {
  const results = {};
  
  for (const [type, limiter] of Object.entries(limiters)) {
    const key = `${type}:${userId}`;
    results[type] = await limiter.reset(key);
  }
  
  return results;
}

/**
 * Health check
 */
async function healthCheck() {
  try {
    await redisClient.ping();
    return {
      status: 'healthy',
      redis: 'connected',
      limits: RATE_LIMITS
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      redis: 'disconnected',
      error: error.message
    };
  }
}

// Export middleware and utilities
module.exports = {
  // Middlewares
  rateLimitHumanize: createRateLimitMiddleware('humanize'),
  rateLimitChart: createRateLimitMiddleware('chart'),
  rateLimitPaper: createRateLimitMiddleware('paper'),
  rateLimitAPI: createRateLimitMiddleware('api'),
  
  // Utilities
  getRateLimitStatus,
  resetUserRateLimits,
  healthCheck,
  
  // Low-level
  limiters,
  RateLimiter,
  RATE_LIMITS
};
