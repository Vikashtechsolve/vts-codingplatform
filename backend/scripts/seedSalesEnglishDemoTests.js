/**
 * Seed 5 demo-quality English tests for sales@skilltrixa.com.
 * Creates a fresh question bank (does not reuse the thin copied items).
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Test = require('../models/Test');
const EnglishGrammarQuestion = require('../models/EnglishGrammarQuestion');
const EnglishVocabularyQuestion = require('../models/EnglishVocabularyQuestion');
const EnglishReadingQuestion = require('../models/EnglishReadingQuestion');
const EnglishEssayQuestion = require('../models/EnglishEssayQuestion');
const EnglishSpeakingQuestion = require('../models/EnglishSpeakingQuestion');
const EnglishListeningQuestion = require('../models/EnglishListeningQuestion');
const { uploadToR2 } = require('../utils/r2Storage');

const SOURCE_EMAIL = 'sales@skilltrixa.com';
const TAG = 'demo-english';

const TEST_SPECS = [
  'Campus Placement — English Proficiency Test',
  'Grammar & Vocabulary Diagnostic',
  'Reading Comprehension & Academic Writing',
  'Spoken English & Listening Assessment',
  'Business English for Workplace Communication',
];

const opt = (text, isCorrect = false) => ({ text, isCorrect });

const TYPE_TO_MODEL = {
  english_grammar: 'EnglishGrammarQuestion',
  english_vocabulary: 'EnglishVocabularyQuestion',
  english_reading: 'EnglishReadingQuestion',
  english_essay: 'EnglishEssayQuestion',
  english_speaking: 'EnglishSpeakingQuestion',
  english_listening: 'EnglishListeningQuestion',
};

function words(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function sectionQuestions(items, type, sectionId, startOrder) {
  return items.map((q, i) => ({
    type,
    questionId: q._id,
    questionType: TYPE_TO_MODEL[type],
    points: q.points || q.totalPoints || 10,
    order: startOrder + i,
    sectionId,
  }));
}

async function synthesizeBriefing(text) {
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
  const voice = process.env.OPENAI_TTS_VOICE || 'marin';
  const body = {
    model,
    input: text,
    voice,
    response_format: 'mp3',
    speed: 0.96,
  };
  if (model === 'gpt-4o-mini-tts') {
    body.instructions =
      'You are a clear workplace announcer reading an official briefing. ' +
      'Speak naturally, calmly, and distinctly. Do not add extra words or commentary.';
  }
  const response = await fetch(`${base}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`TTS failed: ${await response.text()}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function uploadListeningAudio(transcript, slug) {
  const buffer = await synthesizeBriefing(transcript);
  const key = `uploads/listening/demo-sales-${slug}-${Date.now()}.mp3`;
  const audioUrl = await uploadToR2(buffer, key, 'speech.mp3');
  return audioUrl;
}

function grammarDefs() {
  return [
    {
      key: 'g_tense',
      questionText: 'Choose the correct verb form to complete the sentence.',
      subType: 'fill_in_blank',
      blankSentence: 'By the time the interviewer arrived, the candidates _____ waiting for over an hour.',
      correctAnswer: 'had been',
      explanation: 'Past perfect continuous is used for an action that continued up to a point in the past.',
      grammarCategory: 'Tenses',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'tenses'],
    },
    {
      key: 'g_prep',
      questionText: 'Fill in the blank with the correct preposition.',
      subType: 'fill_in_blank',
      blankSentence: 'She is responsible _____ onboarding the new engineering interns.',
      correctAnswer: 'for',
      explanation: '"Responsible for" is the standard collocation.',
      grammarCategory: 'Prepositions',
      difficulty: 'easy',
      points: 5,
      tags: [TAG, 'prepositions'],
    },
    {
      key: 'g_article',
      questionText: 'Fill in the blank with the correct article. If no article is needed, write "no article".',
      subType: 'fill_in_blank',
      blankSentence: 'He was offered _____ MBA from a leading business school.',
      correctAnswer: 'an',
      explanation: 'Use "an" before a vowel sound. MBA is pronounced "em-bee-ay".',
      grammarCategory: 'Articles',
      difficulty: 'easy',
      points: 5,
      tags: [TAG, 'articles'],
    },
    {
      key: 'g_sva',
      questionText: 'Identify the part of the sentence that contains a grammatical error.',
      subType: 'error_detection',
      options: [
        opt('Neither of the proposals'),
        opt('were accepted', true),
        opt('by the hiring committee.'),
        opt('No error'),
      ],
      explanation: '"Neither" is singular, so the verb should be "was accepted".',
      grammarCategory: 'Subject-Verb Agreement',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'subject-verb'],
    },
    {
      key: 'g_error2',
      questionText: 'Identify the part of the sentence that contains a grammatical error.',
      subType: 'error_detection',
      options: [
        opt('Each of the students'),
        opt('have submitted', true),
        opt('their internship report on time.'),
        opt('No error'),
      ],
      explanation: '"Each" takes a singular verb: "has submitted".',
      grammarCategory: 'Subject-Verb Agreement',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'subject-verb'],
    },
    {
      key: 'g_correct',
      questionText: 'Correct the following sentence: "The manager, along with her team, are attending the client meeting." Type the complete corrected sentence.',
      subType: 'sentence_correction',
      isSubjective: true,
      correctAnswer: 'The manager, along with her team, is attending the client meeting.',
      explanation: 'With "along with", the verb agrees with the first subject: "manager" → "is".',
      grammarCategory: 'Subject-Verb Agreement',
      difficulty: 'medium',
      points: 8,
      tags: [TAG, 'sentence-correction'],
    },
    {
      key: 'g_voice',
      questionText: 'Choose the correct passive form of: "The panel will announce the results tomorrow."',
      subType: 'active_passive',
      options: [
        opt('The results are announced by the panel tomorrow.'),
        opt('The results will be announced by the panel tomorrow.', true),
        opt('The results would be announced by the panel tomorrow.'),
        opt('The results will announce by the panel tomorrow.'),
      ],
      explanation: 'Future simple passive: will be + past participle.',
      grammarCategory: 'Voice',
      difficulty: 'easy',
      points: 5,
      tags: [TAG, 'voice'],
    },
    {
      key: 'g_speech',
      questionText: 'Choose the correct reported speech for: She said, "I am preparing for the interview."',
      subType: 'direct_indirect',
      options: [
        opt('She said that she was preparing for the interview.', true),
        opt('She said that she is preparing for the interview.'),
        opt('She said that she had preparing for the interview.'),
        opt('She said that I was preparing for the interview.'),
      ],
      explanation: 'Present continuous becomes past continuous in reported speech, and "I" becomes "she".',
      grammarCategory: 'Reported Speech',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'reported-speech'],
    },
    {
      key: 'g_para',
      questionText: 'Arrange the sentences to form a coherent paragraph.',
      subType: 'parajumble',
      sentences: [
        'Finally, they presented their findings to the leadership team.',
        'The analysts first gathered customer feedback from three regions.',
        'They then grouped the comments into recurring themes.',
        'A product-research sprint was launched last month.',
      ],
      correctOrder: [3, 1, 2, 0],
      explanation: 'Start with the launch, then data collection, analysis, and the final presentation.',
      grammarCategory: 'Sentence Structure',
      difficulty: 'medium',
      points: 8,
      tags: [TAG, 'parajumble'],
    },
    {
      key: 'g_modal',
      questionText: 'Choose the most appropriate modal verb.',
      subType: 'fill_in_blank',
      blankSentence: 'Candidates _____ carry a government-issued ID to the assessment centre.',
      correctAnswer: 'must',
      explanation: '"Must" expresses a firm requirement or rule.',
      grammarCategory: 'Modals',
      difficulty: 'easy',
      points: 5,
      tags: [TAG, 'modals'],
    },
    {
      key: 'g_cond',
      questionText: 'Fill in the blank to complete the second conditional.',
      subType: 'fill_in_blank',
      blankSentence: 'If I _____ the hiring manager, I would ask for a take-home assignment instead of a surprise test.',
      correctAnswer: 'were',
      explanation: 'Unreal present condition uses "were" (even with I/he/she) in formal English.',
      grammarCategory: 'Conditionals',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'conditionals'],
    },
    {
      key: 'g_conj',
      questionText: 'Identify the part of the sentence that contains a grammatical error.',
      subType: 'error_detection',
      options: [
        opt('She not only completed the coding round'),
        opt('but also', false),
        opt('cleared the HR discussion in the same afternoon.'),
        opt('No error', true),
      ],
      explanation: 'The correlative pair "not only… but also" is used correctly here.',
      grammarCategory: 'Conjunctions',
      difficulty: 'hard',
      points: 5,
      tags: [TAG, 'conjunctions'],
    },
    {
      key: 'g_pronoun',
      questionText: 'Fill in the blank with the correct pronoun.',
      subType: 'fill_in_blank',
      blankSentence: 'The internship was offered to Rahul and _____.',
      correctAnswer: 'me',
      explanation: 'Use the object pronoun "me" after a preposition ("to").',
      grammarCategory: 'Pronouns',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'pronouns'],
    },
    {
      key: 'g_adv',
      questionText: 'Choose the sentence that is grammatically correct.',
      subType: 'active_passive',
      options: [
        opt('She explained the architecture clear to the client.'),
        opt('She explained the architecture clearly to the client.', true),
        opt('She explained the architecture clearer to the client.'),
        opt('She explained clearly the architecture to the client yesterday night.'),
      ],
      explanation: 'Use the adverb "clearly" to modify the verb "explained".',
      grammarCategory: 'Adjectives & Adverbs',
      difficulty: 'easy',
      points: 5,
      tags: [TAG, 'adverbs'],
    },
    {
      key: 'g_biz1',
      questionText: 'Choose the correct option to complete the workplace sentence.',
      subType: 'fill_in_blank',
      blankSentence: 'Please revert _____ the attached proposal by Friday evening.',
      correctAnswer: 'to',
      explanation: 'In Indian business English, "revert to" means "reply to". The preposition is "to".',
      grammarCategory: 'Prepositions',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'business'],
    },
    {
      key: 'g_biz2',
      questionText: 'Choose the correct reported speech.',
      subType: 'direct_indirect',
      options: [
        opt('The client asked if we could share the timeline by Monday.', true),
        opt('The client asked if we can share the timeline by Monday.'),
        opt('The client asked that could we share the timeline by Monday.'),
        opt('The client asked whether we share the timeline by Monday.'),
      ],
      explanation: 'Yes/no questions in reported speech use if/whether and back-shift the modal (can → could).',
      grammarCategory: 'Reported Speech',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'business'],
    },
  ];
}

function vocabDefs() {
  return [
    {
      key: 'v_syn1',
      word: 'meticulous',
      subType: 'synonym',
      contextSentence: 'She is meticulous about reviewing every pull request.',
      options: [opt('careless'), opt('thorough', true), opt('hasty'), opt('ordinary')],
      explanation: 'Meticulous means showing great attention to detail; thorough is the closest synonym.',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'synonym'],
    },
    {
      key: 'v_syn2',
      word: 'pragmatic',
      subType: 'synonym',
      contextSentence: 'We need a pragmatic plan for the first 90 days.',
      options: [opt('idealistic'), opt('practical', true), opt('ambiguous'), opt('rigid')],
      explanation: 'Pragmatic means dealing with things in a practical, realistic way.',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'synonym'],
    },
    {
      key: 'v_ant1',
      word: 'scarce',
      subType: 'antonym',
      contextSentence: 'Skilled testers are scarce this quarter.',
      options: [opt('rare'), opt('limited'), opt('abundant', true), opt('sparse')],
      explanation: 'Scarce means in short supply; abundant is the opposite.',
      difficulty: 'easy',
      points: 5,
      tags: [TAG, 'antonym'],
    },
    {
      key: 'v_mean1',
      word: 'ubiquitous',
      subType: 'meaning',
      options: [
        opt('rarely seen'),
        opt('present everywhere', true),
        opt('highly expensive'),
        opt('difficult to use'),
      ],
      explanation: 'Ubiquitous means found or existing everywhere.',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'meaning'],
    },
    {
      key: 'v_mean2',
      word: 'collaborate',
      subType: 'meaning',
      options: [
        opt('to work jointly with others', true),
        opt('to compete aggressively'),
        opt('to postpone a task'),
        opt('to work in isolation'),
      ],
      explanation: 'Collaborate means to work together towards a shared goal.',
      difficulty: 'easy',
      points: 5,
      tags: [TAG, 'meaning'],
    },
    {
      key: 'v_ows1',
      word: 'A person who speaks many languages',
      subType: 'one_word_substitution',
      options: [opt('bilingual'), opt('linguist'), opt('polyglot', true), opt('orator')],
      explanation: 'A polyglot speaks or writes several languages.',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'one-word'],
    },
    {
      key: 'v_idiom1',
      word: 'hit the ground running',
      subType: 'idiom_phrase',
      contextSentence: 'We expect the intern to hit the ground running in week one.',
      options: [
        opt('start slowly and carefully'),
        opt('begin work with energy and effectiveness', true),
        opt('leave the job immediately'),
        opt('make a serious mistake on day one'),
      ],
      explanation: 'To hit the ground running is to start a new activity with immediate success.',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'idiom'],
    },
    {
      key: 'v_idiom2',
      word: 'on the same page',
      subType: 'idiom_phrase',
      contextSentence: 'Let us get on the same page before we email the client.',
      options: [
        opt('reading the same document'),
        opt('in agreement or sharing the same understanding', true),
        opt('sitting in the same meeting room'),
        opt('following a written script'),
      ],
      explanation: 'On the same page means having a shared understanding.',
      difficulty: 'easy',
      points: 5,
      tags: [TAG, 'idiom'],
    },
    {
      key: 'v_spell1',
      word: 'Which spelling is correct?',
      subType: 'spelling',
      options: [opt('accomodation'), opt('acommodation'), opt('accommodation', true), opt('accommadation')],
      explanation: 'Accommodation has two c\'s and two m\'s.',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'spelling'],
    },
    {
      key: 'v_ctx1',
      word: 'deadline',
      subType: 'contextual_usage',
      contextSentence: 'Choose the sentence where the word is used correctly.',
      options: [
        opt('Please deadline the file before you leave.'),
        opt('The deadline for submissions is Friday 6 PM.', true),
        opt('She is a very deadline person at work.'),
        opt('We deadlineed the project last week.'),
      ],
      explanation: 'Deadline is a noun meaning the latest time for completing something.',
      difficulty: 'easy',
      points: 5,
      tags: [TAG, 'usage'],
    },
    {
      key: 'v_syn3',
      word: 'concise',
      subType: 'synonym',
      contextSentence: 'Keep your email concise so the manager can reply quickly.',
      options: [opt('lengthy'), opt('brief', true), opt('confusing'), opt('informal')],
      explanation: 'Concise means giving a lot of information clearly in a few words.',
      difficulty: 'easy',
      points: 5,
      tags: [TAG, 'synonym'],
    },
    {
      key: 'v_ant2',
      word: 'transparent',
      subType: 'antonym',
      contextSentence: 'The process should be transparent to every applicant.',
      options: [opt('clear'), opt('open'), opt('opaque', true), opt('honest')],
      explanation: 'In this context, transparent means easy to understand or not hidden; opaque is the opposite.',
      difficulty: 'medium',
      points: 5,
      tags: [TAG, 'antonym'],
    },
  ];
}

function readingDefs() {
  const remote = `Remote work has moved from a temporary experiment to a lasting part of how companies hire and manage talent. Teams that succeed remotely do not simply copy office habits onto a video call. They write decisions down, keep meetings short, and measure output instead of hours spent online. This shift has also widened the talent pool: a product company in Bengaluru can now hire a designer in Pune and a backend engineer in Coimbatore without relocating either person. The trade-off is cultural. Informal hallway conversations disappear, so managers must create deliberate check-ins. Employees who thrive are usually self-directed, comfortable with async updates, and clear in writing. Those who need constant supervision often struggle. The organisations that treat remote work as a communication skill — not just a location policy — report higher retention and faster onboarding.`;

  const climate = `Cities are beginning to treat climate risk as an operations problem, not only an environmental one. Heatwaves reduce outdoor working hours. Flooded streets delay deliveries and keep students from reaching test centres. In response, several Indian municipal bodies are mapping drainage, planting shade trees along bus corridors, and requiring new commercial buildings to harvest rainwater. None of these steps is dramatic on its own. Together, they make public services more reliable when the weather turns extreme. Critics argue that such projects move too slowly and that private developers still pave over wetlands. Supporters counter that waiting for a perfect national plan is riskier than piloting local fixes. For graduates entering public policy, urban planning, or infrastructure technology, this is no longer a niche topic. It is becoming core professional knowledge.`;

  const internships = `An internship is often the first time a student sees how classroom knowledge is used under deadlines. A computer-science intern who has only written assignments suddenly has to read someone else's code, ask for a review, and ship a small feature that other people will use. The learning is not only technical. Interns discover how stand-ups work, how to write a status update, and when to escalate a blocker instead of staying stuck. Employers, for their part, treat internships as a low-risk way to evaluate communication, curiosity, and reliability — qualities that a résumé cannot prove. Students who treat the internship as "just a certificate" usually gain little. Students who keep notes, request feedback, and finish the tasks they own leave with evidence they can discuss in a placement interview. That evidence is more persuasive than a list of online courses.`;

  const readingHabit = `Reading widely is still one of the cheapest ways to improve writing, vocabulary, and judgement. Short social-media posts train speed, not stamina. A student who reads one well-edited article a day — a product teardown, a court explainer, or a long reported feature — meets new sentence patterns and precise words in context. Over a semester, that exposure shows up in emails, essays, and interview answers. The habit does not require literary fiction. What matters is regular contact with complete arguments rather than fragments. Libraries, campus newspapers, and quality newsletters all work. The students who complain that they "freeze" in written tests are often the same students who rarely finish a page without switching screens. Building a 20-minute reading block is a practical skill, not a personality trait.`;

  const mcq = (questionText, options, correctIdx, extra = {}) => ({
    questionText,
    questionType: extra.questionType || 'mcq',
    options: extra.questionType === 'true_false' || extra.questionType === 'mcq' || !extra.questionType
      ? options.map((t, i) => opt(t, i === correctIdx))
      : [],
    referenceAnswer: extra.referenceAnswer || '',
    points: extra.points || 5,
  });

  return [
    {
      key: 'r_remote',
      passage: {
        title: 'Remote Work as a Communication Skill',
        content: remote,
        source: 'Skilltrixa Demo Briefing',
        wordCount: words(remote),
        genre: 'business',
      },
      questions: [
        mcq('What do successful remote teams do, according to the passage?', [
          'Copy office habits onto video calls',
          'Write decisions down and keep meetings short',
          'Measure hours spent online',
          'Avoid hiring outside the head-office city',
        ], 1),
        mcq('Which trade-off does the passage highlight?', [
          'Higher salaries for every role',
          'The loss of informal hallway conversations',
          'A smaller talent pool',
          'Fewer written updates',
        ], 1),
        mcq('Remote work mainly helps companies by:', [
          'Removing the need for managers',
          'Widening the talent pool without relocation',
          'Guaranteeing higher output for every employee',
          'Eliminating all meetings',
        ], 1),
        {
          questionText: 'Which employees does the passage say often struggle with remote work?',
          questionType: 'short_answer',
          options: [],
          referenceAnswer: 'Employees who need constant supervision',
          points: 5,
        },
      ],
      difficulty: 'medium',
      tags: [TAG, 'reading', 'business'],
    },
    {
      key: 'r_climate',
      passage: {
        title: 'Climate Risk in City Operations',
        content: climate,
        source: 'Skilltrixa Demo Briefing',
        wordCount: words(climate),
        genre: 'scientific',
      },
      questions: [
        mcq('Why are cities treating climate risk as an operations problem?', [
          'Because it only affects wildlife',
          'Because heat and floods disrupt work, deliveries, and exams',
          'Because national plans are already complete',
          'Because developers have stopped paving land',
        ], 1),
        mcq('Which local response is mentioned in the passage?', [
          'Banning all commercial buildings',
          'Mapping drainage and planting shade trees',
          'Moving every office to the hills',
          'Cancelling public transport in summer',
        ], 1),
        mcq('Critics of these projects mainly argue that they:', [
          'Are too expensive for graduates',
          'Move too slowly while wetlands are still paved over',
          'Focus only on wildlife parks',
          'Replace the need for engineers',
        ], 1),
        mcq('The author suggests this topic is becoming:', [
          'A niche interest for activists only',
          'Core professional knowledge for several graduate fields',
          'Irrelevant to technology careers',
          'A reason to avoid public policy jobs',
        ], 1),
      ],
      difficulty: 'medium',
      tags: [TAG, 'reading', 'current-affairs'],
    },
    {
      key: 'r_intern',
      passage: {
        title: 'What Internships Actually Teach',
        content: internships,
        source: 'Skilltrixa Demo Briefing',
        wordCount: words(internships),
        genre: 'non_fiction',
      },
      questions: [
        mcq('Besides technical skill, internships teach students to:', [
          'Avoid stand-ups and status updates',
          'Ask for review, ship work, and escalate blockers',
          'Replace a résumé with a certificate',
          'Work without talking to anyone',
        ], 1),
        mcq('Employers mainly use internships to evaluate:', [
          'Only coding speed',
          'Communication, curiosity, and reliability',
          'Family background',
          'The number of online courses listed',
        ], 1),
        mcq('Students who treat internships as "just a certificate" usually:', [
          'Gain the most interview evidence',
          'Gain little',
          'Receive a guaranteed full-time offer',
          'Skip all assigned tasks successfully',
        ], 1),
        {
          questionText: 'Why is internship evidence more persuasive in a placement interview than a list of online courses?',
          questionType: 'inference',
          options: [],
          referenceAnswer:
            'Because it shows real work finished under deadlines, with feedback and ownership, which a course list cannot prove.',
          points: 5,
        },
      ],
      difficulty: 'medium',
      tags: [TAG, 'reading', 'careers'],
    },
    {
      key: 'r_habit',
      passage: {
        title: 'Reading Stamina Beats Scrolling',
        content: readingHabit,
        source: 'Skilltrixa Demo Briefing',
        wordCount: words(readingHabit),
        genre: 'editorial',
      },
      questions: [
        mcq('According to the passage, short social-media posts mainly train:', [
          'Stamina',
          'Speed',
          'Legal judgement',
          'Public speaking',
        ], 1),
        mcq('What kind of daily reading does the author recommend?', [
          'Only literary fiction',
          'One well-edited complete article or argument',
          'As many headlines as possible',
          'Only textbooks',
        ], 1),
        mcq('Students who freeze in written tests are often those who:', [
          'Read newspapers every morning',
          'Rarely finish a page without switching screens',
          'Prefer libraries to newsletters',
          'Write long emails',
        ], 1),
        mcq('The author treats a 20-minute reading block as:', [
          'A personality trait you either have or lack',
          'A practical skill that can be built',
          'Unnecessary for interview preparation',
          'Useful only for literature majors',
        ], 1),
      ],
      difficulty: 'easy',
      tags: [TAG, 'reading', 'study-skills'],
    },
  ].map((item) => ({
    ...item,
    totalPoints: item.questions.reduce((sum, q) => sum + (q.points || 5), 0),
  }));
}

function essayDefs() {
  return [
    {
      key: 'e_intern',
      prompt: 'Should internships be mandatory in every undergraduate professional programme? Present a clear opinion and support it with reasons and examples.',
      writingType: 'essay_opinion',
      instructions: 'Write a structured opinion essay with an introduction, two or three body paragraphs, and a short conclusion. Use formal academic English.',
      wordLimit: { min: 180, max: 320 },
      timeLimit: 25,
      expectedFormat: 'Introduction → arguments with examples → conclusion',
      sampleResponse:
        'Internships should be mandatory in professional degrees because they connect theory with workplace behaviour. Students learn to take review comments, meet deadlines, and explain their work — skills a classroom test rarely measures. A compulsory internship also pushes colleges to build industry links instead of leaving placement entirely to the student. Critics say unpaid internships can exclude those who must earn immediately; programmes should therefore offer stipends or on-campus project alternatives. Overall, a well-designed mandatory internship is fairer than leaving employability to chance.',
      difficulty: 'medium',
      points: 20,
      tags: [TAG, 'essay'],
    },
    {
      key: 'e_ai',
      prompt: 'Some companies now use AI tools to shortlist résumés. Is this fair to candidates? Write an argumentative essay discussing both benefits and risks, then state your position.',
      writingType: 'essay_argumentative',
      instructions: 'Acknowledge the other side, then argue your position with clear topic sentences. Avoid slang.',
      wordLimit: { min: 200, max: 350 },
      timeLimit: 25,
      expectedFormat: 'Balanced argumentative essay with a definite stance',
      sampleResponse:
        'AI screening can reduce the time recruiters spend on obvious mismatches and can, in principle, ignore college brand if the model is designed that way. The risk is that the same model copies old bias: it may prefer keywords from certain campuses or penalise career breaks. Fairness therefore depends on audit, human review of borderline cases, and a way for candidates to appeal. I support AI as a first filter only when humans still decide interviews and when the criteria are published. Speed without accountability is not a fair hiring process.',
      difficulty: 'medium',
      points: 20,
      tags: [TAG, 'essay', 'ai'],
    },
    {
      key: 'e_email',
      prompt: 'Write a formal email to a client, Ms. Anita Sharma, requesting to reschedule Tuesday’s 3 PM product demo to Thursday at 11 AM because two engineers are on a production hotfix. Propose an agenda and offer a recorded walkthrough if the new slot is inconvenient.',
      writingType: 'email_formal',
      instructions: 'Use a clear subject line, polite opening, one-paragraph reason, proposed alternative, and a professional close. Do not invent a different company name; you may sign as Priya Nair, Account Manager.',
      wordLimit: { min: 120, max: 220 },
      timeLimit: 20,
      expectedFormat: 'Subject, salutation, body, closing, name and title',
      sampleResponse:
        'Subject: Request to reschedule product demo — Tuesday 3 PM to Thursday 11 AM\n\nDear Ms. Sharma,\n\nI hope you are well. I am writing to request that we move Tuesday’s product demo to Thursday at 11 AM. Two engineers on the demo team are occupied with a production hotfix, and we would rather show you a stable walkthrough than a rushed one.\n\nIf Thursday is inconvenient, we can share a recorded walkthrough the same day and keep a live Q&A at a time you prefer. Thank you for your flexibility.\n\nWarm regards,\nPriya Nair\nAccount Manager',
      difficulty: 'medium',
      points: 20,
      tags: [TAG, 'email', 'business'],
    },
    {
      key: 'e_report',
      prompt: 'Write a short internal report (120–200 words) summarising a campus placement week: 180 students registered, 62 were shortlisted, 21 received offers, the highest package was 12 LPA, and the main gap was spoken English in HR rounds. End with two recommendations.',
      writingType: 'report',
      instructions: 'Use headings such as Overview, Key numbers, Observation, and Recommendations. Keep the tone factual.',
      wordLimit: { min: 120, max: 200 },
      timeLimit: 20,
      expectedFormat: 'Short workplace report with headings',
      sampleResponse:
        'Overview\nThe placement week ran as scheduled with strong registration but a drop from shortlist to offer.\n\nKey numbers\nRegistered: 180. Shortlisted: 62. Offers: 21. Highest package: 12 LPA.\n\nObservation\nFaculty reported that several shortlisted students struggled in HR conversations despite clearing aptitude and technical rounds.\n\nRecommendations\n1. Add a weekly speaking clinic before the next drive.\n2. Require a mock HR interview for every shortlisted student.',
      difficulty: 'medium',
      points: 20,
      tags: [TAG, 'report', 'business'],
    },
  ];
}

function speakingDefs() {
  return [
    {
      key: 's_read',
      prompt: 'Read the passage aloud clearly. Pay attention to punctuation, stress, and pace.',
      speakingType: 'read_aloud',
      referenceText:
        'Good communication is not the same as speaking quickly. In a workplace, people trust you when you state the problem, the impact, and the next step. If you are unsure, say so and give a time when you will return with an answer. That habit builds credibility faster than a long explanation.',
      preparationTime: 20,
      speakingTime: { min: 25, max: 45 },
      maxAttempts: 2,
      difficulty: 'easy',
      points: 15,
      tags: [TAG, 'read-aloud'],
    },
    {
      key: 's_topic1',
      prompt: 'Describe a skill you learned in the last year — technical or non-technical — and explain how you practised it. Speak for about one minute.',
      speakingType: 'topic_speaking',
      preparationTime: 30,
      speakingTime: { min: 45, max: 75 },
      maxAttempts: 2,
      difficulty: 'medium',
      points: 20,
      tags: [TAG, 'topic'],
    },
    {
      key: 's_situational',
      prompt: 'You are two minutes late to a client video call because your previous meeting overran. The client is already on the call. What do you say in the first 30 seconds, and how do you recover the agenda?',
      speakingType: 'situational',
      preparationTime: 25,
      speakingTime: { min: 40, max: 70 },
      maxAttempts: 2,
      difficulty: 'medium',
      points: 20,
      tags: [TAG, 'situational', 'business'],
    },
    {
      key: 's_extempore',
      prompt: 'Speak on the topic: "Why clear writing makes teams faster." You may take half a minute to plan, then speak continuously.',
      speakingType: 'extempore',
      preparationTime: 30,
      speakingTime: { min: 45, max: 90 },
      maxAttempts: 2,
      difficulty: 'medium',
      points: 20,
      tags: [TAG, 'extempore'],
    },
    {
      key: 's_team',
      prompt: 'Tell us about a time you worked in a team, what your role was, and one disagreement you helped resolve. Use a simple beginning-middle-end structure.',
      speakingType: 'topic_speaking',
      preparationTime: 30,
      speakingTime: { min: 50, max: 90 },
      maxAttempts: 2,
      difficulty: 'medium',
      points: 20,
      tags: [TAG, 'topic'],
    },
  ];
}

const LISTENING_CLIPS = {
  placement: {
    title: 'Career Cell — Placement Day Briefing',
    transcript:
      'Welcome to the career cell briefing. Campus interviews for NovaTech Solutions will be held this Saturday from 9 AM to 4 PM in the main auditorium. Eligible students must have at least 60 percent aggregate and no active backlogs. Please bring two printed copies of your resume, a government ID, and your college ID card. The process includes an aptitude test, a group discussion, and two technical interviews. Formal clothing is mandatory. Registration closes tomorrow at 6 PM on the student portal. Late entries will not be accepted. Thank you, and all the best.',
    questions: [
      {
        questionText: 'Which company is visiting campus?',
        questionType: 'mcq',
        options: [opt('NovaTech Solutions', true), opt('Skilltrixa Labs'), opt('Main Auditorium Pvt Ltd'), opt('Career Cell Inc')],
        points: 5,
      },
      {
        questionText: 'When will the interviews be held?',
        questionType: 'mcq',
        options: [opt('Friday, 9 AM to 4 PM'), opt('Saturday, 9 AM to 4 PM', true), opt('Saturday, 6 PM onwards'), opt('Sunday, 9 AM to 4 PM')],
        points: 5,
      },
      {
        questionText: 'What is the minimum aggregate required?',
        questionType: 'mcq',
        options: [opt('50 percent'), opt('55 percent'), opt('60 percent', true), opt('75 percent')],
        points: 5,
      },
      {
        questionText: 'When does registration close?',
        questionType: 'mcq',
        options: [opt('Today at 4 PM'), opt('Tomorrow at 6 PM on the student portal', true), opt('Saturday at 9 AM'), opt('It remains open all week')],
        points: 5,
      },
    ],
  },
  standup: {
    title: 'Product Team — Wednesday Standup Update',
    transcript:
      'Good morning everyone. This is Priya from the product team with a short update for Wednesday\'s standup. The mobile app release has been moved from Friday to next Tuesday because of a payment-gateway issue. Please finish regression testing by Monday 5 PM. The design review with the client is at 11 AM tomorrow in Meeting Room B. If you cannot attend, send your comments on the Figma file before 10 AM. Lunch will be provided for everyone who stays back for the evening bug-bash. Thank you.',
    questions: [
      {
        questionText: 'When is the mobile app release now scheduled?',
        questionType: 'mcq',
        options: [opt('This Friday'), opt('Monday 5 PM'), opt('Next Tuesday', true), opt('Tomorrow 11 AM')],
        points: 5,
      },
      {
        questionText: 'Why was the release delayed?',
        questionType: 'mcq',
        options: [opt('A staffing shortage'), opt('A payment-gateway issue', true), opt('The client cancelled the design review'), opt('The Figma file was missing')],
        points: 5,
      },
      {
        questionText: 'Where is the client design review?',
        questionType: 'mcq',
        options: [opt('Figma'), opt('The main auditorium'), opt('Meeting Room B', true), opt('Online only')],
        points: 5,
      },
      {
        questionText: 'If someone cannot attend the design review, what should they do?',
        questionType: 'short_answer',
        options: [],
        correctAnswer: 'Send comments on the Figma file before 10 AM',
        points: 5,
      },
    ],
  },
};

function byKey(docs, defs) {
  const map = {};
  defs.forEach((def, i) => {
    map[def.key] = docs[i];
  });
  return map;
}

function pick(map, keys) {
  return keys.map((k) => {
    if (!map[k]) throw new Error(`Missing question key ${k}`);
    return map[k];
  });
}

function buildTest({ title, description, sections, createdBy, vendorId }) {
  const englishSections = sections.map((s, i) => ({
    sectionType: s.sectionType,
    sectionTitle: s.sectionTitle,
    duration: s.duration,
    order: i + 1,
    instructions: s.instructions,
  }));
  let order = 1;
  const questions = [];
  for (const s of sections) {
    const mapped = sectionQuestions(s.items, s.qType, s.sectionType, order);
    questions.push(...mapped);
    order += mapped.length;
  }
  return {
    title,
    description,
    vendorId,
    createdBy,
    type: 'english',
    source: 'vendor',
    duration: sections.reduce((sum, s) => sum + s.duration, 0),
    questions,
    englishSections,
    isActive: true,
    settings: {
      allowMultipleAttempts: false,
      autoSubmitAtWindowEnd: true,
      showResults: true,
      resultDisplay: 'detailed',
      shuffleQuestions: false,
      practiceMode: false,
    },
  };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.findOne({ email: SOURCE_EMAIL, role: 'vendor_admin', isActive: true });
  if (!admin?.vendorId) throw new Error(`Vendor admin not found: ${SOURCE_EMAIL}`);
  const vendorId = admin.vendorId;
  const createdBy = admin._id;

  const existing = await Test.find({ vendorId, title: { $in: TEST_SPECS } }).select('title').lean();
  if (existing.length) {
    throw new Error(`Demo tests already exist: ${existing.map((t) => t.title).join('; ')}`);
  }

  console.log('Generating listening audio...');
  const [placementUrl, standupUrl] = await Promise.all([
    uploadListeningAudio(LISTENING_CLIPS.placement.transcript, 'placement'),
    uploadListeningAudio(LISTENING_CLIPS.standup.transcript, 'standup'),
  ]);
  console.log('Listening audio uploaded');

  const gDefs = grammarDefs();
  const vDefs = vocabDefs();
  const rDefs = readingDefs();
  const eDefs = essayDefs();
  const sDefs = speakingDefs();

  const strip = (defs) => defs.map(({ key, ...rest }) => ({
    ...rest,
    vendorId,
    createdBy,
    isGlobal: false,
  }));

  console.log('Inserting questions...');
  const grammarDocs = await EnglishGrammarQuestion.insertMany(strip(gDefs));
  const vocabDocs = await EnglishVocabularyQuestion.insertMany(strip(vDefs));
  const readingDocs = await EnglishReadingQuestion.insertMany(strip(rDefs));
  const essayDocs = await EnglishEssayQuestion.insertMany(strip(eDefs));
  const speakingDocs = await EnglishSpeakingQuestion.insertMany(strip(sDefs));

  const listeningDocs = await EnglishListeningQuestion.insertMany([
    {
      title: LISTENING_CLIPS.placement.title,
      audioUrl: placementUrl,
      audioTranscript: LISTENING_CLIPS.placement.transcript,
      audioDuration: 55,
      maxReplays: 2,
      questionDelay: 0,
      questions: LISTENING_CLIPS.placement.questions,
      totalPoints: 20,
      difficulty: 'medium',
      tags: [TAG, 'listening', 'placement'],
      vendorId,
      createdBy,
      isGlobal: false,
    },
    {
      title: LISTENING_CLIPS.standup.title,
      audioUrl: standupUrl,
      audioTranscript: LISTENING_CLIPS.standup.transcript,
      audioDuration: 50,
      maxReplays: 2,
      questionDelay: 0,
      questions: LISTENING_CLIPS.standup.questions,
      totalPoints: 20,
      difficulty: 'medium',
      tags: [TAG, 'listening', 'workplace'],
      vendorId,
      createdBy,
      isGlobal: false,
    },
  ]);

  const G = byKey(grammarDocs, gDefs);
  const V = byKey(vocabDocs, vDefs);
  const R = byKey(readingDocs, rDefs);
  const E = byKey(essayDocs, eDefs);
  const S = byKey(speakingDocs, sDefs);
  const L = { placement: listeningDocs[0], standup: listeningDocs[1] };

  const tests = [
    buildTest({
      title: TEST_SPECS[0],
      description:
        'Full six-section English proficiency test used in campus hiring. Covers grammar, vocabulary, reading, writing, listening, and speaking. Designed as a 90-minute placement-style demo.',
      createdBy,
      vendorId,
      sections: [
        {
          sectionType: 'grammar',
          sectionTitle: 'Grammar',
          duration: 15,
          qType: 'english_grammar',
          instructions: 'Attempt all items. For fill-in-the-blank questions, type the exact word or phrase required.',
          items: pick(G, ['g_tense', 'g_prep', 'g_article', 'g_sva', 'g_voice', 'g_speech', 'g_para', 'g_modal']),
        },
        {
          sectionType: 'vocabulary',
          sectionTitle: 'Vocabulary',
          duration: 12,
          qType: 'english_vocabulary',
          instructions: 'Choose the best option. Read any example sentence before you answer.',
          items: pick(V, ['v_syn1', 'v_syn2', 'v_ant1', 'v_mean1', 'v_idiom1', 'v_ows1']),
        },
        {
          sectionType: 'reading',
          sectionTitle: 'Reading Comprehension',
          duration: 20,
          qType: 'english_reading',
          instructions: 'Read the passage carefully. You may revisit it while answering.',
          items: pick(R, ['r_intern']),
        },
        {
          sectionType: 'writing',
          sectionTitle: 'Essay / Email Writing',
          duration: 25,
          qType: 'english_essay',
          instructions: 'Stay within the word limit. Structure your response with a clear introduction and conclusion.',
          items: pick(E, ['e_intern']),
        },
        {
          sectionType: 'listening',
          sectionTitle: 'Listening',
          duration: 12,
          qType: 'english_listening',
          instructions: 'You may replay the audio up to two times. Answer from what you hear, not from general knowledge.',
          items: [L.placement],
        },
        {
          sectionType: 'speaking',
          sectionTitle: 'Speaking',
          duration: 15,
          qType: 'english_speaking',
          instructions: 'Use the preparation time. Speak clearly into the microphone and finish within the time limit.',
          items: pick(S, ['s_read', 's_topic1']),
        },
      ],
    }),
    buildTest({
      title: TEST_SPECS[1],
      description:
        'A focused diagnostic for accuracy in grammar and vocabulary. Ideal for a short screening round before a full English assessment.',
      createdBy,
      vendorId,
      sections: [
        {
          sectionType: 'grammar',
          sectionTitle: 'Grammar',
          duration: 20,
          qType: 'english_grammar',
          instructions: 'This section mixes tenses, agreement, voice, conditionals, and sentence correction. Attempt every question.',
          items: pick(G, ['g_tense', 'g_sva', 'g_error2', 'g_correct', 'g_voice', 'g_speech', 'g_para', 'g_cond', 'g_pronoun', 'g_adv']),
        },
        {
          sectionType: 'vocabulary',
          sectionTitle: 'Vocabulary',
          duration: 15,
          qType: 'english_vocabulary',
          instructions: 'Synonyms, antonyms, meanings, idioms, spelling, and usage. Choose the most precise option.',
          items: pick(V, ['v_syn1', 'v_syn3', 'v_ant1', 'v_ant2', 'v_mean1', 'v_mean2', 'v_idiom2', 'v_spell1']),
        },
      ],
    }),
    buildTest({
      title: TEST_SPECS[2],
      description:
        'Two reading passages plus an academic writing task. Use this to demonstrate comprehension, inference, and structured essay writing.',
      createdBy,
      vendorId,
      sections: [
        {
          sectionType: 'reading',
          sectionTitle: 'Reading Comprehension',
          duration: 25,
          qType: 'english_reading',
          instructions: 'Two passages. Answer both objective and short-answer items from the text.',
          items: pick(R, ['r_climate', 'r_habit']),
        },
        {
          sectionType: 'writing',
          sectionTitle: 'Essay / Email Writing',
          duration: 25,
          qType: 'english_essay',
          instructions: 'Write a balanced argumentative essay. Take a clear position after presenting both sides.',
          items: pick(E, ['e_ai']),
        },
      ],
    }),
    buildTest({
      title: TEST_SPECS[3],
      description:
        'Communication round covering listening comprehension and three speaking tasks: read-aloud, extended speaking, and extempore.',
      createdBy,
      vendorId,
      sections: [
        {
          sectionType: 'listening',
          sectionTitle: 'Listening',
          duration: 12,
          qType: 'english_listening',
          instructions: 'Play the workplace standup briefing and answer the questions. Maximum two replays.',
          items: [L.standup],
        },
        {
          sectionType: 'speaking',
          sectionTitle: 'Speaking',
          duration: 20,
          qType: 'english_speaking',
          instructions: 'Complete all three speaking tasks. Check your microphone before you start recording.',
          items: pick(S, ['s_read', 's_team', 's_extempore']),
        },
      ],
    }),
    buildTest({
      title: TEST_SPECS[4],
      description:
        'Workplace English for client communication: professional grammar, business vocabulary, a formal reschedule email, and a situational speaking task.',
      createdBy,
      vendorId,
      sections: [
        {
          sectionType: 'grammar',
          sectionTitle: 'Grammar',
          duration: 12,
          qType: 'english_grammar',
          instructions: 'Focus on professional accuracy — prepositions, reported speech, and error detection.',
          items: pick(G, ['g_prep', 'g_biz1', 'g_biz2', 'g_error2', 'g_conj']),
        },
        {
          sectionType: 'vocabulary',
          sectionTitle: 'Vocabulary',
          duration: 10,
          qType: 'english_vocabulary',
          instructions: 'Business-leaning vocabulary and idioms used in workplace English.',
          items: pick(V, ['v_syn2', 'v_idiom1', 'v_idiom2', 'v_ctx1', 'v_syn3']),
        },
        {
          sectionType: 'writing',
          sectionTitle: 'Essay / Email Writing',
          duration: 20,
          qType: 'english_essay',
          instructions: 'Write a complete formal email with subject line, reason, alternative slot, and closing.',
          items: pick(E, ['e_email']),
        },
        {
          sectionType: 'speaking',
          sectionTitle: 'Speaking',
          duration: 12,
          qType: 'english_speaking',
          instructions: 'Handle the client-call situation professionally. Apologise briefly, then recover the agenda.',
          items: pick(S, ['s_situational']),
        },
      ],
    }),
  ];

  console.log('Creating tests...');
  const createdTests = await Test.insertMany(tests);
  await Vendor.updateOne({ _id: vendorId }, { $inc: { 'stats.totalTests': createdTests.length } });

  const verify = await Test.find({ vendorId, title: { $in: TEST_SPECS } }).lean();
  if (verify.length !== 5) {
    throw new Error(`Expected 5 demo tests, found ${verify.length}`);
  }

  const models = {
    english_grammar: EnglishGrammarQuestion,
    english_vocabulary: EnglishVocabularyQuestion,
    english_reading: EnglishReadingQuestion,
    english_essay: EnglishEssayQuestion,
    english_speaking: EnglishSpeakingQuestion,
    english_listening: EnglishListeningQuestion,
  };
  for (const t of verify) {
    if (!t.questions?.length) throw new Error(`${t.title} has no questions`);
    if (!t.englishSections?.length) throw new Error(`${t.title} has no sections`);
    for (const q of t.questions) {
      const Model = models[q.type];
      const doc = await Model.findById(q.questionId).select('_id vendorId').lean();
      if (!doc) throw new Error(`${t.title}: missing ${q.type} ${q.questionId}`);
      if (String(doc.vendorId) !== String(vendorId)) {
        throw new Error(`${t.title}: question not owned by sales vendor`);
      }
    }
  }

  console.log(JSON.stringify({
    ok: true,
    tests: verify.map((t) => ({
      title: t.title,
      duration: t.duration,
      questions: t.questions.length,
      sections: t.englishSections.map((s) => `${s.sectionType}:${s.duration}m`),
    })),
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\nSEED FAILED:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
