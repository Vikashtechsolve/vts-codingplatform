const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'nova';
const OPENAI_TTS_SPEED = Number(process.env.OPENAI_TTS_SPEED) || 1.12;
const OPENAI_TTS_INSTRUCTIONS =
  process.env.OPENAI_TTS_INSTRUCTIONS ||
  'You are a professional female job interviewer in a live mock interview. ' +
  'Speak in a calm, warm, natural tone at a clear, confident pace — like a real person asking the next question. ' +
  'Do not drag words or add long pauses. Keep momentum without sounding rushed or robotic.';

const MAX_INPUT_CHARS = 4096;

const synthesizeSpeech = async (text) => {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured for text-to-speech');
  }
  const input = String(text || '').trim();
  if (!input) {
    throw new Error('Text is required for speech synthesis');
  }

  const body = {
    model: OPENAI_TTS_MODEL,
    input: input.slice(0, MAX_INPUT_CHARS),
    voice: OPENAI_TTS_VOICE,
    response_format: 'mp3',
    speed: Math.min(4, Math.max(0.25, OPENAI_TTS_SPEED))
  };

  if (OPENAI_TTS_MODEL === 'gpt-4o-mini-tts') {
    body.instructions = OPENAI_TTS_INSTRUCTIONS;
  }

  const response = await fetch(`${OPENAI_BASE_URL}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TTS request failed: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

module.exports = {
  synthesizeSpeech
};
