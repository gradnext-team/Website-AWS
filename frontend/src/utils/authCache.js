/**
 * Shared auth-state cache.
 *
 * Multiple components (Header, Coaching, Cohort, Pricing, PlansModal…)
 * all call `/api/auth/me` independently on mount.  Without deduplication
 * the coaching page fires 3-4 identical requests.  This module coalesces
 * them into a single in-flight fetch so only ONE round-trip happens.
 *
 * Usage:
 *   import { fetchCurrentUser, invalidateAuthCache } from '../utils/authCache';
 *   const user = await fetchCurrentUser();     // returns user or null
 *   invalidateAuthCache();                     // after logout
 */

import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const TTL_MS = 10_000; // 10 seconds — covers all mount-time calls on one page

let _state = {
  ts: 0,
  value: undefined,   // undefined = never fetched, null = not logged in, object = user
  promise: null,       // in-flight promise (for dedup)
};

/**
 * Returns the current user from cache (if fresh) or fetches `/api/auth/me`.
 * Concurrent calls while a fetch is in-flight share the same promise.
 */
export async function fetchCurrentUser(opts = {}) {
  const now = Date.now();

  // Return cached value if fresh
  if (!opts.force && _state.value !== undefined && (now - _state.ts) < TTL_MS) {
    return _state.value;
  }

  // Coalesce in-flight requests
  if (!opts.force && _state.promise) {
    return _state.promise;
  }

  const promise = axios
    .get(`${BACKEND_URL}/api/auth/me`, { withCredentials: true })
    .then((res) => {
      const user = res.data || null;
      _state = { ts: Date.now(), value: user, promise: null };
      return user;
    })
    .catch(() => {
      // Not logged in or network error — don't poison cache on transient errors
      _state = { ts: Date.now(), value: null, promise: null };
      return null;
    });

  _state.promise = promise;
  return promise;
}

/**
 * Clear cached auth state (call after logout or login).
 */
export function invalidateAuthCache() {
  _state = { ts: 0, value: undefined, promise: null };
}
