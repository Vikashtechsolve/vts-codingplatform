const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const DEFAULT_MODEL = process.env.OPENAI_EVAL_MODEL || 'gpt-4.1-mini';

const SECTION_PROMPTS = {
  requirements: {
    name: 'Requirements Clarification',
    rubric: `Evaluate the student's requirements analysis:
- Functional Requirements: Are they complete, relevant to the problem, and well-articulated? Do they cover the core functionality?
- Non-Functional Requirements: Are scalability, availability, consistency, and latency properly addressed? Are the targets realistic for the given constraints?
- Missing any critical requirements that the reference answer covers?
Score 0-10 where 10 = comprehensive, accurate, well-structured requirements.`
  },
  capacityEstimation: {
    name: 'Capacity Estimation',
    rubric: `Evaluate the student's back-of-envelope calculations:
- Are the QPS estimates within a reasonable order of magnitude?
- Is the read/write ratio reasonable for this type of system?
- Are storage, bandwidth, and memory estimates calculated correctly?
- Did they show their work/reasoning?
- Are the numbers internally consistent?
Score 0-10 where 10 = accurate calculations with clear reasoning.`
  },
  coreEntities: {
    name: 'Core Entities / Data Model',
    rubric: `Evaluate the entity/data model design:
- Are all critical entities identified?
- Are fields appropriate and complete for each entity?
- Are relationships between entities identified?
- Any missing entities that would be needed for the system?
- Are data types reasonable?
Score 0-10 where 10 = complete, well-structured entity model.`
  },
  apiDesign: {
    name: 'API / Interface Design',
    rubric: `Evaluate the API design:
- Do endpoints follow RESTful conventions?
- Is endpoint coverage complete for the core functionality?
- Are request/response bodies well-defined?
- Are HTTP methods used correctly?
- Any missing critical endpoints?
- Authentication considerations addressed?
Score 0-10 where 10 = professional, complete API design.`
  },
  architecture: {
    name: 'High-Level Architecture',
    rubric: `Evaluate the system architecture from the component list and explanation:
- Are all necessary components present (servers, databases, caches, queues, etc.)?
- Are components connected logically?
- Are there single points of failure?
- Is the architecture appropriate for the scale described in constraints?
- Does the text explanation justify the architectural choices?
- Is there proper separation of concerns?
Score 0-10 where 10 = robust, scalable, well-justified architecture.`
  },
  dataFlow: {
    name: 'Data Flow',
    rubric: `Evaluate the data flow descriptions:
- Are the flows logically correct?
- Do they cover the happy path completely?
- Are edge cases or error scenarios considered?
- Is each step clear and specific (not vague)?
- Do the flows align with the architecture described?
Score 0-10 where 10 = clear, complete, logically sound data flows.`
  },
  databaseDesign: {
    name: 'Database Design',
    rubric: `Evaluate the database design choices:
- Is the database type appropriate for each entity's access pattern?
- Are indexing strategies well-thought-out?
- Is partitioning/sharding strategy appropriate for the scale?
- Is replication strategy aligned with availability requirements?
- Are justifications sound and demonstrate understanding of tradeoffs?
Score 0-10 where 10 = expert-level database design with solid justifications.`
  },
  scalingStrategy: {
    name: 'Scaling Strategy',
    rubric: `Evaluate the scaling approach:
- Are the selected strategies appropriate for this system?
- Are explanations detailed and technically accurate?
- Do they address the specific bottlenecks this system would face?
- Is there awareness of the tradeoffs of each strategy?
- Any critical scaling strategies missing?
Score 0-10 where 10 = comprehensive scaling plan with deep understanding.`
  },
  deepDive: {
    name: 'Deep Dive',
    rubric: `Evaluate the deep dive section:
- Is the chosen topic explored with sufficient technical depth?
- Are practical, real-world considerations discussed?
- Are edge cases and failure scenarios addressed?
- Does the explanation demonstrate genuine understanding (not just surface-level)?
- Are concrete examples or numbers provided where appropriate?
Score 0-10 where 10 = interview-ready depth with practical insights.`
  },
  tradeoffs: {
    name: 'Tradeoff Analysis',
    rubric: `Evaluate the tradeoff analysis:
- Are tradeoffs explicitly stated with clear "chose X over Y" format?
- Is the reasoning sound and balanced (acknowledges downsides of chosen option)?
- Are the tradeoffs relevant to the system being designed?
- Do they demonstrate awareness of alternatives?
- Are at least 3 meaningful tradeoffs identified?
Score 0-10 where 10 = mature, balanced tradeoff analysis showing deep understanding.`
  }
};

function buildSectionPrompt(sectionKey, studentAnswer, referenceAnswer, problem) {
  const sectionInfo = SECTION_PROMPTS[sectionKey];
  return `You are evaluating a student's system design answer for the section: "${sectionInfo.name}".

PROBLEM: ${problem.title}
${problem.problemStatement}

CONSTRAINTS:
- Users: ${problem.constraints?.estimatedUsers || 'Not specified'}
- QPS: ${problem.constraints?.estimatedQPS || 'Not specified'}
- Storage: ${problem.constraints?.storageNeeds || 'Not specified'}
- Latency: ${problem.constraints?.latencyRequirement || 'Not specified'}
- Availability: ${problem.constraints?.availabilityTarget || 'Not specified'}

EVALUATION RUBRIC:
${sectionInfo.rubric}

STRICTNESS: ${problem.evaluationConfig?.strictness || 'moderate'}

REFERENCE ANSWER (ideal):
${JSON.stringify(referenceAnswer || 'No reference provided', null, 2)}

STUDENT'S ANSWER:
${JSON.stringify(studentAnswer, null, 2)}

Respond ONLY with valid JSON in this exact format:
{
  "score": <number 0-10>,
  "feedback": "<2-3 sentence evaluation>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "missingConcepts": ["<missing concept 1>"]
}`;
}

async function callOpenAI(prompt, model) {
  if (!OPENAI_API_KEY) {
    return {
      score: 0,
      feedback: 'AI evaluation is disabled. Configure OPENAI_API_KEY to enable.',
      strengths: [],
      improvements: [],
      missingConcepts: []
    };
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an expert system design interviewer at a top tech company. Evaluate student answers fairly but rigorously. Always respond with valid JSON only.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');

  return JSON.parse(content);
}

async function evaluateSystemDesign(submission, problem) {
  const model = problem.evaluationConfig?.model || DEFAULT_MODEL;
  const sectionNames = Object.keys(SECTION_PROMPTS);

  const results = { sections: {}, overallFeedback: '', followUpQuestions: [] };

  // Evaluate each section in parallel
  const evaluationPromises = sectionNames.map(async (sectionKey) => {
    const studentAnswer = submission.sections?.[sectionKey];
    const refAnswer = problem.referenceAnswer?.[sectionKey];

    // Skip empty sections
    const isEmpty = !studentAnswer ||
      (Array.isArray(studentAnswer) && studentAnswer.length === 0) ||
      (typeof studentAnswer === 'object' && !Array.isArray(studentAnswer) &&
        Object.values(studentAnswer).every(v =>
          v === '' || v === null || v === undefined ||
          (Array.isArray(v) && v.length === 0)
        ));

    if (isEmpty) {
      return {
        key: sectionKey,
        result: {
          score: 0,
          maxScore: 10,
          feedback: 'This section was left empty.',
          strengths: [],
          improvements: ['Complete this section to receive a score.'],
          missingConcepts: ['Entire section missing']
        }
      };
    }

    try {
      const prompt = buildSectionPrompt(sectionKey, studentAnswer, refAnswer, problem);
      const evalResult = await callOpenAI(prompt, model);
      return {
        key: sectionKey,
        result: {
          score: Math.min(10, Math.max(0, evalResult.score || 0)),
          maxScore: 10,
          feedback: evalResult.feedback || '',
          strengths: evalResult.strengths || [],
          improvements: evalResult.improvements || [],
          missingConcepts: evalResult.missingConcepts || []
        }
      };
    } catch (error) {
      console.error(`Error evaluating section ${sectionKey}:`, error.message);
      return {
        key: sectionKey,
        result: {
          score: 0,
          maxScore: 10,
          feedback: `Evaluation error: ${error.message}`,
          strengths: [],
          improvements: [],
          missingConcepts: []
        }
      };
    }
  });

  const evaluations = await Promise.all(evaluationPromises);
  evaluations.forEach(({ key, result }) => {
    results.sections[key] = result;
  });

  // Generate overall feedback
  try {
    const overallPrompt = buildOverallFeedbackPrompt(submission, problem, results.sections);
    const overallResult = await callOpenAI(overallPrompt, model);
    results.overallFeedback = overallResult.overallFeedback || '';
    results.followUpQuestions = overallResult.followUpQuestions || [];
  } catch (error) {
    console.error('Error generating overall feedback:', error.message);
    results.overallFeedback = 'Overall evaluation could not be generated.';
    results.followUpQuestions = [];
  }

  return results;
}

function buildOverallFeedbackPrompt(submission, problem, sectionResults) {
  const scoresSummary = Object.entries(sectionResults)
    .map(([key, val]) => `${key}: ${val.score}/10`)
    .join(', ');

  const weakestSections = Object.entries(sectionResults)
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, 3)
    .map(([key]) => key);

  const followUpCount = problem.evaluationConfig?.followUpCount || 3;

  return `You evaluated a student's system design for: "${problem.title}"

Section scores: ${scoresSummary}

Weakest areas: ${weakestSections.join(', ')}

The student's architecture components: ${JSON.stringify(submission.sections?.architecture?.components || [])}
The student's tradeoffs: ${JSON.stringify(submission.sections?.tradeoffs || [])}

Generate:
1. A comprehensive overall feedback paragraph (3-5 sentences) summarizing the design quality
2. ${followUpCount} targeted follow-up interview questions that probe the weakest areas of this specific design. Questions should reference specific choices the student made.

Respond with valid JSON:
{
  "overallFeedback": "<paragraph>",
  "followUpQuestions": ["<question1>", "<question2>", "<question3>"]
}`;
}

async function evaluateFollowUpAnswer(question, answer, sections, problem) {
  if (!OPENAI_API_KEY || !answer || answer.trim().length === 0) {
    return { score: 0, feedback: 'No answer provided.' };
  }

  const prompt = `You are a system design interviewer evaluating a follow-up answer.

SYSTEM BEING DESIGNED: ${problem.title}

FOLLOW-UP QUESTION: ${question}

STUDENT'S DESIGN CONTEXT:
- Architecture components: ${JSON.stringify(sections?.architecture?.components || [])}
- Database choices: ${JSON.stringify((sections?.databaseDesign || []).map(d => `${d.entity}: ${d.dbType}`))}

STUDENT'S ANSWER: ${answer}

Evaluate the depth and accuracy of this answer. Score 0-10.

Respond with valid JSON:
{
  "score": <number 0-10>,
  "feedback": "<2-3 sentence evaluation>"
}`;

  try {
    const model = problem.evaluationConfig?.model || DEFAULT_MODEL;
    const result = await callOpenAI(prompt, model);
    return {
      score: Math.min(10, Math.max(0, result.score || 0)),
      feedback: result.feedback || ''
    };
  } catch (error) {
    console.error('Follow-up evaluation error:', error.message);
    return { score: 0, feedback: 'Evaluation error occurred.' };
  }
}

module.exports = { evaluateSystemDesign, evaluateFollowUpAnswer };
