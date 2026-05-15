/**
 * Tiny module-level cache for the public mentor lists.
 *
 * Why: the home-page carousel + /mentors directory both hit
 * `/api/mentors/featured?slim=true`. Without caching, navigating between
 * the home page and the directory triggers a full network round-trip every
 * time. With a 60s in-memory cache it's instant on the second visit and the
 * UI no longer feels laggy. Cache is plain JS module state — wiped on full
 * page reload, which is exactly what we want.
 */

// Using native fetch instead of axios to avoid the global withCredentials
// interceptor — these are PUBLIC endpoints that don't need auth cookies.
// This also prevents CORS issues when the proxy returns Access-Control-Allow-Origin: *.

const TTL_MS = 60_000; // 60 seconds — short enough to stay fresh, long enough to be useful

const _state = {
  // key -> { ts: number, promise: Promise<list>, value: list | null }
  byKey: {},
};

const _now = () => Date.now();

/**
 * Returns mentors from cache if fresh, else fetches them.
 * Also de-duplicates concurrent requests with the same key (e.g. carousel
 * + directory both mounting at the same time).
 *
 * @param {string} url Absolute URL to fetch.
 * @param {object} [opts]
 * @param {string} [opts.key] Cache key (defaults to `url`).
 * @param {boolean} [opts.force] Bypass cache and re-fetch.
 * @returns {Promise<Array>}
 */
export async function fetchMentorsCached(url, opts = {}) {
  const key = opts.key || url;
  const entry = _state.byKey[key];
  const now = _now();

  if (!opts.force && entry && entry.value !== null && now - entry.ts < TTL_MS) {
    return entry.value;
  }

  // Coalesce in-flight requests
  if (!opts.force && entry && entry.promise) {
    return entry.promise;
  }

  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      const list = Array.isArray(data) ? data : [];
      _state.byKey[key] = { ts: _now(), promise: null, value: list };
      return list;
    })
    .catch((err) => {
      // Don't poison the cache on failure — clear the in-flight promise so
      // the next caller can try again.
      _state.byKey[key] = { ts: 0, promise: null, value: null };
      throw err;
    });

  _state.byKey[key] = { ts: now, promise, value: entry?.value ?? null };
  return promise;
}

export function invalidateMentorsCache(key) {
  if (key) {
    delete _state.byKey[key];
  } else {
    _state.byKey = {};
  }
}
