const fs = require('fs');
const path = require('path');

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_EVAL_MODEL = process.env.OPENAI_EVAL_MODEL || 'gpt-4.1-mini';

/**
 * Parse JSON from model response; strip markdown code blocks if present
 */
function parseJsonResponse(content) {
  if (typeof content !== 'string') return null;
  let raw = content.trim();
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) raw = codeBlock[1].trim();
  const firstBrace = raw.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let end = -1;
    for (let i = firstBrace; i < raw.length; i++) {
      if (raw[i] === '{') depth++;
      else if (raw[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) raw = raw.slice(firstBrace, end + 1);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('parseJsonResponse failed:', raw?.substring(0, 200), e.message);
    return null;
  }
}

/** Normalize score from API: accept 0-10 or 0-100, return 0-1 */
function normalizeScore(val, defaultVal = 0) {
  if (val == null || Number.isNaN(Number(val))) return defaultVal;
  const n = Number(val);
  if (n > 10) return Math.min(1, Math.max(0, n / 100));
  return Math.min(1, Math.max(0, n / 10));
}

const callOpenAI = async (messages, temperature = 0.3) => {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_EVAL_MODEL,
      messages,
      temperature,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI request failed: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const parsed = parseJsonResponse(content);
  if (!parsed) throw new Error('Invalid or empty JSON from model');
  return parsed;
};

const callWhisper = async (audioBufferOrPath, filenameHint) => {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  let fileBuffer;
  let fileName;
  if (Buffer.isBuffer(audioBufferOrPath)) {
    fileBuffer = audioBufferOrPath;
    fileName = filenameHint || 'audio.webm';
  } else {
    fileBuffer = fs.readFileSync(audioBufferOrPath);
    fileName = path.basename(audioBufferOrPath);
  }

  const ext = path.extname(fileName).toLowerCase();
  const mimeMap = { '.webm': 'audio/webm', '.mp3': 'audio/mpeg', '.mp4': 'audio/mp4', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac' };

  const blob = new Blob([fileBuffer], { type: mimeMap[ext] || 'audio/webm' });
  const form = new FormData();
  form.append('file', blob, fileName);
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');

  const response = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper transcription failed: ${error}`);
  }

  return response.json();
};

/**
 * Evaluate a grammar subjective answer (sentence correction, etc.)
 */
const evaluateGrammarSubjective = async (question, studentAnswer) => {
  try {
    const result = await callOpenAI([
      {
        role: 'system',
        content: `You are an English grammar evaluation expert. Evaluate the student's answer for grammatical correctness. Return JSON only: { "score": 0-10, "isCorrect": boolean, "feedback": "string", "corrections": ["list of corrections if any"] }`
      },
      {
        role: 'user',
        content: `Question: ${question?.questionText || 'N/A'}\nCorrect Answer: ${question?.correctAnswer || 'N/A'}\nStudent Answer: ${studentAnswer || ''}`
      }
    ]);

    const score = result.score ?? result.grammarScore ?? 0;
    return {
      grammarScore: normalizeScore(score),
      isCorrect: result.isCorrect === true || result.isCorrect === 'true',
      detailedFeedback: result.feedback || result.detailedFeedback || '',
      suggestions: Array.isArray(result.corrections) ? result.corrections : (Array.isArray(result.suggestions) ? result.suggestions : [])
    };
  } catch (error) {
    console.error('Grammar evaluation error:', error.message || error);
    return { grammarScore: 0, isCorrect: false, detailedFeedback: 'Evaluation failed', suggestions: [] };
  }
};

/**
 * Evaluate a reading comprehension short answer
 */
const evaluateReadingShortAnswer = async (passage, question, studentAnswer) => {
  try {
    const result = await callOpenAI([
      {
        role: 'system',
        content: `You are an English reading comprehension evaluator. Assess the student's answer based on the passage. Return JSON only: { "relevanceScore": 0-10, "accuracyScore": 0-10, "clarityScore": 0-10, "grammarScore": 0-10, "feedback": "string", "overallScore": 0-10 }`
      },
      {
        role: 'user',
        content: `Passage: ${(passage || '').substring(0, 2000)}\nQuestion: ${question?.questionText || 'N/A'}\nReference Answer: ${question?.referenceAnswer || 'N/A'}\nStudent Answer: ${studentAnswer || ''}`
      }
    ]);

    const overall = result.overallScore ?? result.overall_score ?? 0;
    return {
      relevanceScore: normalizeScore(result.relevanceScore ?? result.relevance_score ?? overall),
      accuracyScore: normalizeScore(result.accuracyScore ?? result.accuracy_score ?? overall),
      clarityScore: normalizeScore(result.clarityScore ?? result.clarity_score ?? overall),
      grammarScore: normalizeScore(result.grammarScore ?? result.grammar_score ?? overall),
      detailedFeedback: result.feedback || result.detailedFeedback || '',
      finalScore: normalizeScore(overall)
    };
  } catch (error) {
    console.error('Reading evaluation error:', error.message || error);
    return { relevanceScore: 0, accuracyScore: 0, clarityScore: 0, grammarScore: 0, detailedFeedback: 'Evaluation failed', finalScore: 0 };
  }
};

/**
 * Evaluate an essay or email/letter writing
 */
const evaluateEssay = async (question, studentAnswer) => {
  try {
    const q = question && typeof question.toObject === 'function' ? question.toObject() : { ...question };
    const raw = typeof studentAnswer === 'string' ? studentAnswer : (studentAnswer?.content ?? studentAnswer?.text ?? (studentAnswer && typeof studentAnswer === 'object' ? JSON.stringify(studentAnswer) : String(studentAnswer || '')));
    const plainText = (raw || '').replace(/<[^>]*>/g, '').trim();
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;

    if (plainText.length < 10) {
      return {
        grammarScore: 0, vocabularyScore: 0, coherenceScore: 0, structureScore: 0, toneScore: 0, relevanceScore: 0,
        detailedFeedback: 'Too little or no content submitted to evaluate.',
        suggestions: ['Provide a complete response that addresses the prompt.'],
        finalScore: 0,
        wordCount
      };
    }

    const writingType = q.writingType || 'essay_general';
    const isEmailLetter = ['email_formal', 'email_informal', 'letter_formal', 'letter_informal', 'report', 'notice'].includes(writingType);

    const systemPrompt = isEmailLetter
      ? `You are an expert English evaluator for emails and letters. Evaluate the student's ${writingType.replace(/_/g, ' ')} on:
- Format: Correct structure (greeting/salutation, subject line if email, body paragraphs, sign-off/closing). Score 0-10.
- Grammar & mechanics: Spelling, punctuation, grammar. Score 0-10.
- Vocabulary: Appropriateness and clarity. Score 0-10.
- Tone: Appropriate for ${writingType} (formal/informal). Score 0-10.
- Coherence: Clear flow and logical structure. Score 0-10.
- Relevance: Addresses the prompt and instructions. Score 0-10.
You MUST return valid JSON only, no other text: { "grammarScore": 0-10, "vocabularyScore": 0-10, "coherenceScore": 0-10, "structureScore": 0-10, "toneScore": 0-10, "relevanceScore": 0-10, "feedback": "detailed feedback string", "suggestions": ["improvement suggestions"], "overallScore": 0-10 }`
      : `You are an expert English writing evaluator. Assess the student's writing on multiple criteria. You MUST return valid JSON only, no other text: { "grammarScore": 0-10, "vocabularyScore": 0-10, "coherenceScore": 0-10, "structureScore": 0-10, "toneScore": 0-10, "relevanceScore": 0-10, "feedback": "detailed feedback string", "suggestions": ["improvement suggestions"], "overallScore": 0-10 }`;

    const formatCheck = isEmailLetter
      ? `\nExpected format / requirements: ${q.expectedFormat || 'standard email/letter format (greeting, body, sign-off)'}.\nEvaluate format compliance: subject line (for email), greeting, body structure, closing/sign-off.`
      : '';

    const wordLimit = q.wordLimit || {};
    const minW = wordLimit.min != null ? wordLimit.min : 0;
    const maxW = wordLimit.max != null ? wordLimit.max : 500;

    const result = await callOpenAI([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Writing Type: ${writingType}\nPrompt: ${q.prompt || 'N/A'}\nInstructions: ${q.instructions || 'None'}\nWord Limit: ${minW}-${maxW}\nActual Words: ${wordCount}${formatCheck}\nSample Response: ${q.sampleResponse ? String(q.sampleResponse).substring(0, 1000) : 'Not provided'}\n\nStudent's Writing:\n${plainText}`
      }
    ]);

    const overall = result.overallScore != null ? result.overallScore : (result.overall_score != null ? result.overall_score : 0);
    const feedback = result.feedback || result.detailedFeedback || '';

    return {
      grammarScore: normalizeScore(result.grammarScore ?? result.grammar_score ?? overall),
      vocabularyScore: normalizeScore(result.vocabularyScore ?? result.vocabulary_score ?? overall),
      coherenceScore: normalizeScore(result.coherenceScore ?? result.coherence_score ?? overall),
      structureScore: normalizeScore(result.structureScore ?? result.structure_score ?? overall),
      toneScore: normalizeScore(result.toneScore ?? result.tone_score ?? overall),
      relevanceScore: normalizeScore(result.relevanceScore ?? result.relevance_score ?? overall),
      detailedFeedback: typeof feedback === 'string' ? feedback : (feedback?.text || JSON.stringify(feedback)),
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : (Array.isArray(result.corrections) ? result.corrections : []),
      finalScore: normalizeScore(overall),
      wordCount
    };
  } catch (error) {
    console.error('Essay evaluation error:', error.message || error);
    return { grammarScore: 0, vocabularyScore: 0, coherenceScore: 0, structureScore: 0, toneScore: 0, relevanceScore: 0, detailedFeedback: 'Evaluation failed: ' + (error.message || 'Unknown error'), suggestions: [], finalScore: 0, wordCount: 0 };
  }
};

/**
 * Evaluate a speaking response using Whisper + GPT
 */
const evaluateSpeaking = async (audioFilePathOrUrl, question) => {
  try {
    let whisperResult;
    const isUrl = audioFilePathOrUrl.startsWith('http://') || audioFilePathOrUrl.startsWith('https://');
    if (isUrl) {
      const { downloadFromR2, getKeyFromUrl } = require('./r2Storage');
      const key = getKeyFromUrl(audioFilePathOrUrl);
      const buffer = await downloadFromR2(key);
      const filename = path.basename(key);
      whisperResult = await callWhisper(buffer, filename);
    } else {
      const absolutePath = path.resolve(audioFilePathOrUrl);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Audio file not found: ${absolutePath}`);
      }
      whisperResult = await callWhisper(absolutePath);
    }
    const transcription = whisperResult.text || '';
    const duration = whisperResult.duration || 0;
    const words = whisperResult.words || [];

    const wordCount = transcription.split(/\s+/).filter(Boolean).length;
    const speakingRate = duration > 0 ? Math.round((wordCount / duration) * 60) : 0;

    let pauseCount = 0;
    let totalPauseDuration = 0;
    for (let i = 1; i < words.length; i++) {
      const gap = (words[i].start || 0) - (words[i - 1].end || 0);
      if (gap > 0.5) {
        pauseCount++;
        totalPauseDuration += gap;
      }
    }

    const fillerWords = (transcription.match(/\b(um|uh|like|you know|basically|actually|so|well)\b/gi) || []).length;
    const uniqueWords = new Set(transcription.toLowerCase().split(/\s+/).filter(Boolean));
    const vocabularyDiversity = wordCount > 0 ? Math.round((uniqueWords.size / wordCount) * 100) / 100 : 0;

    const isReadAloud = question.speakingType === 'read_aloud';
    const referenceNote = isReadAloud ? `\nReference Text: ${question.referenceText}\nCompare pronunciation accuracy against the reference.` : '';

    const result = await callOpenAI([
      {
        role: 'system',
        content: `You are a speaking assessment expert. Evaluate the transcribed speech. Return JSON only: { "pronunciationScore": 0-10, "fluencyScore": 0-10, "coherenceScore": 0-10, "vocabularyScore": 0-10, "grammarScore": 0-10, "confidenceScore": 0-10, "feedback": "string", "overallScore": 0-10 }`
      },
      {
        role: 'user',
        content: `Speaking Type: ${question?.speakingType || 'N/A'}\nPrompt: ${question?.prompt || 'N/A'}${referenceNote}\nTranscription: ${transcription}\nSpeaking Rate: ${speakingRate} wpm\nPauses: ${pauseCount}\nFiller Words: ${fillerWords}\nDuration: ${Math.round(duration)}s`
      }
    ]);

    const overall = result.overallScore ?? result.overall_score ?? 0;
    return {
      transcription,
      pronunciationScore: normalizeScore(result.pronunciationScore ?? result.pronunciation_score ?? overall),
      fluencyScore: normalizeScore(result.fluencyScore ?? result.fluency_score ?? overall),
      coherenceScore: normalizeScore(result.coherenceScore ?? result.coherence_score ?? overall),
      vocabularyScore: normalizeScore(result.vocabularyScore ?? result.vocabulary_score ?? overall),
      grammarScore: normalizeScore(result.grammarScore ?? result.grammar_score ?? overall),
      confidenceScore: normalizeScore(result.confidenceScore ?? result.confidence_score ?? overall),
      speakingRate,
      pauseAnalysis: { totalPauses: pauseCount, avgPauseDuration: pauseCount > 0 ? Math.round((totalPauseDuration / pauseCount) * 100) / 100 : 0 },
      fillerWords,
      vocabularyDiversity,
      accentClarity: normalizeScore(result.pronunciationScore ?? result.pronunciation_score ?? overall),
      detailedFeedback: result.feedback || result.detailedFeedback || '',
      finalScore: normalizeScore(overall)
    };
  } catch (error) {
    console.error('Speaking evaluation error:', error.message || error);
    return {
      transcription: '', pronunciationScore: 0, fluencyScore: 0, coherenceScore: 0, vocabularyScore: 0, grammarScore: 0,
      confidenceScore: 0, speakingRate: 0, pauseAnalysis: { totalPauses: 0, avgPauseDuration: 0 },
      fillerWords: 0, vocabularyDiversity: 0, accentClarity: 0, detailedFeedback: 'Evaluation failed: ' + error.message, finalScore: 0
    };
  }
};

/**
 * Evaluate a listening short answer
 */
const evaluateListeningShortAnswer = async (audioTranscript, question, studentAnswer) => {
  try {
    const result = await callOpenAI([
      {
        role: 'system',
        content: `You are a listening comprehension evaluator. Based on the audio transcript, assess the student's answer. Return JSON only: { "score": 0-10, "feedback": "string" }`
      },
      {
        role: 'user',
        content: `Audio Transcript: ${(audioTranscript || '').substring(0, 2000)}\nQuestion: ${question?.questionText || 'N/A'}\nExpected Answer: ${question?.correctAnswer || 'N/A'}\nStudent Answer: ${studentAnswer || ''}`
      }
    ]);

    const score = result.score ?? result.overallScore ?? result.overall_score ?? 0;
    return {
      finalScore: normalizeScore(score),
      detailedFeedback: result.feedback || result.detailedFeedback || ''
    };
  } catch (error) {
    console.error('Listening evaluation error:', error.message || error);
    return { finalScore: 0, detailedFeedback: 'Evaluation failed' };
  }
};

/**
 * Generate text embedding via OpenAI embeddings API
 */
const generateEmbedding = async (text) => {
  if (!OPENAI_API_KEY || !text) return null;
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000)
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch { return null; }
};

const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
};

/**
 * Check for plagiarism by:
 * 1. AI content originality assessment
 * 2. Cross-submission similarity using embeddings
 */
const checkPlagiarism = async (studentText, otherSubmissions = []) => {
  try {
    const plainText = studentText.replace(/<[^>]*>/g, '');

    const aiCheck = await callOpenAI([
      {
        role: 'system',
        content: `You are a plagiarism and originality checker. Analyze the writing and determine if it appears to be original student work or potentially copied/AI-generated. Return JSON: { "originalityScore": 0-100, "isLikelyOriginal": boolean, "suspicionLevel": "none"|"low"|"medium"|"high", "indicators": ["list of reasons for concern if any"], "feedback": "brief assessment" }`
      },
      {
        role: 'user',
        content: `Analyze this student's writing for originality:\n\n${plainText.substring(0, 3000)}`
      }
    ]);

    let crossSubmissionSimilarity = 0;
    let mostSimilarScore = 0;

    if (otherSubmissions.length > 0) {
      const studentEmbedding = await generateEmbedding(plainText);
      if (studentEmbedding) {
        for (const other of otherSubmissions) {
          const otherPlain = (other || '').replace(/<[^>]*>/g, '');
          if (!otherPlain || otherPlain.length < 50) continue;
          const otherEmbedding = await generateEmbedding(otherPlain);
          if (otherEmbedding) {
            const sim = cosineSimilarity(studentEmbedding, otherEmbedding);
            if (sim > mostSimilarScore) mostSimilarScore = sim;
          }
        }
        crossSubmissionSimilarity = Math.round(mostSimilarScore * 100);
      }
    }

    return {
      originalityScore: aiCheck.originalityScore || 0,
      isLikelyOriginal: aiCheck.isLikelyOriginal !== false,
      suspicionLevel: aiCheck.suspicionLevel || 'none',
      indicators: aiCheck.indicators || [],
      feedback: aiCheck.feedback || '',
      crossSubmissionSimilarity,
      mostSimilarScore: Math.round(mostSimilarScore * 100)
    };
  } catch (error) {
    console.error('Plagiarism check error:', error);
    return {
      originalityScore: 0,
      isLikelyOriginal: true,
      suspicionLevel: 'none',
      indicators: [],
      feedback: 'Plagiarism check failed',
      crossSubmissionSimilarity: 0,
      mostSimilarScore: 0
    };
  }
};

module.exports = {
  evaluateGrammarSubjective,
  evaluateReadingShortAnswer,
  evaluateEssay,
  evaluateSpeaking,
  evaluateListeningShortAnswer,
  checkPlagiarism
};
