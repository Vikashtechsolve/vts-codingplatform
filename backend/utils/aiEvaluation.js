const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const OPENAI_EVAL_MODEL = process.env.OPENAI_EVAL_MODEL || 'gpt-4.1-mini';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeText = (text = '') => text.replace(/\s+/g, ' ').trim();

const wordCount = (text = '') => {
  const normalized = normalizeText(text);
  return normalized ? normalized.split(' ').length : 0;
};

const detectLanguage = (text = '') => {
  const hasNonAscii = /[^\x00-\x7F]/.test(text);
  return hasNonAscii ? 'non_english' : 'english';
};

const dot = (a, b) => a.reduce((sum, val, idx) => sum + val * b[idx], 0);

const magnitude = (a) => Math.sqrt(dot(a, a));

const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  const denom = magnitude(a) * magnitude(b);
  if (denom === 0) return 0;
  return dot(a, b) / denom;
};

const getEmbeddings = async (input) => {
  if (!OPENAI_API_KEY) {
    return null;
  }
  const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding request failed: ${error}`);
  }

  const data = await response.json();
  return data?.data?.[0]?.embedding || null;
};

const parseJsonFromText = (text = '') => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (err) {
    return null;
  }
};

const requestConceptDepthScores = async ({
  questionText,
  referenceAnswer,
  keywords = [],
  rubric = '',
  studentAnswer,
  strictness = 'moderate'
}) => {
  if (!OPENAI_API_KEY) {
    return {
      conceptScore: 0,
      depthScore: 0,
      missingConcepts: [],
      strengths: [],
      feedback: 'AI evaluation is disabled. Configure OPENAI_API_KEY to enable feedback.'
    };
  }

  const prompt = `
You are evaluating a student's descriptive answer for a CS theory question.
Return JSON only with this schema:
{
  "conceptScore": number, // 0-1
  "depthScore": number, // 0-1
  "missingConcepts": string[],
  "strengths": string[],
  "feedback": string
}

Strictness: ${strictness}
Question: ${questionText}
Reference Answer: ${referenceAnswer}
Keywords: ${keywords.join(', ') || 'None'}
Rubric: ${rubric || 'None'}
Student Answer: ${studentAnswer}
`;

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_EVAL_MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You are a moderately strict but helpful evaluator.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Evaluation request failed: ${error}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const parsed = parseJsonFromText(content);
  if (!parsed) {
    return {
      conceptScore: 0,
      depthScore: 0,
      missingConcepts: [],
      strengths: [],
      feedback: 'Unable to parse AI feedback.'
    };
  }
  return {
    conceptScore: clamp(Number(parsed.conceptScore || 0), 0, 1),
    depthScore: clamp(Number(parsed.depthScore || 0), 0, 1),
    missingConcepts: Array.isArray(parsed.missingConcepts) ? parsed.missingConcepts : [],
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    feedback: parsed.feedback || ''
  };
};

const computePenalties = () => ({
  penalty: 0,
  reasons: []
});

const evaluateTheoryAnswer = async ({
  question,
  studentAnswer
}) => {
  const normalizedStudent = normalizeText(studentAnswer);
  const normalizedReference = normalizeText(question.referenceAnswer || '');
  const words = wordCount(normalizedStudent);

  let similarityScore = 0;
  try {
    const [studentEmbedding, referenceEmbedding] = await Promise.all([
      getEmbeddings(normalizedStudent),
      getEmbeddings(normalizedReference)
    ]);
    if (studentEmbedding && referenceEmbedding) {
      similarityScore = clamp(cosineSimilarity(studentEmbedding, referenceEmbedding), 0, 1);
    }
  } catch (error) {
    similarityScore = 0;
  }

  const aiScores = await requestConceptDepthScores({
    questionText: question.questionText,
    referenceAnswer: question.referenceAnswer,
    keywords: question.keywords || [],
    rubric: question.evaluationRubric || '',
    studentAnswer,
    strictness: 'moderate'
  });

  const penalties = computePenalties({
    wordCountValue: words,
    expectedLength: question.expectedAnswerLength,
    similarity: similarityScore,
    missingConcepts: aiScores.missingConcepts,
    normalizedStudent,
    normalizedReference
  });

  const similarityWeight = question.evaluationConfig?.similarityWeight ?? 0.5;
  const conceptWeight = question.evaluationConfig?.conceptWeight ?? 0.3;
  const depthWeight = question.evaluationConfig?.depthWeight ?? 0.2;

  const weightedScore = (similarityWeight * similarityScore) +
    (conceptWeight * aiScores.conceptScore) +
    (depthWeight * aiScores.depthScore);

  const finalScore = clamp(weightedScore, 0, 1);
  const finalMarks = Math.round(finalScore * (question.maxMarks || 10));

  return {
    preprocessing: {
      normalizedLength: words,
      detectedLanguage: detectLanguage(studentAnswer)
    },
    similarityScore,
    conceptScore: aiScores.conceptScore,
    depthScore: aiScores.depthScore,
    penalty: penalties.penalty,
    penaltyReasons: penalties.reasons,
    missingConcepts: aiScores.missingConcepts,
    strengths: aiScores.strengths,
    feedback: aiScores.feedback,
    finalScore,
    finalMarks
  };
};

const evaluateInterviewAnswer = async ({
  questionText,
  interviewType,
  topic,
  difficulty,
  rubrics = [],
  transcript
}) => {
  if (!OPENAI_API_KEY) {
    return {
      overall: 0,
      correctness: 0,
      depth: 0,
      structure: 0,
      confidence: 0,
      relevance: 0,
      strengths: [],
      weaknesses: ['AI evaluation is disabled. Configure OPENAI_API_KEY.'],
      feedback: 'AI evaluation is disabled.',
      resources: []
    };
  }

  const rubricText = rubrics.length
    ? rubrics.map(r => `${r.title}: ${r.description || ''}`).join('\n')
    : 'No rubric provided';

  const prompt = `
You are evaluating a mock interview response.
Return JSON only with this schema:
{
  "overall": number, // 0-100
  "correctness": number,
  "depth": number,
  "structure": number,
  "confidence": number,
  "relevance": number,
  "strengths": string[],
  "weaknesses": string[],
  "feedback": string,
  "resources": string[]
}

Interview Type: ${interviewType || 'General'}
Topic: ${topic || 'General'}
Difficulty: ${difficulty || 'beginner'}
Question: ${questionText}
Rubric:
${rubricText}

Student Transcript:
${transcript}
`;

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_EVAL_MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You are a strict but fair interview evaluator.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Interview evaluation failed: ${error}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const parsed = parseJsonFromText(content);
  if (!parsed) {
    return {
      overall: 0,
      correctness: 0,
      depth: 0,
      structure: 0,
      confidence: 0,
      relevance: 0,
      strengths: [],
      weaknesses: ['Unable to parse AI feedback.'],
      feedback: 'Unable to parse AI feedback.',
      resources: []
    };
  }

  return {
    overall: clamp(Number(parsed.overall || 0), 0, 100),
    correctness: clamp(Number(parsed.correctness || 0), 0, 100),
    depth: clamp(Number(parsed.depth || 0), 0, 100),
    structure: clamp(Number(parsed.structure || 0), 0, 100),
    confidence: clamp(Number(parsed.confidence || 0), 0, 100),
    relevance: clamp(Number(parsed.relevance || 0), 0, 100),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    feedback: parsed.feedback || '',
    resources: Array.isArray(parsed.resources) ? parsed.resources : []
  };
};

const generateFollowUpQuestion = async ({
  questionText,
  transcript,
  interviewType,
  topic,
  difficulty
}) => {
  if (!OPENAI_API_KEY) {
    return null;
  }

  const prompt = `
You are an AI interviewer. Create one concise follow-up question based on the student's answer.
Interview Type: ${interviewType || 'General'}
Topic: ${topic || 'General'}
Difficulty: ${difficulty || 'beginner'}
Original Question: ${questionText}
Student Answer: ${transcript}

Return plain text only.
`;

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_EVAL_MODEL,
      temperature: 0.6,
      messages: [
        { role: 'system', content: 'You are a helpful interviewer.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return (data?.choices?.[0]?.message?.content || '').trim();
};

const generateInterviewQuestion = async ({
  interviewType,
  topic,
  difficulty,
  previousQuestions = []
}) => {
  if (!OPENAI_API_KEY) {
    return null;
  }

  const history = previousQuestions.length
    ? previousQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n')
    : 'None';

  const prompt = `
Create one concise interview question.
Interview Type: ${interviewType || 'General'}
Topic: ${topic || 'General'}
Difficulty: ${difficulty || 'beginner'}
Previous Questions:
${history}

Return plain text only.
`;

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_EVAL_MODEL,
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You are an expert interviewer.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return (data?.choices?.[0]?.message?.content || '').trim();
};

module.exports = {
  evaluateTheoryAnswer,
  evaluateInterviewAnswer,
  generateFollowUpQuestion,
  generateInterviewQuestion
};

