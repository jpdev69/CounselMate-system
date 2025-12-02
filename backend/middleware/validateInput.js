// middleware/validateInput.js
const DEFAULT_MAX_LENGTH = 32;

function findTooLong(value, path = '', getMaxForPath) {
  const results = [];
  if (typeof value === 'string') {
    const max = (typeof getMaxForPath === 'function') ? getMaxForPath(path) : DEFAULT_MAX_LENGTH;
    if (value.length > max) results.push({ path, length: value.length, max });
    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      results.push(...findTooLong(v, `${path}[${i}]`, getMaxForPath));
    });
    return results;
  }

  if (value && typeof value === 'object') {
    Object.keys(value).forEach((k) => {
      const newPath = path ? `${path}.${k}` : k;
      results.push(...findTooLong(value[k], newPath, getMaxForPath));
    });
    return results;
  }

  return results;
}

module.exports = (req, res, next) => {
  try {
    const offenders = [];

    // Determine per-field max overrides based on the incoming route
    // Default is DEFAULT_MAX_LENGTH for everything except configured overrides below
    const overrides = new Map();

    // Allow longer fields when completing an admission slip
    // Endpoint: PUT /api/admission-slips/:id/complete
    const completeMatch = req.path && req.path.match(/^\/api\/admission-slips\/(\d+)\/complete$/);
    if (completeMatch && String(req.method).toUpperCase() === 'PUT') {
      // body.description and body.teacher_comments may be up to 128 chars
      overrides.set('body.description', 128);
      overrides.set('body.teacher_comments', 128);
      // Also accept 'description' or 'remarks' if front-end uses that naming in some payloads
      overrides.set('body.remarks', 128);
    }

    // Allow longer fields for forgot-password endpoints
    const forgotGetMatch = req.path && req.path.match(/^\/api\/auth\/forgot$/);
    const forgotResetMatch = req.path && req.path.match(/^\/api\/auth\/forgot\/reset$/);
    if ((forgotGetMatch && String(req.method).toUpperCase() === 'GET') || (forgotResetMatch && String(req.method).toUpperCase() === 'POST')) {
      // Enforce 32-char max for forgot-password inputs
      overrides.set('body.answer', 32);
      overrides.set('body.newPassword', 32);
    }

    // Allow getting/updating my security question
    const mySecMatch = req.path && req.path.match(/^\/api\/auth\/me\/security-question$/);
    if (mySecMatch) {
      if (String(req.method).toUpperCase() === 'GET') {
        overrides.set('query', 32);
      }
      if (String(req.method).toUpperCase() === 'PUT') {
        overrides.set('body.security_question', 32);
        overrides.set('body.security_answer', 32);
      }
    }

    const getMaxForPath = (path) => {
      if (overrides.has(path)) return overrides.get(path);
      return DEFAULT_MAX_LENGTH;
    };

    // Check body, query and params using the path-specific getter
    offenders.push(...findTooLong(req.body || {}, 'body', getMaxForPath));
    offenders.push(...findTooLong(req.query || {}, 'query', getMaxForPath));
    offenders.push(...findTooLong(req.params || {}, 'params', getMaxForPath));

    if (offenders.length > 0) {
      return res.status(400).json({
        success: false,
        error: `One or more inputs exceed maximum length`,
        fields: offenders.map(o => ({ path: o.path, length: o.length, max: o.max }))
      });
    }

    return next();
  } catch (err) {
    console.error('Input validation middleware error:', err);
    return res.status(500).json({ success: false, error: 'Input validation failed' });
  }
};
