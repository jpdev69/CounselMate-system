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
    // Bypass validation entirely for restore endpoint since it handles large JSON files
    const restoreMatch = req.path && req.path.match(/^\/api\/admin\/restore$/);
    if (restoreMatch && String(req.method).toUpperCase() === 'POST') {
      return next();
    }

    const offenders = [];

    // Determine per-field max overrides based on the incoming route
    // Default is DEFAULT_MAX_LENGTH for everything except configured overrides below
    const overrides = new Map();

    // Allow longer fields when completing an admission slip
    // Endpoint: PUT /api/admission-slips/:id/complete
    const completeMatch = req.path && req.path.match(/^\/api\/admission-slips\/(\d+)\/complete$/);
    if (completeMatch && String(req.method).toUpperCase() === 'PUT') {
      // body.description and body.teacher_comments may be up to 500 chars
      overrides.set('body.description', 500);
      overrides.set('body.teacher_comments', 500);
      // Also accept 'description' or 'remarks' if front-end uses that naming in some payloads
      overrides.set('body.remarks', 500);
      // course name can be up to 128 chars (same limit as admin panel)
      overrides.set('body.course', 128);
    }

    // Allow longer fields for violation validation
    // Endpoint: POST /api/admission-slips/validate-violation
    const validateMatch = req.path && req.path.match(/^\/api\/admission-slips\/validate-violation$/);
    if (validateMatch && String(req.method).toUpperCase() === 'POST') {
      // body.description can be up to 500 chars for validation
      overrides.set('body.description', 500);
    }

    // Allow longer messages for the chatbot endpoint
    // Endpoint: POST /api/chatbot/ask
    const chatbotMatch = req.path && req.path.match(/^\/api\/chatbot\/ask$/);
    if (chatbotMatch && String(req.method).toUpperCase() === 'POST') {
      overrides.set('body.message', 500);
    }

    // Allow longer course names for admin course create/update
    // Endpoint: POST/PUT /api/admin/courses or /api/admin/courses/:id
    const adminCourseWriteMatch = req.path && req.path.match(/^\/api\/admin\/courses(\/\d+)?$/) &&
      ['POST', 'PUT'].includes(String(req.method).toUpperCase());
    if (adminCourseWriteMatch) {
      overrides.set('body.name', 128);
    }

    // Allow longer studentName and course fields when issuing an admission slip
    // Endpoint: POST /api/admission-slips/issue
    const issueSlipMatch = req.path && req.path.match(/^\/api\/admission-slips\/issue$/);
    if (issueSlipMatch && String(req.method).toUpperCase() === 'POST') {
      overrides.set('body.studentName', 128); // first + middle + last names combined
      overrides.set('body.course', 128);      // course full name, same limit as admin panel
    }

    // Allow longer fields for student report creation
    // Endpoint: POST /api/reports
    const createReportMatch = req.path && req.path.match(/^\/api\/reports$/);
    if (createReportMatch && String(req.method).toUpperCase() === 'POST') {
      overrides.set('body.studentName', 128);
      overrides.set('body.course', 128);
      overrides.set('body.description', 500);
      overrides.set('body.remarks', 500);
    }

    // Allow longer remarks when resolving a student report
    // Endpoint: PUT /api/reports/:id/resolve
    const resolveReportMatch = req.path && req.path.match(/^\/api\/reports\/\d+\/resolve$/);
    if (resolveReportMatch && String(req.method).toUpperCase() === 'PUT') {
      overrides.set('body.remarks', 500);
    }

    // Allow longer fields for forgot-password endpoints
    const forgotGetMatch = req.path && req.path.match(/^\/api\/auth\/forgot$/);
    const forgotResetMatch = req.path && req.path.match(/^\/api\/auth\/forgot\/reset$/);
    if ((forgotGetMatch && String(req.method).toUpperCase() === 'GET') || (forgotResetMatch && String(req.method).toUpperCase() === 'POST')) {
      // Enforce 32-char max for forgot-password inputs
      overrides.set('body.answer', 32);
      overrides.set('body.newPassword', 32);
    }

    // Allow longer fields for signup request endpoint
    // Endpoint: POST /api/auth/signup-request
    const signupRequestMatch = req.path && req.path.match(/^\/api\/auth\/signup-request$/);
    if (signupRequestMatch && String(req.method).toUpperCase() === 'POST') {
      overrides.set('body.email', 64); // Standard email max length
      overrides.set('body.fullName', 128); // Allow longer full names
      overrides.set('body.reason', 128); // Allow detailed reasons for access
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

    // Allow email addresses for gmail-settings
    // Endpoint: PUT /api/auth/me/gmail-settings
    const gmailSettingsMatch = req.path && req.path.match(/^\/api\/auth\/me\/gmail-settings$/);
    if (gmailSettingsMatch && String(req.method).toUpperCase() === 'PUT') {
      overrides.set('body.recoveryEmail', 128);
    }

    // Allow longer fields when saving extracted violations
    // Endpoint: POST /api/admin/violations/save
    const violationsSaveMatch = req.path && req.path.match(/^\/api\/admin\/violations\/save$/);
    if (violationsSaveMatch && String(req.method).toUpperCase() === 'POST') {
      overrides.set('body.violations', 99999); // outer array — individual field limits set below
      // Each item in violations[*]
      for (let i = 0; i < 500; i++) {
        overrides.set(`body.violations[${i}].code`, 128);
        overrides.set(`body.violations[${i}].description`, 256);
        overrides.set(`body.violations[${i}].category`, 32);
        overrides.set(`body.violations[${i}].section_ref`, 16);
      }
    }

    // Allow longer fields for single violation type creation
    // Endpoint: POST /api/admin/violation-types
    const violationTypeCreateMatch = req.path && req.path.match(/^\/api\/admin\/violation-types$/);
    if (violationTypeCreateMatch && String(req.method).toUpperCase() === 'POST') {
      overrides.set('body.code', 64);
      overrides.set('body.description', 128);
      overrides.set('body.category', 32);
      overrides.set('body.section_ref', 16);
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
