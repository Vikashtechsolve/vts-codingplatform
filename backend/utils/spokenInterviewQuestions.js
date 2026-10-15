const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_EVAL_MODEL = process.env.OPENAI_EVAL_MODEL || 'gpt-4.1-mini';

const MAX_QUESTION_WORDS = 70;
const MIN_QUESTION_WORDS = 8;
const MAX_BATCH = 12;

const QUESTION_ROLES = [
  'warm-up: relevant experience or how they think about the domain',
  'core concept: explain an idea from the topic in plain spoken language',
  'applied scenario: a realistic on-the-job situation and what they would do',
  'tradeoffs: compare two approaches and when they would pick each',
  'depth: edge cases, failure, scale, quality, or debugging — verbally',
  'collaboration: working with others, stakeholders, or explaining technical ideas',
  'judgment: prioritization, ethics, or decisions under constraints',
];

const SPOKEN_INTERVIEW_RULES = `This is a LIVE VOICE mock interview. The candidate talks to the interviewer. There is no IDE, compiler, whiteboard for writing programs, calculator, or paper for sums.

You MUST create questions a real interviewer would ask out loud, that can be answered by speaking for 30–90 seconds.

NEVER do any of the following:
- Ask the candidate to write, type, implement, or paste code, SQL, or pseudocode.
- Ask them to compute, calculate, or solve a numeric / aptitude / word-problem (trains, percentages, profit-loss, LCM, exact output of an expression).
- Paste a coding-test problem, MCQ, or exam question (options A/B/C/D, constraints, sample input/output).
- Ask "what is the output of this code" or dump a code snippet.
- Copy or lightly rephrase the interview brief as the question. The brief may contain sample exam items — treat those as THEMES only.
- Ask more than one question at a time.
- Ask a yes/no trivia question with no reasoning.

ALWAYS:
- Ask them to explain, compare, walk through an approach, describe a past example, or reason about a realistic scenario.
- For technical/coding topics: interview like a hiring manager — "How would you approach…", "What tradeoffs…", "How would you debug…", "How would you explain X to a junior?" — not "Write a function that…".
- If the brief mentions calculations, formulas, or coding problems, convert the underlying skill into a spoken question (e.g. profit-loss theme → "How would you sanity-check a pricing model with a teammate?" not "Calculate the profit if…").
- Keep one clear question, 1–3 short sentences, under 60 words.
- Match interview type (HR/behavioral stays behavioral; technical stays conceptual/scenario, still spoken).`;

const normalize = (text = '') => String(text || '').replace(/\s+/g, ' ').trim();

const wordCount = (text = '') => {
  const normalized = normalize(text);
  return normalized ? normalized.split(' ').length : 0;
};

const parseJsonObject = (text = '') => {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (err) {
    return null;
  }
};

const stripQuestionWrapper = (text = '') => {
  let q = normalize(text)
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^(question\s*)?\d+[\).:\-]\s*/i, '')
    .replace(/^q\d+[:.\-]\s*/i, '')
    .replace(/^question\s*:\s*/i, '');
  const parts = q.split(/(?<=\?)\s+/);
  if (parts.length > 1) {
    q = parts[0].trim();
  }
  return q;
};

const looksCopiedFromBrief = (question, brief) => {
  const q = normalize(question).toLowerCase();
  const b = normalize(brief).toLowerCase();
  if (q.length < 32 || b.length < 32) return false;
  if (b.includes(q)) return true;
  const words = q.split(' ');
  if (words.length < 12) return false;
  const windowSize = Math.min(14, words.length);
  for (let i = 0; i <= words.length - windowSize; i += 1) {
    const slice = words.slice(i, i + windowSize).join(' ');
    if (b.includes(slice)) return true;
  }
  return false;
};

const UNSPOKEN_TASK_PATTERNS = [
  /\bwrite (a |an |the )?(complete |full )?(python|java|javascript|typescript|c\+\+|c#|golang|go|rust|sql|program|function|method|class|script|code)\b/i,
  /\bimplement (a |an |the )?(function|method|class|program)\b/i,
  /\b(write|type|paste) (the |your )?(code|program|function|query)\b/i,
  /\bpseudocode\b/i,
  /```/,
  /\bwhat (is|will be|would be) the output\b/i,
  /\btime complexity of (the |this )?(following |below )?(code|snippet|function|program)\b/i,
  /\bopen (your |the )?(ide|editor|compiler|terminal|notebook)\b/i,
  /\bwhiteboard.{0,20}\b(write|code|implement)\b/i,
  /\bchoose the (correct|right) (option|answer)\b/i,
  /\bfind the (numerical |exact )?(value|result) of\b/i,
  /\bevaluate the expression\b/i,
  /\bsolve (this |the )?(equation|sum|aptitude problem)\b/i,
  /\bcalculate the (value|amount|speed|distance|profit|loss|percentage|interest|average|mean|median|output)\b/i,
  /\bcompute the (value|amount|speed|distance|profit|loss|percentage|interest|output)\b/i,
  /\bif [a-z] can (do|complete) (a |the )?work\b/i,
  /\ba train (covers|travels|leaves)\b/i,
  /\bsample (input|output)\b/i,
  /\bconstraints?\s*:/i,
  /^\s*[A-D][\).]/m,
  /\b\d+\s*[\+\-×x*\/÷]\s*\d+\b/,
];

const hasUnspokenInterviewSignals = (text = '') => {
  const value = normalize(text);
  if (!value) return false;
  if (UNSPOKEN_TASK_PATTERNS.some((re) => re.test(value))) return true;

  const aptitudeCue =
    /\b(calculate|compute|find how many|what is the (speed|distance|profit|loss|percentage|interest))\b/i.test(
      value
    );
  const aptitudeUnit =
    /\b(km\/h|kmph|m\/s|rupees?|\brs\b|percent|hours? work|man-days?|profit|loss|lcm|hcf|simple interest|compound interest)\b/i.test(
      value
    );
  if (aptitudeCue && aptitudeUnit) return true;

  const digitCount = (value.match(/\d+/g) || []).length;
  if (digitCount >= 4 && aptitudeCue) return true;
  return false;
};

const looksLikeUnspokenInterviewTask = (question, brief = '') => {
  const text = normalize(question);
  if (!text) return true;

  const words = wordCount(text);
  if (words < MIN_QUESTION_WORDS || words > MAX_QUESTION_WORDS) return true;
  if (looksCopiedFromBrief(text, brief)) return true;
  return hasUnspokenInterviewSignals(text);
};

const questionRoleForIndex = (index) => QUESTION_ROLES[index % QUESTION_ROLES.length];

const buildGenerationPrompt = ({
  interviewType,
  topic,
  difficulty,
  description,
  title,
  previousQuestions,
  count,
}) => {
  const previous = previousQuestions.length
    ? previousQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n')
    : 'None yet';
  const startIndex = previousQuestions.length;
  const roles = Array.from({ length: count }, (_, i) => {
    const n = startIndex + i + 1;
    return `Q${n} role: ${questionRoleForIndex(startIndex + i)}`;
  }).join('\n');
  const brief = normalize(description);

  const difficultyGuide = {
    beginner:
      'Beginner: one idea, everyday language, ask for a simple example from their experience.',
    intermediate:
      'Intermediate: tradeoffs, a realistic work scenario, and why they would choose an approach.',
    advanced:
      'Advanced: failure modes, scale, ambiguity, and how they would decide with incomplete information.',
  }[String(difficulty || 'beginner').toLowerCase()] ||
    'Match the stated difficulty.';

  return `${SPOKEN_INTERVIEW_RULES}

Interview title: ${title || 'Mock Interview'}
Interview type: ${interviewType || 'General'}
Topic: ${topic || 'General'}
Difficulty: ${difficulty || 'beginner'}
${difficultyGuide}

Vendor/admin brief (CONTEXT ONLY — extract skills, role, and themes. Do NOT copy questions, numbers, or problem statements from it):
${brief || '(none — use type and topic)'}

Questions already asked (do not repeat or paraphrase):
${previous}

Create exactly ${count} new spoken interview question(s).
${roles}

Return JSON only:
{
  "questions": ["...", "..."]
}`;
};

const callQuestionModel = async (prompt, temperature = 0.45) => {
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_EVAL_MODEL,
      temperature,
      messages: [
        {
          role: 'system',
          content:
            'You are a senior hiring interviewer designing a live voice mock interview. Return valid JSON only. Never invent coding tests or calculation drills.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const parsed = parseJsonObject(data?.choices?.[0]?.message?.content || '');
  const list = Array.isArray(parsed?.questions) ? parsed.questions : [];
  return list.map((item) => stripQuestionWrapper(item)).filter(Boolean);
};

const generateSpokenInterviewQuestions = async ({
  interviewType,
  topic,
  difficulty,
  description,
  title,
  previousQuestions = [],
  count = 1,
} = {}) => {
  if (!OPENAI_API_KEY) return [];

  const need = Math.max(1, Math.min(Number(count) || 1, MAX_BATCH));
  const accepted = [];
  const known = new Set(previousQuestions.map((q) => normalize(q).toLowerCase()).filter(Boolean));

  const takeValid = (candidates) => {
    candidates.forEach((raw) => {
      if (accepted.length >= need) return;
      const question = stripQuestionWrapper(raw);
      const key = normalize(question).toLowerCase();
      if (!question || known.has(key)) return;
      if (looksLikeUnspokenInterviewTask(question, description)) return;
      known.add(key);
      accepted.push(question);
    });
  };

  const firstPrompt = buildGenerationPrompt({
    interviewType,
    topic,
    difficulty,
    description,
    title,
    previousQuestions,
    count: need,
  });
  takeValid(await callQuestionModel(firstPrompt, 0.45));

  if (accepted.length < need) {
    const retryPrompt = `${buildGenerationPrompt({
      interviewType,
      topic,
      difficulty,
      description,
      title,
      previousQuestions: [...previousQuestions, ...accepted],
      count: need - accepted.length,
    })}

The previous attempt produced invalid items (coding tasks, calculations, copied brief, or too long). Try again. Spoken questions only.`;
    takeValid(await callQuestionModel(retryPrompt, 0.3));
  }

  return accepted;
};

const generateInterviewQuestion = async (params) => {
  const items = await generateSpokenInterviewQuestions({ ...params, count: 1 });
  return items[0] || null;
};

module.exports = {
  SPOKEN_INTERVIEW_RULES,
  looksLikeUnspokenInterviewTask,
  hasUnspokenInterviewSignals,
  stripQuestionWrapper,
  generateSpokenInterviewQuestions,
  generateInterviewQuestion,
};
