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
      resources: [],
      needsFollowUp: true,
      acknowledgment: 'Thanks for your answer.',
      probeTopic: 'more detail',
      answerSummary: ''
    };
  }

  const rubricText = rubrics.length
    ? rubrics.map(r => `${r.title}: ${r.description || ''}`).join('\n')
    : 'No rubric provided';

  const prompt = `
You are evaluating a mock interview response. Read the student transcript word-by-word.
Return JSON only with this schema:
{
  "overall": number,
  "correctness": number,
  "depth": number,
  "structure": number,
  "confidence": number,
  "relevance": number,
  "strengths": string[],
  "weaknesses": string[],
  "feedback": string,
  "resources": string[],
  "needsFollowUp": boolean,
  "acknowledgment": string,
  "probeTopic": string,
  "answerSummary": string
}

needsFollowUp: true if the answer is missing examples, lacks depth, is vague, off-topic, too short, OR leaves claims unexplored. Only false if the answer thoroughly answers the question with specific examples.
acknowledgment: one short spoken sentence reacting to something SPECIFIC they said (quote or paraphrase their content).
probeTopic: what to dig into next based on their actual words (for a follow-up question).
answerSummary: one sentence summary of what they said.

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
      temperature: 0.25,
      messages: [
        { role: 'system', content: 'You evaluate interview answers and decide if a human interviewer should ask a follow-up. Return valid JSON only.' },
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
      resources: [],
      needsFollowUp: true,
      acknowledgment: 'Thanks for sharing that.',
      probeTopic: 'a specific example',
      answerSummary: ''
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
    resources: Array.isArray(parsed.resources) ? parsed.resources : [],
    needsFollowUp: Boolean(parsed.needsFollowUp),
    acknowledgment: String(parsed.acknowledgment || '').trim(),
    probeTopic: String(parsed.probeTopic || '').trim(),
    answerSummary: String(parsed.answerSummary || '').trim()
  };
};

const isExceptionalAnswer = (evaluation, transcript) => {
  const words = wordCount(transcript || '');
  const normalized = normalizeText(transcript || '');
  if (!normalized || normalized === '(No verbal response)') return false;
  return (
    (evaluation?.overall ?? 0) >= 92
    && (evaluation?.depth ?? 0) >= 88
    && (evaluation?.relevance ?? 0) >= 88
    && words >= 45
    && (evaluation?.weaknesses?.length || 0) === 0
  );
};

const shouldAskFollowUp = ({
  evaluation,
  transcript,
  isFollowUpQuestion,
  allowFollowUp,
  followUpsRemaining
}) => {
  if (!allowFollowUp || followUpsRemaining <= 0 || isFollowUpQuestion) {
    return false;
  }

  const normalized = normalizeText(transcript || '');
  if (!normalized || normalized === '(no verbal response)' || normalized === '(No verbal response)') {
    return true;
  }

  if (isExceptionalAnswer(evaluation, transcript)) {
    return false;
  }

  if (evaluation?.needsFollowUp === true) {
    return true;
  }

  const words = wordCount(transcript);
  if (words < 30) return true;
  if ((evaluation?.overall ?? 0) < 90) return true;
  if ((evaluation?.depth ?? 0) < 82) return true;
  if ((evaluation?.relevance ?? 0) < 80) return true;
  if ((evaluation?.weaknesses?.length || 0) >= 1) return true;

  return true;
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
You are a warm, professional interviewer. Create one concise follow-up question based on the student's answer.
Probe unclear points, missing detail, or interesting claims — sound conversational, not robotic.
Interview Type: ${interviewType || 'General'}
Topic: ${topic || 'General'}
Difficulty: ${difficulty || 'beginner'}
Original Question: ${questionText}
Student Answer: ${transcript}

Return plain text only (the question itself, no preamble).
`;

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_EVAL_MODEL,
      temperature: 0.65,
      messages: [
        { role: 'system', content: 'You are an engaging human interviewer.' },
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

const pickAcknowledgment = (evaluation) => {
  if (evaluation?.acknowledgment) return evaluation.acknowledgment;
  const overall = evaluation?.overall ?? 0;
  if (overall >= 82) return 'Excellent — that was a really solid answer.';
  if (overall >= 68) return 'Great, thanks for walking me through that.';
  return 'Thanks, I appreciate you sharing that.';
};

const generateInteractiveFollowUp = async ({
  questionText,
  transcript,
  evaluation,
  interviewType,
  topic,
  difficulty,
  recentExchanges = ''
}) => {
  const acknowledgment = pickAcknowledgment(evaluation);
  const probeTopic = evaluation?.probeTopic || 'more specific detail from your answer';
  const fallbackQuestion = `You mentioned something interesting in your answer — could you go deeper on ${probeTopic}, with a concrete example?`;
  const fallback = {
    acknowledgment,
    shouldFollowUp: true,
    followUpQuestion: fallbackQuestion,
    spokenText: `${acknowledgment} ${fallbackQuestion}`,
    displayQuestionText: fallbackQuestion,
    isFollowUp: true
  };

  if (!OPENAI_API_KEY) {
    return fallback;
  }

  const prompt = `
You are a live human interviewer. The student JUST answered — your follow-up MUST be based on their exact words.

Original question: ${questionText}
Student answer (transcript): """${transcript}"""
What they said (summary): ${evaluation?.answerSummary || 'see transcript'}
What to probe next: ${probeTopic}
Weaknesses noted: ${(evaluation?.weaknesses || []).join('; ') || 'none'}
Strengths noted: ${(evaluation?.strengths || []).join('; ') || 'none'}

${recentExchanges ? `Earlier in this interview:\n${recentExchanges}\n` : ''}

Write:
1. acknowledgment — one warm sentence that references something SPECIFIC from their answer (mention a term, project, tool, or claim they used).
2. followUpQuestion — one clear follow-up that digs into their answer (challenge, clarify, or ask for an example). Do NOT ask a generic unrelated question.
3. spokenText — what you say aloud: acknowledgment + brief bridge ("Let me dig into that a bit," etc.) + followUpQuestion. Max 75 words.
4. displayQuestionText — only the follow-up question for on-screen UI.

Return JSON only:
{
  "acknowledgment": string,
  "followUpQuestion": string,
  "spokenText": string,
  "displayQuestionText": string
}
`;

  try {
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
          { role: 'system', content: 'You are an attentive interviewer. Follow-ups must reference the candidate\'s actual answer. Return valid JSON only.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();
    const parsed = parseJsonFromText(data?.choices?.[0]?.message?.content || '');
    if (!parsed?.followUpQuestion) {
      return fallback;
    }

    const ack = String(parsed.acknowledgment || acknowledgment).trim();
    const followUpQuestion = String(parsed.followUpQuestion).trim();
    const spokenText = String(parsed.spokenText || `${ack} ${followUpQuestion}`).trim();

    return {
      acknowledgment: ack,
      shouldFollowUp: true,
      followUpQuestion,
      spokenText,
      displayQuestionText: String(parsed.displayQuestionText || followUpQuestion).trim(),
      isFollowUp: true
    };
  } catch (err) {
    return fallback;
  }
};

const buildNextMainQuestionTurn = async ({
  evaluation,
  questionText,
  transcript,
  nextQueuedQuestionText,
  interviewType,
  topic,
  difficulty
}) => {
  const acknowledgment = pickAcknowledgment(evaluation);
  const fallback = {
    acknowledgment,
    shouldFollowUp: false,
    followUpQuestion: null,
    spokenText: `${acknowledgment} Alright, let's move on to the next question. ${nextQueuedQuestionText}`,
    displayQuestionText: nextQueuedQuestionText,
    isFollowUp: false
  };

  if (!OPENAI_API_KEY || !nextQueuedQuestionText) {
    return fallback;
  }

  const prompt = `
You are a live interviewer. The student answered the previous question; now transition to the NEXT main question.

Previous question: ${questionText}
Student answer: """${transcript}"""
Next question to ask: ${nextQueuedQuestionText}
Topic: ${topic}, Type: ${interviewType}, Level: ${difficulty}

Return JSON only:
{
  "acknowledgment": string,
  "spokenText": string,
  "displayQuestionText": string
}

acknowledgment: one sentence reacting to something specific from their answer.
spokenText: acknowledgment + natural transition + next question (max 80 words).
displayQuestionText: only the next question text.
`;

  try {
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
          { role: 'system', content: 'You are a warm professional interviewer. Return valid JSON only.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();
    const parsed = parseJsonFromText(data?.choices?.[0]?.message?.content || '');
    if (!parsed) {
      return fallback;
    }

    return {
      acknowledgment: String(parsed.acknowledgment || acknowledgment).trim(),
      shouldFollowUp: false,
      followUpQuestion: null,
      spokenText: String(parsed.spokenText || fallback.spokenText).trim(),
      displayQuestionText: String(parsed.displayQuestionText || nextQueuedQuestionText).trim(),
      isFollowUp: false
    };
  } catch (err) {
    return fallback;
  }
};

const resolveInterviewerTurn = async ({
  evaluation,
  questionText,
  transcript,
  interviewType,
  topic,
  difficulty,
  nextQueuedQuestionText,
  followUpsRemaining,
  allowFollowUp,
  isFollowUpQuestion,
  recentExchanges = ''
}) => {
  const wantsFollowUp = shouldAskFollowUp({
    evaluation,
    transcript,
    isFollowUpQuestion,
    allowFollowUp,
    followUpsRemaining
  });

  if (wantsFollowUp) {
    return generateInteractiveFollowUp({
      questionText,
      transcript,
      evaluation,
      interviewType,
      topic,
      difficulty,
      recentExchanges
    });
  }

  if (nextQueuedQuestionText) {
    return buildNextMainQuestionTurn({
      evaluation,
      questionText,
      transcript,
      nextQueuedQuestionText,
      interviewType,
      topic,
      difficulty
    });
  }

  return null;
};

const planInterviewerTurn = resolveInterviewerTurn;

const generateInterviewOpener = async ({
  interviewTitle,
  interviewType,
  topic,
  difficulty,
  firstQuestionText
}) => {
  const question = String(firstQuestionText || '').trim();
  const fallback = {
    acknowledgment: '',
    spokenText: `Hi, welcome to your mock interview${interviewTitle ? ` for ${interviewTitle}` : ''}. I'll ask you a series of questions — answer naturally, and take your time. Let's begin. ${question}`,
    displayQuestionText: question,
    isFollowUp: false
  };

  if (!OPENAI_API_KEY || !question) {
    return fallback;
  }

  const prompt = `
You are starting a live mock interview. Greet the candidate warmly in 2-3 short sentences, then ask the first question naturally.
Interview: ${interviewTitle || interviewType || 'Mock Interview'}
Type: ${interviewType || 'General'}, Topic: ${topic || 'General'}, Level: ${difficulty || 'beginner'}
First question to ask: ${question}

Return JSON only:
{
  "spokenText": string,
  "displayQuestionText": string
}

spokenText must include a friendly greeting AND the first question. displayQuestionText is only the question for on-screen display.
`;

  try {
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
          { role: 'system', content: 'You are a friendly professional interviewer. Return valid JSON only.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      return fallback;
    }
    const data = await response.json();
    const parsed = parseJsonFromText(data?.choices?.[0]?.message?.content || '');
    if (!parsed?.spokenText) {
      return fallback;
    }
    return {
      acknowledgment: '',
      spokenText: String(parsed.spokenText).trim(),
      displayQuestionText: String(parsed.displayQuestionText || question).trim(),
      isFollowUp: false
    };
  } catch (err) {
    return fallback;
  }
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

const generateInterviewFinalReport = async (session) => {
  const answers = session.answers || [];
  const fallback = () => {
    const strengths = answers.flatMap((a) => a.evaluation?.strengths || []).slice(0, 5);
    const improvements = answers.flatMap((a) => a.evaluation?.weaknesses || []).slice(0, 5);
    const overallScore = answers.length
      ? Math.round(answers.reduce((s, a) => s + (a.evaluation?.overall || 0), 0) / answers.length)
      : 0;
    return {
      overallScore,
      readinessPercent: overallScore,
      strengths: strengths.length ? strengths : ['Completed the full interview session.'],
      improvements: improvements.length ? improvements : ['Review question feedback for targeted practice.'],
      summary:
        answers[answers.length - 1]?.evaluation?.feedback ||
        'Your interview session has been recorded. Review each answer for detailed feedback.',
      readinessLabel: overallScore >= 70 ? 'Interview ready' : overallScore >= 50 ? 'Almost ready' : 'Needs practice',
      focusAreas: improvements.slice(0, 3)
    };
  };

  if (!OPENAI_API_KEY || !answers.length) {
    return fallback();
  }

  const answerDigest = answers
    .map((a, i) => {
      const e = a.evaluation || {};
      return `Q${i + 1}: ${a.questionText}
Transcript: ${(a.transcript || '').slice(0, 800)}
Scores — overall:${e.overall ?? 0} correctness:${e.correctness ?? 0} depth:${e.depth ?? 0} structure:${e.structure ?? 0} confidence:${e.confidence ?? 0} relevance:${e.relevance ?? 0}
Strengths: ${(e.strengths || []).join('; ')}
Weaknesses: ${(e.weaknesses || []).join('; ')}
Feedback: ${e.feedback || ''}`;
    })
    .join('\n\n');

  const prompt = `You are a senior interview coach writing a final report after a mock interview.
Interview: ${session.interviewType || 'General'} | Topic: ${session.topic || 'General'} | Difficulty: ${session.difficulty || 'beginner'}
Time spent (seconds): ${session.timeSpent || 0}

Per-question data:
${answerDigest}

Return JSON only:
{
  "overallScore": number,
  "readinessPercent": number,
  "readinessLabel": string,
  "strengths": string[],
  "improvements": string[],
  "summary": string,
  "focusAreas": string[]
}

overallScore and readinessPercent: 0-100 weighted average reflecting interview performance.
strengths/improvements: 4-5 each, specific and actionable.
summary: 3-4 sentences executive summary for the candidate.
focusAreas: top 3 topics to practice next.`;

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_EVAL_MODEL,
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You write clear interview performance reports. Return valid JSON only.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      return fallback();
    }

    const data = await response.json();
    const parsed = parseJsonFromText(data?.choices?.[0]?.message?.content || '');
    if (!parsed) {
      return fallback();
    }

    const overallScore = clamp(Math.round(Number(parsed.overallScore) || 0), 0, 100);
    return {
      overallScore,
      readinessPercent: clamp(Math.round(Number(parsed.readinessPercent) || overallScore), 0, 100),
      readinessLabel: String(parsed.readinessLabel || '').slice(0, 80) || fallback().readinessLabel,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 6) : fallback().strengths,
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 6) : fallback().improvements,
      summary: String(parsed.summary || '').trim() || fallback().summary,
      focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.slice(0, 5) : fallback().focusAreas
    };
  } catch (e) {
    return fallback();
  }
};

module.exports = {
  evaluateTheoryAnswer,
  evaluateInterviewAnswer,
  generateFollowUpQuestion,
  generateInterviewQuestion,
  planInterviewerTurn,
  resolveInterviewerTurn,
  generateInterviewOpener,
  generateInterviewFinalReport
};

