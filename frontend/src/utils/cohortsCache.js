/**
 * Cohorts cache — mirrors mentorsCache pattern.
 *
 * Why: /cohort and /cohort/:slug pages call /api/cohorts/featured,
 * /api/cohorts/by-slug, and /api/cohorts/plans. Without caching every page
 * navigation re-hits the network; without retries a single network hiccup
 * (common on flaky mobile networks) leaves users staring at "No active cohort
 * right now" — even though the backend is healthy.
 *
 * This utility:
 *   1. Caches successful responses in module state for 90s
 *   2. De-duplicates concurrent identical requests
 *   3. Retries once on network failure with a 600ms backoff
 *   4. Returns the LAST-KNOWN-GOOD value if the network finally gives up
 *      → no more "No cohort" flash on transient failures
 */

const TTL_MS = 90_000;
const RETRY_DELAY_MS = 600;
const REQUEST_TIMEOUT_MS = 8_000;

const _state = {
  byKey: {}, // key -> { ts, promise, value }
};

const _now = () => Date.now();

const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch a public cohort endpoint with caching + 1 retry + stale fallback.
 * Returns the parsed JSON body. On total failure, returns the last cached
 * value if any, otherwise re-throws.
 */
async function _fetchOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchCohortCached(url, opts = {}) {
  const key = opts.key || url;
  const entry = _state.byKey[key];
  const now = _now();

  // Fresh cache hit
  if (!opts.force && entry && entry.value !== undefined && now - entry.ts < TTL_MS) {
    return entry.value;
  }

  // De-dupe concurrent
  if (!opts.force && entry && entry.promise) {
    return entry.promise;
  }

  const promise = (async () => {
    try {
      const data = await _fetchOnce(url);
      _state.byKey[key] = { ts: _now(), promise: null, value: data };
      return data;
    } catch (err1) {
      // Retry once after a short delay — handles transient timeouts / 502s
      await _sleep(RETRY_DELAY_MS);
      try {
        const data = await _fetchOnce(url);
        _state.byKey[key] = { ts: _now(), promise: null, value: data };
        return data;
      } catch (err2) {
        // Final failure: clear the in-flight promise so a future caller can
        // try fresh. If we have a stale value, return it (better than showing
        // "no cohort available" on a transient blip).
        const prior = _state.byKey[key]?.value;
        _state.byKey[key] = { ts: 0, promise: null, value: prior };
        if (prior !== undefined) return prior;
        throw err2;
      }
    }
  })();

  _state.byKey[key] = { ts: now, promise, value: entry?.value };
  return promise;
}

export function invalidateCohortCache(key) {
  if (key) {
    delete _state.byKey[key];
  } else {
    _state.byKey = {};
  }
}
