const rateLimit = require('express-rate-limit');

// Citation-specific rate limiting
const citationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 citation requests per windowMs
  message: {
    error: 'Too many citation requests',
    message: 'Too many citation generation requests from this IP, please try again after a minute.',
    retryAfter: 60
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user?.id || req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for certain conditions if needed
    return false;
  }
});

// General API rate limiting
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

// Strict rate limiting for expensive operations
const strictRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit to 5 requests per 5 minutes
  message: {
    error: 'Rate limit exceeded',
    message: 'This operation is rate limited. Please wait a few minutes before trying again.',
    retryAfter: 300
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

module.exports = {
  citationRateLimit,
  generalRateLimit,
  strictRateLimit
};
