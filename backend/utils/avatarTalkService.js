/**
 * Optional D-ID talking-head video from TTS audio (requires DID_API_KEY + public R2 URLs).
 */
const { uploadToR2 } = require('./r2Storage');

const DID_API_KEY = process.env.DID_API_KEY || '';
const INTERVIEWER_IMAGE_URL =
  process.env.INTERVIEWER_AVATAR_IMAGE_URL ||
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=800&q=90';
const DID_POLL_MS = 2000;
const DID_MAX_POLLS = 45;

const authHeader = () => {
  const token = Buffer.from(`${DID_API_KEY}:`).toString('base64');
  return { Authorization: `Basic ${token}` };
};

const pollTalk = async (talkId) => {
  for (let i = 0; i < DID_MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, DID_POLL_MS));
    const res = await fetch(`https://api.d-id.com/talks/${talkId}`, {
      headers: { ...authHeader(), Accept: 'application/json' }
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`D-ID poll failed: ${err}`);
    }
    const data = await res.json();
    if (data.status === 'done' && data.result_url) {
      const videoRes = await fetch(data.result_url);
      if (!videoRes.ok) throw new Error('Failed to download talking-head video');
      return Buffer.from(await videoRes.arrayBuffer());
    }
    if (data.status === 'error') {
      throw new Error(data.description || 'D-ID talk failed');
    }
  }
  throw new Error('D-ID talk timed out');
};

/**
 * @returns {Promise<Buffer|null>} MP4 buffer or null if unavailable
 */
const createTalkingHeadVideo = async (audioBuffer, sessionId) => {
  if (!DID_API_KEY) return null;
  if (!process.env.R2_PUBLIC_URL) {
    console.warn('D-ID skipped: R2_PUBLIC_URL required for public audio URL');
    return null;
  }

  const key = `interview-tts/${sessionId}/${Date.now()}.mp3`;
  const audioUrl = await uploadToR2(audioBuffer, key, 'speech.mp3');

  const createRes = await fetch('https://api.d-id.com/talks', {
    method: 'POST',
    headers: {
      ...authHeader(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_url: INTERVIEWER_IMAGE_URL,
      script: { type: 'audio', audio_url: audioUrl },
      config: { stitch: true, result_format: 'mp4' }
    })
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`D-ID create failed: ${err}`);
  }

  const { id } = await createRes.json();
  if (!id) throw new Error('D-ID did not return talk id');
  return pollTalk(id);
};

module.exports = {
  createTalkingHeadVideo,
  isTalkingHeadEnabled: () => Boolean(DID_API_KEY)
};
