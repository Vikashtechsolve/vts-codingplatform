/**
 * Live interviewer reaction: one fast model call that reads the candidate's answer
 * and decides what the interviewer SAYS next — specific praise, a nudge back on
 * topic, or a probing follow-up — plus a natural bridge into the next question.
 *
 * Scoring is separate (background). This is only about conversation.
 */
const { hasUnspokenInterviewSignals, stripQuestionWrapper } = require('./spokenInterviewQuestions');

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_EVAL_MODEL = process.env.OPENAI_EVAL_MODEL || 'gpt-4.1-mini';

const REACTION_TIMEOUT_MS = 4200;
const VERDICTS = new Set(['strong', 'good', 'partial', 'off_topic', 'empty']);

const normalize = (text = '') => String(text || '').replace(/\s+/g, ' ').trim();

const wordCount = (text = '') => {
  const n = normalize(text);
  if (!n || /^\(no verbal response\)$/i.test(n)) return 0;
  return n.split(' ').length;
};

const parseJson = (text = '') => {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (err) {
    return null;
  }
};

const clampSentences = (text, max = 2, maxWords = 45) => {
  const n = normalize(text);
  if (!n) return '';
  const parts = n.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [n];
  let out = parts.slice(0, max).join(' ').trim();
  const words = out.split(' ');
  if (words.length > maxWords) out = `${words.slice(0, maxWords).join(' ')}.`;
  return out;
};

const TRANSITIONS = [
  "Let's move on.",
  'Okay, next one.',
  "Let's shift gears a little.",
  "Good. I'd like to ask you about something else now.",
  'Alright, moving to the next question.',
  "Let's switch topics.",
];

const pickTransition = (index = 0) => TRANSITIONS[Math.abs(Number(index) || 0) % TRANSITIONS.length];

/** Canned reactions when the model is unavailable or the answer is empty. */
const fallbackReaction = ({ transcript, isFollowUp }) => {
  const words = wordCount(transcript);
  if (words === 0) {
    return {
      verdict: 'empty',
      reaction: "I didn't catch an answer there — no rush, take your time.",
      followUpQuestion: null,
      transition: '',
      fromModel: false,
    };
  }
  if (words < 8) {
    return {
      verdict: 'partial',
      reaction: "Okay. I'd like to hear a bit more on that.",
      followUpQuestion: isFollowUp
        ? null
        : 'Could you walk me through that in more detail, with a concrete example from your experience?',
      transition: '',
      fromModel: false,
    };
  }
  if (words >= 40) {
    return {
      verdict: 'good',
      reaction: 'Thanks, that was a clear walkthrough.',
      followUpQuestion: null,
      transition: pickTransition(words),
      fromModel: false,
    };
  }
  return {
    verdict: 'good',
    reaction: 'Got it, thank you.',
    followUpQuestion: null,
    transition: pickTransition(words),
    fromModel: false,
  };
};

const buildPrompt = ({
  questionText,
  transcript,
  interviewType,
  topic,
  difficulty,
  recentExchanges,
  isFollowUp,
  canFollowUp,
  isLastQuestion,
}) => `
You are the interviewer in a LIVE spoken mock interview. The candidate just finished answering. Write what you say next, exactly as a thoughtful human interviewer would — natural, warm, specific, never robotic.

Interview: ${interviewType || 'General'} · Topic: ${topic || 'General'} · Level: ${difficulty || 'beginner'}
${recentExchanges ? `Earlier in this interview:\n${recentExchanges}\n` : ''}
The question you asked${isFollowUp ? ' (this was a follow-up)' : ''}: "${questionText}"
Candidate's answer (verbatim transcript): """${transcript}"""

Judge the answer honestly:
- "strong": correct, specific, well-structured, with examples or reasoning.
- "good": solid and relevant, minor gaps.
- "partial": relevant but vague, incomplete, missing the key point, or too short.
- "off_topic": does not address the question, answers something else, or is filler/rambling.

Then write:
1. "reaction": 1–2 spoken sentences (max 40 words) reacting to WHAT THEY SAID. Quote or paraphrase a specific term, example, or claim from their answer.
   - strong: name the specific thing that was good.
   - good: appreciate it and briefly note what was clear.
   - partial: acknowledge what they covered and say kindly what was missing.
   - off_topic: gently say that drifted from the question, and in half a sentence remind them what you actually asked.
2. "followUpQuestion": ${canFollowUp
    ? 'If verdict is "partial": one short spoken question (under 30 words) that probes the specific gap in THEIR answer. If verdict is "off_topic": one short redirect that names what they said and points them back to the original question. For strong/good return null.'
    : 'null (no follow-ups are allowed at this point).'}
3. "transition": a short natural bridge sentence (max 10 words) used only when moving to the next question, e.g. "Let's move on to something a bit different." ${isLastQuestion ? 'This was the LAST question — make the transition a brief closing like "That brings us to the end."' : ''} Return "" if a follow-up is asked.

Rules: speak in first person as the interviewer. Do NOT ask the candidate to write code or calculate. Do NOT reveal scores or numbers. Do NOT ask a brand-new unrelated question in "reaction" or "transition".

Return JSON only:
{ "verdict": "strong" | "good" | "partial" | "off_topic", "reaction": string, "followUpQuestion": string | null, "transition": string }
`;

const generateInterviewerReaction = async (params) => {
  const transcript = normalize(params.transcript);
  if (wordCount(transcript) === 0) return fallbackReaction(params);
  if (!OPENAI_API_KEY) return fallbackReaction(params);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REACTION_TIMEOUT_MS);
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_EVAL_MODEL,
        temperature: 0.5,
        max_tokens: 220,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a warm, attentive human interviewer speaking live. React to the candidate\'s exact words. Return valid JSON only.',
          },
          { role: 'user', content: buildPrompt({ ...params, transcript }) },
        ],
      }),
    });
    if (!response.ok) return fallbackReaction(params);

    const data = await response.json();
    const parsed = parseJson(data?.choices?.[0]?.message?.content || '');
    if (!parsed) return fallbackReaction(params);

    const verdict = VERDICTS.has(parsed.verdict) ? parsed.verdict : 'good';
    const reaction = clampSentences(parsed.reaction, 2, 45);
    if (!reaction || hasUnspokenInterviewSignals(reaction)) return fallbackReaction(params);

    let followUpQuestion = null;
    if (params.canFollowUp && (verdict === 'partial' || verdict === 'off_topic') && parsed.followUpQuestion) {
      const q = stripQuestionWrapper(parsed.followUpQuestion);
      if (q && q.split(' ').length <= 40 && !hasUnspokenInterviewSignals(q)) followUpQuestion = q;
    }

    let transition = clampSentences(parsed.transition, 1, 14);
    if (hasUnspokenInterviewSignals(transition)) transition = '';

    return { verdict, reaction, followUpQuestion, transition, fromModel: true };
  } catch (err) {
    return fallbackReaction(params);
  } finally {
    clearTimeout(timer);
  }
};

const closingLine = (reaction) =>
  `${reaction} That brings us to the end of our interview. Thank you for your time today — I'm putting together your feedback now.`.replace(/\s+/g, ' ').trim();

module.exports = {
  generateInterviewerReaction,
  fallbackReaction,
  pickTransition,
  closingLine,
  wordCount,
};
