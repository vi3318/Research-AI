const debug = require("debug")("researchai:retry");

/**
 * Exponential backoff retry wrapper
 * @template T
 * @param {() => Promise<T>} operation
 * @param {{
 *   retries?: number,
 *   minDelayMs?: number,
 *   factor?: number,
 *   maxDelayMs?: number,
 *   onRetry?: (error: Error, attempt: number, delayMs: number) => void
 * }} opts
 * @returns {Promise<T>}
 */
const withRetry = async (operation, opts = {}) => {
  const retries = typeof opts.retries === "number" ? opts.retries : 2;
  const factor = typeof opts.factor === "number" ? opts.factor : 2;
  const minDelayMs = typeof opts.minDelayMs === "number" ? opts.minDelayMs : 1000;
  const maxDelayMs = typeof opts.maxDelayMs === "number" ? opts.maxDelayMs : 15000;
  const onRetry = typeof opts.onRetry === "function" ? opts.onRetry : undefined;

  let attempt = 0;
  let lastError;
  while (attempt <= retries) {
    try {
      return await operation();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === retries) break;
      const delay = Math.min(minDelayMs * Math.pow(factor, attempt), maxDelayMs);
      if (onRetry) onRetry(lastError, attempt + 1, delay);
      debug("Retry attempt %d failed: %s. Retrying in %dms", attempt + 1, lastError.message, delay);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
  throw lastError;
};

module.exports = { withRetry };

