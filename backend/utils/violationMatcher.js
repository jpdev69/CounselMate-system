const http = require('http');

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud';

/**
 * Makes a request to the local Ollama API
 * @param {string} endpoint - The API endpoint
 * @param {object} data - The request body
 * @returns {Promise<string>} - The response text
 */
async function callOllama(endpoint, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, OLLAMA_BASE_URL);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(body);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * Checks if Ollama is running and accessible (GET /api/tags)
 * @returns {Promise<boolean>}
 */
function isOllamaAvailable() {
  return new Promise((resolve) => {
    const url = new URL('/api/tags', OLLAMA_BASE_URL);
    http.get(url.toString(), (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(res.statusCode === 200));
    }).on('error', (error) => {
      console.error('❌ Ollama is not available:', error.message);
      resolve(false);
    });
  });
}

/**
 * Validates if violation description matches the violation type
 * Uses local Ollama LLM to perform semantic matching
 * @param {string} violationType - The type/code of the violation (e.g., "TARDINESS")
 * @param {string} description - The detailed violation description
 * @returns {Promise<{matches: boolean, confidence: number, reason: string}>}
 */
async function validateViolationMatch(violationType, description) {
  if (!violationType || !description) {
    return {
      matches: false,
      confidence: 0,
      reason: 'Missing violation type or description',
    };
  }

  try {
    const available = await isOllamaAvailable();
    if (!available) {
      console.warn(
        '⚠️  Ollama is not available. Using fallback validation. Please start Ollama with: ollama serve'
      );
      return performFallbackValidation(violationType, description);
    }

    // LLM-only: explicit about confirming violation occurred, handles negation
    const knownViolationTypes = [
      'Academic Cheating', 'Bullying', 'Disrespect', 'Dress Code Violation',
      'Fighting', 'Gadget/Device Misuse', 'Inappropriate Behavior', 'Smoking/Vaping',
      'Substance Abuse', 'Tardiness', 'Theft', 'Truancy', 'Vandalism',
    ];
    const otherTypes = knownViolationTypes.filter(
      (t) => t.toLowerCase() !== violationType.toLowerCase()
    );
    const strictPrompt = `Does this description CONFIRM the student committed specifically THIS violation type and NOT a more specific one?
Violation Type to check: ${violationType}
Description: ${description}

Other known violation types: ${otherTypes.join(', ')}

Rules:
- If description says NOT, didn't, never, or denies violation: MISMATCH
- If the description is asking a question even without question mark: MISMATCH
- If description is vague: MISMATCH
- Only if the description clearly and specifically confirms THIS violation type occurred: MATCH

Respond ONE WORD: MATCH or MISMATCH`;

    const response = await callOllama('/api/generate', {
      model: OLLAMA_MODEL,
      prompt: strictPrompt,
      stream: false,
      temperature: 0.1,
      options: {
        num_predict: 10, // enough tokens for MATCH/MISMATCH even with special tokens
      }
    });

    // Parse the response
    let result;
    try {
      result = JSON.parse(response);
    } catch (e) {
      console.warn('Failed to parse LLM response as JSON, attempting text extraction');
      result = { response: response };
    }

    const rawResponse = (result.response || response).trim();
    // DeepSeek appends special tokens (e.g. <｜END▁OF▁SENTENCE｜>) — extract first clean word only
    const firstWord = rawResponse.match(/[A-Za-z]+/);
    const responseText = firstWord ? firstWord[0].toUpperCase() : '';
    console.log('🤖 LLM Response:', responseText);

    if (responseText === 'MATCH') {
      return {
        matches: true,
        confidence: 0.9,
        reason: `LLM validated that the description matches violation type "${violationType}"`,
      };
    }

    if (responseText === 'MISMATCH' || responseText === 'MISMAT') {
      return {
        matches: false,
        confidence: 0.95,
        reason: `The violation description does not clearly match the violation type "${violationType}"`,
      };
    }

    // LLM returned junk/unrecognized output — fall back to keyword matching
    console.warn(`⚠️  LLM returned unrecognized response "${responseText}", falling back to keyword matching`);
    return performFallbackValidation(violationType, description);
  } catch (error) {
    console.error('❌ Error validating violation match:', error.message);
    // Fallback to simple validation if LLM fails
    return performFallbackValidation(violationType, description);
  }
}

/**
 * Fallback validation when LLM is not available
 * Performs basic keyword matching
 * @param {string} violationType
 * @param {string} description
 * @returns {object}
 */
function performFallbackValidation(violationType, description) {
  const typeUpper = violationType.toUpperCase();
  const typeKey = typeUpper.replace(/[_\s-]/g, ''); // normalize e.g., DRESS_CODE -> DRESSCODE
  const descUpper = description.toUpperCase();
  const descTrimmed = description.trim();

  // Reject if description is a question (even without a question mark)
  const questionPatterns = [
    /\?/,                                    // explicit question mark
    /^(did|does|do|is|are|was|were|has|have|had|can|could|will|would|should|may|might)\b/i,
    /^(what|when|where|who|whom|whose|which|why|how)\b/i,
    /^(isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|can't|couldn't|won't|wouldn't|shouldn't)\b/i,
  ];
  const isQuestion = questionPatterns.some((pattern) => pattern.test(descTrimmed));
  if (isQuestion) {
    return {
      matches: false,
      confidence: 0.9,
      reason: 'Description appears to be a question, not a confirmed violation',
    };
  }

  // Reject if description contains negation patterns that deny the violation
  const negationPatterns = [
    /\b(did not|didn't|does not|doesn't|was not|wasn't|is not|isn't|never|not guilty|no violation|falsely accused|denied)\b/i,
  ];
  const isNegated = negationPatterns.some((pattern) => pattern.test(description));
  if (isNegated) {
    return {
      matches: false,
      confidence: 0.85,
      reason: 'Description contains negation or denial of the violation',
    };
  }

  // Define violation type categories and related keywords (optimized for offline fallback)
  // Includes both legacy codes and Student Manual codes
  const violationKeywords = {
    TARDINESS: [
      'LATE', 'TARDY', 'TARDINESS', 'ARRIVE LATE', 'ARRIVED LATE', 'NOT ON TIME',
      'CAME IN LATE', 'WENT IN LATE', 'AFTER THE BELL', 'PAST THE TIME',
      'DELAYED', 'OVERDUE', 'MISSED START', 'LATE ENTRY', 'LATE ARRIVAL',
      'HABITUAL LATE', 'CONSISTENTLY LATE', 'ALWAYS LATE', 'PUNCTUALITY',
    ],
    TRUANCY: [
      'SKIP', 'SKIPPED', 'SKIPPING', 'ABSENT', 'ABSENCE', 'BUNKED', 'DID NOT ATTEND',
      'CUT CLASS', 'CUTTING CLASS', 'LEFT SCHOOL', 'LEFT CAMPUS', 'AWOL',
      'UNEXCUSED ABSENCE', 'NO SHOW', 'MISSING FROM CLASS', 'NOT IN CLASS',
      'WALKED OUT', 'DITCHED', 'ESCAPED', 'SNEAKED OUT', 'LEFT WITHOUT PERMISSION',
      'UNAUTHORIZED ABSENCE', 'WENT HOME EARLY', 'NOT PRESENT',
    ],
    DISRESPECT: [
      'RUDE', 'DISRESPECT', 'DISRESPECTFUL', 'TALK BACK', 'TALKED BACK', 'TALKING BACK',
      'INSOLENT', 'INSUBORDINATE', 'INSUBORDINATION', 'DEFIANT', 'DEFIANCE',
      'MOCKED', 'MOCKING', 'SARCASTIC', 'INSULTED', 'INSULTING', 'CURSED',
      'CURSING', 'PROFANITY', 'SWEARING', 'SWORE', 'BAD LANGUAGE', 'FOUL LANGUAGE',
      'RUDE GESTURE', 'DISRUPTIVE', 'DISRUPTION', 'BACK TALK', 'SMART MOUTH',
      'ARGUMENTATIVE', 'ARROGANT', 'CONTEMPTUOUS', 'OFFENSIVE REMARK',
    ],
    BULLYING: [
      'BULLY', 'BULLIED', 'BULLYING', 'HARASS', 'HARASSED', 'HARASSMENT',
      'THREATEN', 'THREATENED', 'THREATENING', 'INTIMIDATE', 'INTIMIDATED', 'INTIMIDATION',
      'TEASE', 'TEASED', 'TEASING', 'MOCK', 'MOCKED', 'CYBERBULLY', 'CYBERBULLYING',
      'COERCE', 'COERCION', 'EXTORT', 'EXTORTION', 'NAME CALLING', 'CALLED NAMES',
      'HUMILIATE', 'HUMILIATED', 'SHAMED', 'SHAMING', 'RIDICULE', 'TORMENT',
      'SPREAD RUMORS', 'SPREADING RUMORS', 'GANGED UP', 'SOCIAL EXCLUSION',
    ],
    CHEATING: [
      'CHEAT', 'CHEATED', 'CHEATING', 'COPIED', 'COPYING', 'PLAGIARISM', 'PLAGIARIZED',
      'COPIED WORK', 'ACADEMIC DISHONESTY', 'ACADEMIC MISCONDUCT',
      'ANSWER KEY', 'CRIB NOTES', 'CHEAT SHEET', 'UNAUTHORIZED NOTES',
      'LOOKED AT ANOTHER', 'SHARED ANSWERS', 'GAVE ANSWERS', 'RECEIVED ANSWERS',
      'FABRICATED', 'FALSIFIED', 'FORGED', 'FORGERY', 'GHOSTWRITTEN',
      'UNAUTHORIZED AID', 'UNAUTHORIZED MATERIAL', 'EXAM FRAUD', 'TEST FRAUD',
      'USED PHONE DURING EXAM', 'IMPERSONATION',
    ],
    FIGHTING: [
      'FIGHT', 'FIGHTING', 'FOUGHT', 'PHYSICAL', 'PHYSICAL VIOLENCE',
      'HIT', 'HITTING', 'PUNCH', 'PUNCHED', 'PUNCHING', 'ASSAULT', 'ASSAULTED',
      'ALTERCATION', 'BRAWL', 'KICK', 'KICKED', 'KICKING', 'SLAP', 'SLAPPED',
      'PUSH', 'PUSHED', 'SHOVING', 'SHOVED', 'WRESTLE', 'WRESTLING',
      'THREW PUNCH', 'ATTACKED', 'ATTACKING', 'STRUCK', 'PHYSICAL CONFRONTATION',
      'BODILY HARM', 'VIOLENT', 'VIOLENCE', 'GRABBED', 'CHOKED', 'HEADLOCK',
    ],
    VANDALISM: [
      'DAMAGE', 'DAMAGED', 'DAMAGING', 'DEFACE', 'DEFACED', 'DEFACING',
      'VANDAL', 'VANDALISM', 'VANDALIZED', 'DESTROY', 'DESTROYED', 'DESTROYING',
      'BREAK', 'BROKE', 'BROKEN', 'SMASH', 'SMASHED', 'GRAFFITI',
      'SCRATCH', 'SCRATCHED', 'CARVE', 'CARVED', 'TAMPER', 'TAMPERED',
      'WRECK', 'WRECKED', 'RUIN', 'RUINED', 'TORN', 'TORE', 'RIPPED',
      'PROPERTY DAMAGE', 'SCHOOL PROPERTY', 'WROTE ON WALL', 'WROTE ON DESK',
      'KICKED DOOR', 'PUNCHED WALL', 'THREW CHAIR', 'SHATTERED',
    ],
    DRESSCODE: [
      'UNIFORM', 'DRESS CODE', 'DRESSCODE', 'IMPROPER UNIFORM', 'NO UNIFORM',
      'NOT WEARING UNIFORM', 'WITHOUT UNIFORM', 'OUT OF UNIFORM',
      'ATTIRE', 'APPEARANCE', 'GROOMING', 'DRESS', 'WEARING JEANS',
      'CIVILIAN CLOTHES', 'WRONG UNIFORM', 'NO ID', 'MISSING ID', 'NO ID LACE',
      'INCOMPLETE UNIFORM', 'IMPROPER ATTIRE', 'COLORED SHOES', 'WRONG SHOES',
      'NO SCHOOL SHOES', 'SLIPPERS', 'UNTUCKED', 'SHIRT UNTUCKED',
      'DYED HAIR', 'COLORED HAIR', 'EARRINGS', 'JEWELRY', 'PIERCING',
      'SHORTS', 'RIPPED JEANS', 'CAP', 'HAT', 'HOODIE', 'NON-REGULATION',
      'INAPPROPRIATE CLOTHING', 'INDECENT', 'PE UNIFORM', 'WRONG ATTIRE',
    ],
    SMOKING: [
      'SMOKE', 'SMOKED', 'SMOKING', 'CIGARETTE', 'VAPE', 'VAPING', 'VAPED',
      'E-CIGARETTE', 'NICOTINE', 'TOBACCO', 'JUUL', 'POD', 'PUFF',
      'CAUGHT SMOKING', 'SMELL OF SMOKE', 'LIGHTER', 'ASHTRAY',
    ],
    THEFT: [
      'STEAL', 'STOLE', 'STOLEN', 'STEALING', 'THEFT', 'THIEF',
      'TOOK WITHOUT PERMISSION', 'PICKPOCKET', 'SHOPLIFTING', 'PILFERING',
      'SNATCHED', 'GRABBED', 'MISSING BELONGINGS', 'UNAUTHORIZED POSSESSION',
      'LOOTED', 'BURGLARIZED', 'ROBBED', 'ROBBERY',
    ],
    SUBSTANCE: [
      'DRUG', 'DRUGS', 'ALCOHOL', 'DRUNK', 'INTOXICATED', 'UNDER THE INFLUENCE',
      'SUBSTANCE', 'MARIJUANA', 'WEED', 'PROHIBITED SUBSTANCE',
      'ILLICIT', 'NARCOTICS', 'HIGH', 'INEBRIATED', 'LIQUOR', 'BEER', 'WINE',
      'POSSESSION OF DRUGS', 'DRUG PARAPHERNALIA', 'DRUG USE',
    ],
    GADGET: [
      'CELLPHONE', 'CELL PHONE', 'PHONE', 'MOBILE', 'GADGET', 'DEVICE',
      'TABLET', 'EARPHONES', 'EARBUDS', 'HEADPHONES', 'AIRPODS',
      'USING PHONE', 'PLAYING GAMES', 'GAMING', 'UNAUTHORIZED DEVICE',
      'ELECTRONIC DEVICE', 'SMARTPHONE',
    ],
    // Student Manual codes (aliases to existing keyword sets or new sets)
    IMPROPERUNIFORM: null, // alias for DRESSCODE
    IMPROPER_UNIFORM: null,
    PORNOGRAPHICMATERIALS: ['PORNOGRAPH', 'PORN', 'OBSCENE', 'INDECENT MATERIAL', 'EXPLICIT', 'ADULT CONTENT', 'NUDE', 'LEWD MATERIAL'],
    PORNOGRAPHIC_MATERIALS: null,
    LITTERING: ['LITTER', 'LITTERING', 'TRASH', 'GARBAGE', 'UNSANITARY', 'DIRTY', 'FILTHY', 'MESS', 'WASTE'],
    LOITERING: ['LOITER', 'LOITERING', 'WANDERING', 'HANG AROUND', 'ROAMING', 'IDLE', 'AIMLESS'],
    EATINGRESTRICTEDAREAS: ['EATING', 'ATE', 'FOOD', 'SNACK', 'DRINK', 'LIBRARY', 'LABORATORY', 'RESTRICTED AREA', 'EATING IN'],
    EATING_RESTRICTED_AREAS: null,
    UNAUTHORIZEDFACILITYUSE: ['UNAUTHORIZED USE', 'FACILITY', 'WITHOUT PERMISSION', 'RESTRICTED', 'OFF LIMITS', 'NOT ALLOWED'],
    UNAUTHORIZED_FACILITY_USE: null,
    IDLENDINGBORROWING: ['ID LENDING', 'ID BORROWING', 'LEND ID', 'BORROW ID', 'FAKE ID', 'SOMEONE ELSE ID', 'USED ANOTHER ID'],
    ID_LENDING_BORROWING: null,
    TRAFFICVIOLATIONS: ['TRAFFIC', 'DRIVING', 'SPEEDING', 'OVER SPEED', 'LICENSE', 'VEHICLE', 'MUFFLER', 'UNREGISTERED', 'RECKLESS DRIVING'],
    TRAFFIC_VIOLATIONS: null,
    DRUGSALCOHOLWEAPONS: null, // alias for SUBSTANCE
    DRUGS_ALCOHOL_WEAPONS: null,
    DISHONESTYCHEATINGFORGERY: null, // alias for CHEATING
    DISHONESTY_CHEATING_FORGERY: null,
    CREATINGBARRICADES: ['BARRICADE', 'OBSTRUCTION', 'BLOCKED', 'BLOCKING', 'BARRIER', 'BLOCKADE'],
    CREATING_BARRICADES: null,
    ASSAULTVERBALABUSE: null, // alias for FIGHTING
    ASSAULT_VERBAL_ABUSE: null,
    HAZING: ['HAZING', 'HAZED', 'INITIATION', 'INITIATION RITE', 'FRATERNITY HAZING'],
    HARASSMENTSEXUALABUSE: ['SEXUAL HARASSMENT', 'SEXUAL ABUSE', 'LASCIVIOUSNESS', 'INAPPROPRIATE TOUCH', 'SEXUAL ASSAULT', 'MOLESTATION', 'HARASSMENT', 'GROPING'],
    HARASSMENT_SEXUAL_ABUSE: null,
    UNAUTHORIZEDSOFTWAREGADGETS: null, // alias for GADGET
    UNAUTHORIZED_SOFTWARE_GADGETS: null,
    UNRECOGNIZEDFRATERNITYSORORITY: ['FRATERNITY', 'SORORITY', 'UNRECOGNIZED', 'ILLEGAL ORGANIZATION', 'BANNED GROUP', 'SECRET SOCIETY'],
    UNRECOGNIZED_FRATERNITY_SORORITY: null,
    GAMBLING: ['GAMBLING', 'GAMBLE', 'BET', 'BETTING', 'WAGER', 'CARDS', 'DICE', 'POKER'],
    PDAIMMORALACTS: ['PDA', 'PUBLIC DISPLAY', 'AFFECTION', 'INTIMACY', 'KISSING', 'MAKING OUT', 'INDECENT', 'IMMORAL', 'SCANDALOUS'],
    PDA_IMMORAL_ACTS: null,
    OFFENSIVESUBVERSIVEMATERIALS: ['OFFENSIVE MATERIAL', 'SUBVERSIVE', 'PROPAGANDA', 'SEDITIOUS', 'INFLAMMATORY'],
    OFFENSIVE_SUBVERSIVE_MATERIALS: null,
    GRAVETHREATS: ['GRAVE THREAT', 'DEATH THREAT', 'THREAT TO HARM', 'THREATENING', 'MENACING', 'WARN', 'THREATENED TO KILL'],
    GRAVE_THREATS: null,
    INCITINGFIGHTSEDITION: ['INCITE', 'INCITING', 'PROVOKE', 'PROVOKING', 'SEDITION', 'RIOT', 'INSTIGATE', 'INSTIGATION', 'STIR UP'],
    INCITING_FIGHT_SEDITION: null,
    UNAUTHORIZEDACTIVITY: ['UNAUTHORIZED ACTIVITY', 'WITHOUT APPROVAL', 'MISREPRESENTING', 'MISREPRESENT', 'UNAUTHORIZED EVENT', 'UNSANCTIONED'],
    UNAUTHORIZED_ACTIVITY: null,
  };

  // Build alias map: null values inherit from a related key
  const aliasMap = {
    IMPROPERUNIFORM: 'DRESSCODE', IMPROPER_UNIFORM: 'DRESSCODE',
    PORNOGRAPHIC_MATERIALS: 'PORNOGRAPHICMATERIALS',
    EATING_RESTRICTED_AREAS: 'EATINGRESTRICTEDAREAS',
    UNAUTHORIZED_FACILITY_USE: 'UNAUTHORIZEDFACILITYUSE',
    ID_LENDING_BORROWING: 'IDLENDINGBORROWING',
    TRAFFIC_VIOLATIONS: 'TRAFFICVIOLATIONS',
    DRUGSALCOHOLWEAPONS: 'SUBSTANCE', DRUGS_ALCOHOL_WEAPONS: 'SUBSTANCE',
    DISHONESTYCHEATINGFORGERY: 'CHEATING', DISHONESTY_CHEATING_FORGERY: 'CHEATING',
    CREATING_BARRICADES: 'CREATINGBARRICADES',
    ASSAULTVERBALABUSE: 'FIGHTING', ASSAULT_VERBAL_ABUSE: 'FIGHTING',
    HARASSMENT_SEXUAL_ABUSE: 'HARASSMENTSEXUALABUSE',
    UNAUTHORIZEDSOFTWAREGADGETS: 'GADGET', UNAUTHORIZED_SOFTWARE_GADGETS: 'GADGET',
    UNRECOGNIZED_FRATERNITY_SORORITY: 'UNRECOGNIZEDFRATERNITYSORORITY',
    PDA_IMMORAL_ACTS: 'PDAIMMORALACTS',
    OFFENSIVE_SUBVERSIVE_MATERIALS: 'OFFENSIVESUBVERSIVEMATERIALS',
    GRAVE_THREATS: 'GRAVETHREATS',
    INCITING_FIGHT_SEDITION: 'INCITINGFIGHTSEDITION',
    UNAUTHORIZED_ACTIVITY: 'UNAUTHORIZEDACTIVITY',
  };

  function resolveKeywords(key) {
    const direct = violationKeywords[key];
    if (Array.isArray(direct)) return direct;
    const alias = aliasMap[key];
    if (alias) return violationKeywords[alias] || [];
    return [];
  }

  // Check if type name appears in description
  if (descUpper.includes(typeUpper)) {
    return {
      matches: true,
      confidence: 0.85,
      reason: `Description mentions the violation type`,
    };
  }

  // Check for related keywords
  const keywords = resolveKeywords(typeUpper) || resolveKeywords(typeKey) || [];
  const matchedKeywords = keywords.filter((kw) => descUpper.includes(kw.toUpperCase()));

  if (matchedKeywords.length > 0) {
    return {
      matches: true,
      confidence: 0.75,
      reason: `Description contains keywords related to ${violationType}`,
    };
  }

  // No match found
  return {
    matches: false,
    confidence: 0.8,
    reason: `No clear connection found between description and ${violationType} violation type`,
  };
}

module.exports = {
  validateViolationMatch,
  isOllamaAvailable,
};
