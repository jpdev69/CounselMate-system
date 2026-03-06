// backend/routes/chatbot.js
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud';

/**
 * Call the local Ollama API (same pattern as violationMatcher.js)
 */
function callOllama(endpoint, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, OLLAMA_BASE_URL);
    const postData = JSON.stringify(data);
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(body));
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Check if Ollama is reachable
 */
async function isOllamaAvailable() {
  try {
    const response = await callOllama('/api/tags', {});
    return response.includes('models') || response.length > 0;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  READ THE STUDENT MANUAL ONCE AT SERVER STARTUP
// ═══════════════════════════════════════════════════════════════════
const MANUAL_PATH = path.resolve(__dirname, '../../Isabela State University - Student Manual.txt');
let RAW_MANUAL = '';

try {
  RAW_MANUAL = fs.readFileSync(MANUAL_PATH, 'utf-8');
  console.log(`✅ Student Manual loaded (${RAW_MANUAL.length} chars)`);
} catch (err) {
  console.error('❌ Failed to load Student Manual:', err.message);
  RAW_MANUAL = '';
}

// ═══════════════════════════════════════════════════════════════════
//  EXTRACT ONLY CONDUCT / VIOLATION SECTIONS ONCE
//  Instead of sending the entire ~120K manual to DeepSeek, we pick
//  only the line ranges that cover conduct, violations, penalties,
//  discipline, attendance, academic status, and related policies.
// ═══════════════════════════════════════════════════════════════════
function extractRelevantSections(fullText) {
  if (!fullText) return 'Student manual content unavailable.';

  const lines = fullText.split('\n');

  // Define precise line-range "regions" (0-indexed).
  // Each region: capture from START keyword until STOP keyword line.
  const regions = [
    { start: 'B. RETENTION POLICIES',      stop: '2. ADVANCED CREDITS' },       // retention / academic status
    { start: '8. ACADEMIC STATUS',          stop: '9. ACADEMIC LOAD' },          // academic status detail
    { start: '15. CLASS ATTENDANCE',        stop: '16. CLASS SIZE' },            // attendance rules
    { start: '24. HONORABLE DISMISSAL',     stop: '25. MODES OF PAYMENT' },     // honorable dismissal
    { start: '28. SCHOOL UNIFORM',          stop: '31. PROVISION' },            // uniform rules
    { start: 'RIGHTS OF THE STUDENTS',      stop: 'RULE II' },                  // rights, duties, conduct, penalties, offenses, investigation/appeal — the BIG section
    { start: 'PROCEDURES FOR THE SETTLEMENT', stop: 'POSTERS, BANNERS' },       // grievance procedures
    { start: 'REPUBLIC ACT 9165',           stop: 'REPUBLIC ACT 7079' },        // drugs, sexual harassment, anti-violence
  ];

  const extracted = [];

  for (const region of regions) {
    let capturing = false;
    for (let i = 0; i < lines.length; i++) {
      const upper = lines[i].toUpperCase().trim();

      if (!capturing && upper.includes(region.start)) {
        capturing = true;
      }

      if (capturing && region.stop && upper.includes(region.stop)) {
        break; // stop this region
      }

      if (capturing) {
        extracted.push(lines[i]);
      }
    }
  }

  const result = extracted.join('\n').trim();
  console.log(`✅ Extracted relevant sections: ${result.length} chars (from ${fullText.length} total)`);
  return result || fullText;
}

const FOCUSED_MANUAL = extractRelevantSections(RAW_MANUAL);

// ═══════════════════════════════════════════════════════════════════
//  BUILD SYSTEM PROMPT ONCE AT STARTUP
// ═══════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `You are the CounselMate Violation Rules Assistant for Isabela State University (ISU). You are a specialized chatbot that helps with questions about student violations, discipline, penalties, offenses, disciplinary actions, investigation procedures, academic status, and student conduct as defined in the ISU Student Manual.

YOUR SOLE SOURCE OF TRUTH — RELEVANT SECTIONS OF THE ISU STUDENT MANUAL:
===BEGIN===
${FOCUSED_MANUAL}
===END===

RULES:
1. For greetings ("hello", "hi", "hey", etc.) or meta-questions ("what can you do?", "help", "who are you?"), respond warmly and briefly explain your capabilities.
2. For questions about violations, offenses, penalties, disciplinary actions, investigation/appeal procedures, student conduct, academic status/retention, class attendance, and student duties — answer helpfully using ONLY the manual above.
3. Always cite specific section numbers when applicable (e.g., "Section 2.1.3" or "Section 3.2.1").
4. Be accurate — only provide information from the manual. Do not invent rules.
5. Be helpful, professional, and conversational. This is a university counseling context.
6. Keep responses concise but complete.
7. If asked about a violation scenario, classify it as minor or major and state the applicable penalty.
8. If a question is clearly unrelated (cooking, movies, trivia, etc.), politely explain your scope and suggest what you CAN help with. Do NOT just reject — always guide the user.
9. When uncertain if a question is relevant, lean toward being helpful.`;

console.log(`✅ System prompt ready (${SYSTEM_PROMPT.length} chars)`);

// POST /api/chatbot/ask
router.post('/ask', async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  const userMessage = message.trim();

  // Try DeepSeek via Ollama first
  const ollamaUp = await isOllamaAvailable();

  if (!ollamaUp) {
    // Fallback: keyword-based response system
    return res.json({
      success: true,
      reply: getFallbackResponse(userMessage)
    });
  }

  try {
    const raw = await callOllama('/api/chat', {
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 1024
      }
    });

    const parsed = JSON.parse(raw);
    let reply = parsed?.message?.content || '';

    // DeepSeek sometimes appends special tokens — strip them
    reply = reply.replace(/<[^>]+>/g, '').trim();

    if (!reply) {
      reply = 'Sorry, I could not generate a response. Please try again.';
    }

    return res.json({ success: true, reply });
  } catch (err) {
    console.error('Chatbot DeepSeek/Ollama error:', err.message || err);

    // If Ollama fails, use fallback
    return res.json({
      success: true,
      reply: getFallbackResponse(userMessage)
    });
  }
});

/**
 * Keyword-based fallback responder when DeepSeek/Ollama is not available.
 * Handles greetings, meta-questions, and violation/discipline questions.
 */
function getFallbackResponse(message) {
  const msg = message.toLowerCase().trim();

  // ── Greetings & meta-questions ──
  const greetingPatterns = [
    'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
    'greetings', 'sup', 'yo', 'howdy', 'what\'s up', 'whats up'
  ];
  const metaPatterns = [
    'what can you do', 'what do you do', 'who are you', 'help',
    'what are you', 'how do you work', 'what is this', 'how can you help',
    'what can i ask', 'what should i ask', 'capabilities', 'features',
    'tell me about yourself', 'introduce yourself', 'your purpose',
    'what is counselmate', 'what\'s counselmate'
  ];
  const thankPatterns = [
    'thank', 'thanks', 'salamat', 'ty', 'appreciate', 'got it', 'ok thanks',
    'okay thanks', 'that helps', 'helpful'
  ];

  const isGreeting = greetingPatterns.some(g => msg === g || msg.startsWith(g + ' ') || msg.startsWith(g + '!') || msg.startsWith(g + ','));
  const isMeta = metaPatterns.some(m => msg.includes(m));
  const isThank = thankPatterns.some(t => msg.includes(t));

  if (isGreeting || isMeta) {
    return `Hello! I'm the **CounselMate Violation Rules Assistant** for Isabela State University. Here's what I can help you with:

• **Minor & Major Offenses** – full list of violations from the ISU Student Manual
• **Penalties** – what happens on 1st, 2nd, and 3rd offenses
• **Disciplinary Actions** – how complaints are filed and handled
• **Investigation & Appeal** – committee composition and procedures
• **Student Conduct** – duties, responsibilities, and basic discipline
• **Class Attendance** – absence limits and tardiness rules
• **Academic Status** – warning, probation, dismissal, and permanent disqualification

Try asking things like:
- "What are the minor offenses?"
- "What is the penalty for bullying?"
- "How do I file a complaint?"
- "What happens if I'm always late?"`;
  }

  if (isThank) {
    return "You're welcome! If you have more questions about violations, penalties, or student conduct, feel free to ask anytime.";
  }

  // ── Relevance check ──
  const relevantKeywords = [
    'violation', 'offense', 'offenses', 'penalty', 'penalties', 'suspend',
    'suspension', 'dismiss', 'dismissal', 'expel', 'expulsion', 'discipline',
    'disciplinary', 'conduct', 'misconduct', 'cheating', 'smoking', 'hazing',
    'bullying', 'harassment', 'gambling', 'vandalism', 'disrespect', 'assault',
    'threat', 'uniform', 'littering', 'loitering', 'id card', 'identification card',
    'pornograph', 'drugs', 'alcohol', 'weapon', 'forgery', 'falsification',
    'barricade', 'sorority', 'fraternity', 'fighting', 'sedition', 'pda',
    'public display', 'affection', 'intimacy', 'indecent', 'immoral',
    'subversive', 'unauthorized', 'investigation', 'appeal', 'complaint',
    'due process', 'committee', 'osas', 'minor offense', 'major offense',
    'reprimand', 'community service', 'probation', 'warning', 'academic status',
    'disqualification', 'dropped', 'attendance', 'absent', 'absences', 'tardiness',
    'late', 'student conduct', 'student manual', 'rules', 'regulations',
    'prohibited', 'banned', 'not allowed', 'punish', 'sanction', 'consequence',
    'gadget', 'electronic', 'software', 'eating', 'restricted area', 'traffic',
    'driving', 'muffler', 'verbal abuse', 'physical injur', 'scandalous',
    'what happens', 'what is the penalty', 'what are the', 'how many days',
    'first offense', 'second offense', 'third offense', 'classify', 'category',
    'report', 'file', 'wrong', 'trouble', 'caught', 'punishable', 'allowed',
    'permit', 'behavior', 'behaviour', 'student', 'campus', 'school',
    'drink', 'drunk', 'smoke', 'vape', 'hit', 'steal', 'cheat', 'copy',
    'skip', 'class', 'cut class', 'absent', 'porn', 'sex', 'knife', 'gun'
  ];

  const isRelevant = relevantKeywords.some(kw => msg.includes(kw));

  if (!isRelevant) {
    return `I'm not sure I can help with that specific topic. I specialize in **student violations, discipline, and conduct rules** from the ISU Student Manual.

Here are some things you can ask me about:
• "What are the minor offenses?"
• "What are the major offenses?"
• "What is the penalty for cheating?"
• "How does the investigation process work?"
• "What are the attendance rules?"

Would you like to know about any of these?`;
  }

  // Minor offenses
  if (msg.includes('minor offense') || msg.includes('minor violation') || msg.includes('list') && msg.includes('minor')) {
    return `**Minor Offenses (Section 2.1):**

1. Failure to wear proper/complete uniform (2.1.1)
2. Possession and passing of pornographic materials (2.1.2)
3. Littering/unsanitary acts (2.1.3)
4. Loitering (2.1.4)
5. Eating in restricted areas (library, computer labs, other labs) (2.1.5)
6. Unauthorized use of school facilities (2.1.6)
7. Lending/borrowing of Identification Card (2.1.7)
8. Driving without license/unregistered vehicle/violation of traffic rules inside campus (2.1.8)

**Penalties for Minor Offenses (Section 3.1):**
- 1st offense: Reprimand and apology, promissory letter, restitution, summons for parents/guardians
- 2nd offense: Suspension from 1 to 4 days, community service
- 3rd offense: Treated as a major offense`;
  }

  // Major offenses
  if (msg.includes('major offense') || msg.includes('major violation') || msg.includes('list') && msg.includes('major')) {
    return `**Major Offenses (Section 2.2):**

1. Possession/use of alcoholic drinks, prohibited drugs, deadly weapons, explosives (2.2.1)
2. Smoking (2.2.2)
3. Disrespect (2.2.3)
4. Vandalism (2.2.4)
5. Dishonesty/cheating/forgery/falsification (2.2.5)
6. Creating barricades/obstructions (2.2.6)
7. Assaults/physical injuries/verbal abuse (2.2.7)
8. Hazing (2.2.8)
9. Harassment and sexual abuse/acts of lasciviousness (2.2.9)
10. Use of unauthorized software and electronic gadgets (2.2.10)
11. Involvement in unrecognized sorority/fraternity (2.2.11)
12. Gambling (2.2.12)
13. Public display of affection/intimacy, indecent or immoral acts (2.2.13)
14. Possession/distribution of offensive/subversive materials (2.2.14)
15. Grave threats (2.2.15)
16. Inciting to fight/sedition (2.2.16)
17. Conducting activity without OSAS approval/misrepresenting the University (2.2.17)
18. Bullying (2.2.18)

**Penalties for Major Offenses (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  // Penalty questions
  if (msg.includes('penalty') || msg.includes('penalties') || msg.includes('punishment') || msg.includes('sanction') || msg.includes('consequence')) {
    return `**Penalties (Section 3):**

**For Minor Offenses (Section 3.1):**
- 1st offense: Reprimand and apology, promissory letter, restitution, summons for parents/guardians
- 2nd offense: Suspension from 1 to 4 days, community service (determined by OSAS)
- 3rd offense: Treated as a major offense

**For Major Offenses (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service (determined by OSAS)
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal (depending on gravity, after due process)

The OSAS Director/Chief determines penalties considering: nature and gravity of offense, previous record, status of the aggrieved party, and aggravating/mitigating circumstances (Section 1.1).`;
  }

  // Specific violations
  if (msg.includes('smoking') || msg.includes('smoke')) {
    return `**Smoking** is classified as a **Major Offense** under Section 2.2.2, as reiterated in RA 8749 (Clean Air Act).

**Penalties (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  if (msg.includes('cheating') || msg.includes('dishonest') || msg.includes('forgery') || msg.includes('falsif')) {
    return `**Dishonesty/Cheating/Forgery/Falsification** is classified as a **Major Offense** under Section 2.2.5.

**Penalties (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  if (msg.includes('bully') || msg.includes('bullying')) {
    return `**Bullying** is classified as a **Major Offense** under Section 2.2.18.

**Penalties (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  if (msg.includes('hazing')) {
    return `**Hazing** is classified as a **Major Offense** under Section 2.2.8.

**Penalties (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  if (msg.includes('harassment') || msg.includes('sexual abuse') || msg.includes('lasciviousness')) {
    return `**Harassment and sexual abuse/acts of lasciviousness** is classified as a **Major Offense** under Section 2.2.9.

**Penalties (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  if (msg.includes('uniform') || msg.includes('dress code')) {
    return `**Failure to wear proper/complete uniform** is classified as a **Minor Offense** under Section 2.1.1.

**Penalties (Section 3.1):**
- 1st offense: Reprimand and apology, promissory letter, restitution, summons for parents/guardians
- 2nd offense: Suspension from 1 to 4 days, community service
- 3rd offense: Treated as a major offense`;
  }

  if (msg.includes('drug') || msg.includes('alcohol') || msg.includes('weapon') || msg.includes('explosive')) {
    return `**Possession and use of alcoholic drinks, prohibited drugs, deadly weapons, and explosives** is classified as a **Major Offense** under Section 2.2.1.

**Penalties (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  if (msg.includes('gambling')) {
    return `**Gambling** is classified as a **Major Offense** under Section 2.2.12.

**Penalties (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  if (msg.includes('vandalism')) {
    return `**Vandalism** in all areas/facilities of the campus is classified as a **Major Offense** under Section 2.2.4.

**Penalties (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  if (msg.includes('littering') || msg.includes('unsanitary')) {
    return `**Littering/unsanitary acts** is classified as a **Minor Offense** under Section 2.1.3.

**Penalties (Section 3.1):**
- 1st offense: Reprimand and apology, promissory letter, restitution, summons for parents/guardians
- 2nd offense: Suspension from 1 to 4 days, community service
- 3rd offense: Treated as a major offense`;
  }

  if (msg.includes('loiter')) {
    return `**Loitering** is classified as a **Minor Offense** under Section 2.1.4.

**Penalties (Section 3.1):**
- 1st offense: Reprimand and apology, promissory letter, restitution, summons for parents/guardians
- 2nd offense: Suspension from 1 to 4 days, community service
- 3rd offense: Treated as a major offense`;
  }

  if (msg.includes('eating') || msg.includes('restricted area')) {
    return `**Eating in restricted areas** (library, computer laboratories, other laboratories) is classified as a **Minor Offense** under Section 2.1.5.

**Penalties (Section 3.1):**
- 1st offense: Reprimand and apology, promissory letter, restitution, summons for parents/guardians
- 2nd offense: Suspension from 1 to 4 days, community service
- 3rd offense: Treated as a major offense`;
  }

  if (msg.includes('sorority') || msg.includes('fraternity')) {
    return `**Involvement in unrecognized sorority/fraternity** is classified as a **Major Offense** under Section 2.2.11.

**Penalties (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  if (msg.includes('gadget') || msg.includes('electronic') || msg.includes('unauthorized software')) {
    return `**Use of unauthorized software and electronic gadgets** is classified as a **Major Offense** under Section 2.2.10.

**Penalties (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  if (msg.includes('pda') || msg.includes('public display') || msg.includes('affection') || msg.includes('intimacy') || msg.includes('indecent') || msg.includes('immoral') || msg.includes('scandalous')) {
    return `**Public display of affection or intimacy, indecent or immoral acts like scandalous videos** is classified as a **Major Offense** under Section 2.2.13.

**Penalties (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  if (msg.includes('investigation') || msg.includes('appeal') || msg.includes('committee') || msg.includes('complaint') || msg.includes('due process')) {
    return `**Committee on Investigation/Appeal:**

The OSAS creates a committee composed of:
- Director/Chief of Student Services
- Director of Instruction/ARA
- Two senior faculties
- SSC President of the campus

**Disciplinary proceedings require:**
1. Filing of written complaint under oath by the complainant to OSAS (Section 2.1.1)
2. Submission of official report about the violation (Section 2.1.2)

**Dispute handling:**
- Student vs. Faculty/Employee (student as respondent): Handled by OSAS (Section 3)
- Faculty/Staff as respondent: Committee appointed by Director of Instruction/ARA (Section 4)
- Between students: Special committee of OSAS Chief/Director, SSC Adviser, SSC President, CCL Chief Justice, CCL Speaker (Section 5)
- Between students of different campuses: University Student Tribunal (Section 6)

Appeals may be addressed to the Campus Head or University President.`;
  }

  if (msg.includes('attendance') || msg.includes('absent') || msg.includes('tardiness') || msg.includes('late') || msg.includes('tardy')) {
    return `**Class Attendance Rules (Section 15):**

- All students shall attend the prescribed number of hours in a subject (15.a)
- Absences due to inevitable circumstances require an excuse slip from the Guidance Office (15.b)
- Illness absences require a medical certificate verified by the Campus/University Physician/Nurse (15.b)
- Students absent for more than **20% of total lecture and laboratory hours** without valid reasons shall be **dropped from the class roll** (15.c)
- A **15-minute tardiness** is equivalent to **one-hour period of absence** (15.d)`;
  }

  if (msg.includes('academic status') || msg.includes('probation') || msg.includes('disqualification') || msg.includes('warning')) {
    return `**Academic Status (Section 8):**

- **Good standing**: Regular students with no failing and/or incomplete grades
- **Warning**: Students who failed in **25%** of total units enrolled
- **Probation**: Students who failed in **50%** of total units enrolled
- **Dismissed**: Students who failed in **75% but less than 100%** of academic units (dismissed from program, may apply to another)
- **Permanent Disqualification**: Students who failed in **100%** of academic units (no longer allowed to enroll in any program across all campuses)`;
  }

  if (msg.includes('assault') || msg.includes('physical injur') || msg.includes('verbal abuse') || msg.includes('fighting') || msg.includes('fight')) {
    return `**Assaults/physical injuries/verbal abuse** in all forms and medium (oral, social media, text messages) is classified as a **Major Offense** under Section 2.2.7.

**Inciting to fight/sedition** is also a **Major Offense** under Section 2.2.16.

**Penalties (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  if (msg.includes('threat') || msg.includes('grave threat')) {
    return `**Grave threats** is classified as a **Major Offense** under Section 2.2.15.

**Penalties (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  if (msg.includes('disrespect')) {
    return `**Disrespect** is classified as a **Major Offense** under Section 2.2.3.

**Penalties (Section 3.2):**
- 1st offense: Suspension from 5 to 10 days or Community Service
- 2nd offense: Suspension from 11 to 15 days
- 3rd offense: Suspension up to 45 calendar days to dismissal`;
  }

  if (msg.includes('id') && (msg.includes('lend') || msg.includes('borrow'))) {
    return `**Lending/borrowing of Identification Card** is classified as a **Minor Offense** under Section 2.1.7.

**Penalties (Section 3.1):**
- 1st offense: Reprimand and apology, promissory letter, restitution, summons for parents/guardians
- 2nd offense: Suspension from 1 to 4 days, community service
- 3rd offense: Treated as a major offense`;
  }

  if (msg.includes('driving') || msg.includes('traffic') || msg.includes('vehicle') || msg.includes('muffler') || msg.includes('speeding')) {
    return `**Driving without license/unregistered vehicle/violation of traffic rules inside the campus** (including over speeding and noisy mufflers) is classified as a **Minor Offense** under Section 2.1.8, as reiterated in RA 8749 (Clean Air Act).

**Penalties (Section 3.1):**
- 1st offense: Reprimand and apology, promissory letter, restitution, summons for parents/guardians
- 2nd offense: Suspension from 1 to 4 days, community service
- 3rd offense: Treated as a major offense`;
  }

  if (msg.includes('suspension') || msg.includes('suspend') || msg.includes('how many days')) {
    return `**Suspension Periods:**

**For Minor Offenses (Section 3.1):**
- 1st offense: No suspension (reprimand, apology, promissory letter instead)
- 2nd offense: **1 to 4 days** suspension + community service
- 3rd offense: Treated as a major offense

**For Major Offenses (Section 3.2):**
- 1st offense: **5 to 10 days** suspension or Community Service
- 2nd offense: **11 to 15 days** suspension
- 3rd offense: **Up to 45 calendar days** suspension to dismissal

Note: Section 7 states that disciplinary sanctions do not prevent the University from endorsing the case to proper government authorities when penal laws are involved.`;
  }

  // Generic relevant response
  return `Based on the ISU Student Manual, violations are classified into **Minor Offenses** (Section 2.1) and **Major Offenses** (Section 2.2).

**Minor Offenses** include: uniform violations, pornographic materials, littering, loitering, eating in restricted areas, unauthorized facility use, ID lending/borrowing, and traffic violations on campus.

**Major Offenses** include: drugs/alcohol/weapons, smoking, disrespect, vandalism, cheating/forgery, assaults, hazing, harassment, unauthorized gadgets, fraternity/sorority involvement, gambling, PDA/indecent acts, subversive materials, threats, inciting to fight, unauthorized activities, and bullying.

Could you ask a more specific question about a particular violation, penalty, or disciplinary procedure? I can provide detailed information including section references.`;
}

module.exports = router;
