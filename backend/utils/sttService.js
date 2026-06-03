const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_STT_MODEL = process.env.OPENAI_STT_MODEL || 'whisper-1';
const OPENAI_STT_LANGUAGE = process.env.OPENAI_STT_LANGUAGE || 'en';

const transcribeAudio = async (audioBuffer, mimeType = 'audio/webm', options = {}) => {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured for speech-to-text');
  }
  if (!audioBuffer) {
    throw new Error('Audio buffer is required');
  }

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  formData.append('file', blob, `answer.${mimeType.split('/')[1] || 'webm'}`);
  formData.append('model', OPENAI_STT_MODEL);
  formData.append('response_format', 'json');
  const language = options.language || OPENAI_STT_LANGUAGE;
  if (language) {
    formData.append('language', language);
  }
  const prompt = String(options.prompt || '').trim();
  if (prompt) {
    formData.append('prompt', prompt.slice(0, 500));
  }

  const response = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`STT request failed: ${error}`);
  }

  const data = await response.json();
  return data?.text || '';
};

module.exports = {
  transcribeAudio
};
