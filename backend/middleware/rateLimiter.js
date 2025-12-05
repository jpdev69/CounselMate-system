// Simple in-memory rate limiter middleware
// Tracks failed attempts per-key (by ip and email optionally) and blocks further attempts for a lockout period

const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || '3', 10);
// Default escalation steps (minutes) used for successive lockouts: 3,5,7,9,12,15
const DEFAULT_ESCALATIONS = {
  login: [3,5,7,9,12,15],
  'forgot-verify': [3,5,7,9,12,15],
  'forgot-reset': [3,5,7,9,12,15],
  'me-security-question': [3,5,7,9,12,15]
};

// Read a global fallback escalation list if present
const GLOBAL_ESCALATION_MINUTES_LIST = (process.env.ESCALATION_MINUTES_LIST || '').split(',').map(n => parseInt(n, 10)).filter(Boolean);

function parseEscList(s) {
  if (!s) return null;
  return s.split(',').map(n => parseInt(n, 10)).filter(Boolean);
}

// Return the escalation list for a given label (endpoint). Prefer per-endpoint override then global then default.
function getEscalationListForLabel(label) {
  if (!label) return GLOBAL_ESCALATION_MINUTES_LIST.length ? GLOBAL_ESCALATION_MINUTES_LIST : DEFAULT_ESCALATIONS.login;
  // Normalize label for env var: replace non-alphanum with underscore and uppercase
  const envName = 'ESCALATION_' + label.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  const envValue = process.env[envName];
  if (envValue) {
    const parsed = parseEscList(envValue);
    if (parsed && parsed.length) return parsed;
  }
  if (GLOBAL_ESCALATION_MINUTES_LIST.length) return GLOBAL_ESCALATION_MINUTES_LIST;
  return DEFAULT_ESCALATIONS[label] || DEFAULT_ESCALATIONS.login;
}
const WINDOW_MINUTES = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15', 10);

// Store shape: { key: { attempts: number, firstAt: Date, blockedUntil: Date|null, escalationIndex: number } }
const store = new Map();

function makeKey(req, label) {
  // Use IP + label, and email from body if provided
  const ip = req.ip || req.connection?.remoteAddress || 'unknown-ip';
  const email = (req.body && (req.body.email || req.body.username || req.body.email_address)) || '';
  return `${label}:${ip}:${(email || '').toString().toLowerCase()}`;
}

function getEntry(key) {
  const e = store.get(key) || { attempts: 0, firstAt: null, blockedUntil: null, escalationIndex: 0 };
  return e;
}

function saveEntry(key, entry) {
  store.set(key, entry);
}

function clearEntry(key) {
  store.delete(key);
}

function precheckRateLimit(label) {
  return (req, res, next) => {
    try {
      const key = makeKey(req, label);
      const entry = getEntry(key);
      const now = Date.now();

      if (entry.blockedUntil && entry.blockedUntil > now) {
        console.warn(`Rate limiter: blocked request for ${key} until ${new Date(entry.blockedUntil).toISOString()} (escalationIndex=${entry.escalationIndex || 0})`);
        const remainingMs = entry.blockedUntil - now;
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        const remainingMinutes = Math.ceil(remainingSeconds / 60);
        // Set Retry-After header (in seconds) for callers
        res.set('Retry-After', String(remainingSeconds));
        const friendlyText = remainingMinutes > 0
          ? `Too many attempts. Try again after ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`
          : `Too many attempts. Try again after ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}.`;
        return res.status(429).json({ success: false, error: friendlyText, retryAfterMs: remainingMs });
      }

          // Reset window if firstAt is older than window
          if (entry.firstAt && now - entry.firstAt > WINDOW_MINUTES * 60 * 1000) {
            entry.attempts = 0;
            entry.firstAt = null;
            entry.blockedUntil = null;
            // Also reset escalation after an idle window
            entry.escalationIndex = 0;
        saveEntry(key, entry);
      }

      return next();
    } catch (err) {
      console.error('Rate limiter precheck error:', err);
      return next();
    }
  };
}

function recordFailedAttempt(req, label) {
  const key = makeKey(req, label);
  const now = Date.now();
  const entry = getEntry(key);

  if (!entry.firstAt) entry.firstAt = now;
  entry.attempts = (entry.attempts || 0) + 1;

  // If reached limit, set block using escalation step
  if (entry.attempts >= MAX_ATTEMPTS) {
    const list = getEscalationListForLabel(label);
    const idx = Math.min(entry.escalationIndex || 0, list.length - 1);
    const lockoutMinutes = list[idx] || list[list.length - 1] || 10; // fallback
    entry.blockedUntil = now + lockoutMinutes * 60 * 1000;
    // After triggering a lockout, reset attempts so we require new failures to re-trigger
    entry.attempts = 0;
    entry.firstAt = null;
    // Increase escalation index for next lockout (capped)
    entry.escalationIndex = Math.min((entry.escalationIndex || 0) + 1, list.length - 1);
  }

  saveEntry(key, entry);
  return entry;
}

function clearAttempts(req, label) {
  const key = makeKey(req, label);
  clearEntry(key);
}

module.exports = { precheckRateLimit, recordFailedAttempt, clearAttempts };
