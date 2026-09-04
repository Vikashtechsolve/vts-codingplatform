/**
 * Seed 5 demo project-evaluation assignments for sales@skilltrixa.com.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');
const Assignment = require('../models/Assignment');

const SOURCE_EMAIL = 'sales@skilltrixa.com';

const TITLES = [
  'Campus Placement Board (Frontend)',
  'Interview Slot Booking API (Backend)',
  'Mentorship Session Booking Platform (Full Stack)',
  'Placement Outcomes Analytics Pipeline (Data Science)',
  'Containerize a REST API with CI/CD (DevOps)',
];

const DEADLINE = new Date('2027-12-31T18:30:00.000Z');

const DEFAULT_WEIGHTS = {
  featureCompletion: 40,
  codeQuality: 20,
  architecture: 15,
  security: 10,
  gitPractices: 10,
  documentation: 5,
};

const DEFAULT_RULES = {
  requiredBranch: 'main',
  mustIncludeReadme: true,
  mustIncludeEnvExample: true,
  mustNotContainSecrets: true,
  minimumCommits: 6,
  requireDeploymentUrl: false,
};

function feature(name, marks, required, description) {
  return { feature: name, marks, required, description };
}

function assertMarks(assignment) {
  const sum = assignment.featureChecklist.reduce((s, f) => s + f.marks, 0);
  if (sum !== assignment.totalMarks) {
    throw new Error(`${assignment.title}: feature marks ${sum} != totalMarks ${assignment.totalMarks}`);
  }
  const w = Object.values(assignment.evaluationWeights).reduce((s, n) => s + n, 0);
  if (w !== 100) {
    throw new Error(`${assignment.title}: weights ${w} != 100`);
  }
}

function assignments(vendorId, createdBy) {
  return [
    {
      title: TITLES[0],
      category: 'frontend',
      difficulty: 'easy',
      duration: 150,
      totalMarks: 100,
      allowedTechStack: ['React', 'JavaScript', 'HTML', 'CSS', 'Vite'],
      repositoryRules: { ...DEFAULT_RULES, requireDeploymentUrl: true, minimumCommits: 6 },
      description: `
<p>Build a <strong>Campus Placement Board</strong> — a frontend-only dashboard where students browse drives, filter by company and role, and save favourites. Use mock JSON (no backend required). This is a UI/engineering quality assignment.</p>
<h3>Product goal</h3>
<p>A student should open the app, see a list of placement drives, filter them, open a detail view, and mark a drive as saved. State must survive a refresh (localStorage is enough).</p>
<h3>Must include</h3>
<ul>
<li>Responsive layout (desktop and a usable mobile width)</li>
<li>Accessible form controls (labels, keyboard focus)</li>
<li>Clear empty and loading states</li>
<li>A README with screenshots and how to run locally</li>
</ul>
      `.trim(),
      additionalInstructions: `
Submit a public GitHub repo on branch main. Include a live demo URL (Vercel/Netlify/GitHub Pages). Do not commit secrets. Use semantic HTML. Prefer small components over one giant file. Mock at least 8 drives across 4 companies.
      `.trim(),
      featureChecklist: [
        feature('Drive listing with company, role, CTC band, and last date', 15, true, 'Home/list view populated from mock data, not hardcoded one-by-one JSX for a single card only.'),
        feature('Search and filters (company, role type, open vs closed)', 15, true, 'Filters must combine; clearing filters restores the full list.'),
        feature('Drive detail view (eligibility, process rounds, apply CTA)', 15, true, 'Detail can be a route or a panel; apply may be a dummy button with confirmation.'),
        feature('Save / unsave drives with persistence', 12, true, 'Favourites survive refresh via localStorage or equivalent.'),
        feature('Responsive UI and empty/loading/error states', 12, false, 'Works at ~375px width. Empty filter results explained to the user.'),
        feature('Component structure and reusable styles', 12, false, 'Shared button/card/layout; avoid copy-paste CSS on every page.'),
        feature('README, run steps, and deployed demo URL', 10, true, 'README lists Node version, install, start, and the live URL.'),
        feature('Git history (meaningful commits on main)', 9, true, 'At least 6 commits; no single dump commit of the whole app.'),
      ],
    },
    {
      title: TITLES[1],
      category: 'backend',
      difficulty: 'medium',
      duration: 180,
      totalMarks: 100,
      allowedTechStack: ['Node.js', 'Express', 'MongoDB', 'PostgreSQL', 'JWT'],
      repositoryRules: { ...DEFAULT_RULES, mustIncludeEnvExample: true, minimumCommits: 7 },
      description: `
<p>Build a <strong>REST API for booking interview slots</strong> used by a campus placement cell. Vendors create slots; students book, cancel, and list their bookings.</p>
<h3>Actors</h3>
<ul>
<li><strong>Admin</strong> — create/update/delete slots, see all bookings</li>
<li><strong>Student</strong> — list open slots, book one slot per drive, cancel before start</li>
</ul>
<h3>Rules</h3>
<ul>
<li>A slot has limited capacity; overbooking must be impossible (use transactions or atomic updates)</li>
<li>JWT (or equivalent) auth; role checks on every mutating route</li>
<li>Validate input; return consistent JSON error shapes</li>
<li>No secrets in git; <code>.env.example</code> required</li>
</ul>
      `.trim(),
      additionalInstructions: `
Use Node.js + Express. MongoDB or PostgreSQL are both acceptable. Include seed data for one admin, two students, and at least six slots. Provide API examples (curl or a simple HTTP collection) in the README. Automated tests are a plus but not required for full feature marks.
      `.trim(),
      featureChecklist: [
        feature('Auth: register/login, JWT, admin vs student roles', 16, true, 'Protected routes reject missing/invalid tokens with 401.'),
        feature('Admin CRUD for interview slots (drive, time window, capacity, interviewer)', 14, true, 'Students cannot create slots.'),
        feature('Student book slot with capacity enforcement', 16, true, 'Concurrent double-book of the last seat must not exceed capacity.'),
        feature('Cancel booking and free capacity before slot start', 10, true, 'Cancel after start should be rejected with a clear error.'),
        feature('List endpoints: open slots, my bookings, admin all bookings', 12, true, 'Support basic filters (drive id, date).'),
        feature('Input validation and consistent error JSON', 10, false, 'Unknown ids return 404; validation errors return 400 with field names.'),
        feature('Env example, no committed secrets, README with API map', 12, true, '.env.example lists PORT, DB URI, JWT secret placeholders.'),
        feature('Meaningful git history on main', 10, true, 'At least 7 commits showing incremental work.'),
      ],
    },
    {
      title: TITLES[2],
      category: 'fullstack',
      difficulty: 'medium',
      duration: 210,
      totalMarks: 100,
      allowedTechStack: ['React', 'Node.js', 'Express', 'MongoDB', 'MERN'],
      repositoryRules: { ...DEFAULT_RULES, requireDeploymentUrl: false, minimumCommits: 8 },
      description: `
<p>Build a <strong>Mentorship Session Booking</strong> full-stack app for Skilltrixa-style coaching.</p>
<p>Mentors publish weekly availability. Students browse mentors, book a 30-minute session, and see upcoming sessions. Mentors confirm or decline. Both sides can leave a short session note after completion.</p>
<h3>Scope</h3>
<ul>
<li>Two roles: mentor and student (admin optional)</li>
<li>Calendar of availability (simple list of slots is enough; a full Google Calendar is not required)</li>
<li>Booking cannot overlap an already booked slot for that mentor</li>
<li>Basic profile: name, headline, topics (DSA, SQL, system design)</li>
</ul>
<p>This is not a video-call product — store a meeting link field (string) when the mentor confirms.</p>
      `.trim(),
      additionalInstructions: `
Monorepo or separate client/server folders are both fine. Include seed mentors and students. README must explain env vars for both apps and how to run them. Do not copy a todo-app tutorial and relabel it.
      `.trim(),
      featureChecklist: [
        feature('Auth and role-based UI (mentor vs student)', 12, true, 'Routes and APIs respect roles; students cannot publish slots.'),
        feature('Mentor availability: create, list, disable slots', 12, true, 'Slot has start, end, timezone or ISO timestamps.'),
        feature('Student browse mentors by topic and book an open slot', 14, true, 'Booking is atomic; overlapping bookings rejected.'),
        feature('Mentor confirm/decline; student sees status', 10, true, 'Confirmed bookings store an optional meeting URL.'),
        feature('Upcoming / past sessions lists for both roles', 10, true, 'Past sessions are read-only except notes.'),
        feature('Post-session notes (mentor and student)', 8, false, 'Notes visible to the other party after the session end time.'),
        feature('Clean API + React structure, loading and error handling', 12, false, 'No uncaught promise UI; forms disable while submitting.'),
        feature('README, .env.example, no secrets, git history', 12, true, 'At least 8 commits. Seed script or documented seed steps.'),
        feature('Responsive student browse page', 10, false, 'Usable on a 375px-wide screen.'),
      ],
    },
    {
      title: TITLES[3],
      category: 'data-science',
      difficulty: 'medium',
      duration: 180,
      totalMarks: 100,
      allowedTechStack: ['Python', 'pandas', 'Jupyter', 'scikit-learn', 'matplotlib'],
      repositoryRules: {
        ...DEFAULT_RULES,
        mustIncludeEnvExample: false,
        requireDeploymentUrl: false,
        minimumCommits: 6,
      },
      evaluationWeights: {
        featureCompletion: 45,
        codeQuality: 20,
        architecture: 10,
        security: 5,
        gitPractices: 10,
        documentation: 10,
      },
      description: `
<p>Build a <strong>placement outcomes analytics</strong> project using a synthetic campus dataset (you must generate or include a CSV with at least 400 student rows).</p>
<h3>Minimum columns</h3>
<p>student_id, gender, program, cgpa, internships, english_score, coding_score, aptitude_score, placed (yes/no), package_lpa (null if not placed), company_tier (1/2/3/na).</p>
<h3>Deliverables</h3>
<ul>
<li>A reproducible notebook or Python package that loads data, cleans it, and produces a written findings summary</li>
<li>At least four charts (placement rate by program, CGPA vs package, skill scores vs placed, etc.)</li>
<li>A simple baseline model that predicts <code>placed</code> (logistic regression or similar) with a train/test split and metrics (accuracy, precision/recall or ROC-AUC)</li>
<li>Clear caveats: synthetic data, leakage checks, no production hiring claims</li>
</ul>
      `.trim(),
      additionalInstructions: `
Do not upload a notebook with empty outputs only — either commit executed outputs or a PDF/Markdown export of key charts. Include requirements.txt. Do not commit huge virtualenvs. Document how to regenerate the synthetic data if you use a generator script.
      `.trim(),
      featureChecklist: [
        feature('Dataset ≥400 rows with the required columns, documented in README', 12, true, 'Include data/ folder or a generator script with a fixed seed.'),
        feature('Cleaning: missing values, types, obvious outliers explained', 12, true, 'Show before/after counts; do not silently drop half the rows.'),
        feature('EDA with at least four labelled charts', 16, true, 'Charts must have titles and axis labels; saved as images or notebook outputs.'),
        feature('Placement insights written in Markdown (not charts alone)', 12, true, 'At least 5 bullet findings tied to the plots.'),
        feature('Baseline classifier for placed with train/test split and metrics', 18, true, 'No test-set leakage; report at least accuracy and one ranking/class metric.'),
        feature('Feature importance or coefficient discussion', 8, false, 'Explain what the model actually used.'),
        feature('Reproducible env (requirements.txt) and README', 12, true, 'One-command or two-command run from a clean venv.'),
        feature('Git history without huge binaries', 10, true, 'At least 6 commits; no .venv in the repo.'),
      ],
    },
    {
      title: TITLES[4],
      category: 'devops',
      difficulty: 'hard',
      duration: 180,
      totalMarks: 100,
      allowedTechStack: ['Docker', 'Docker Compose', 'GitHub Actions', 'Node.js', 'Nginx'],
      repositoryRules: { ...DEFAULT_RULES, mustIncludeEnvExample: true, minimumCommits: 7 },
      evaluationWeights: {
        featureCompletion: 40,
        codeQuality: 15,
        architecture: 20,
        security: 10,
        gitPractices: 10,
        documentation: 5,
      },
      description: `
<p>Take a small <strong>Node.js REST API</strong> (you may write a minimal assignments/health API) and make it <strong>production-shaped</strong>: Docker, Compose, CI, and documented deploy steps.</p>
<h3>The API itself can be simple</h3>
<p>Health check, CRUD for a <code>tickets</code> resource, and JWT or a static admin token for mutating routes. The marks are mostly on packaging, CI, and operational hygiene — not on a large product.</p>
<h3>Required operational pieces</h3>
<ul>
<li>Multi-stage Dockerfile, non-root user, .dockerignore</li>
<li>docker-compose: api + database, named volumes, healthchecks</li>
<li>GitHub Actions: install, test, docker build on PR</li>
<li>No secrets in the repo; example env files only</li>
</ul>
      `.trim(),
      additionalInstructions: `
README must include architecture (how containers talk), how to run with Compose, how CI is triggered, and a security notes section (image tags, secrets, ports). Pin base image versions. A failing test in CI that you never fix will cost marks.
      `.trim(),
      featureChecklist: [
        feature('Working API with health and one authenticated CRUD resource', 14, true, 'Documented with example curl; tests cover at least happy path.'),
        feature('Multi-stage Dockerfile, non-root user, .dockerignore', 16, true, 'Final image does not include devDependencies unnecessarily.'),
        feature('Compose file: API + DB, healthchecks, restart policy', 16, true, 'One command brings the stack up on a clean machine with Docker.'),
        feature('GitHub Actions: lint/test and docker build', 16, true, 'Workflow YAML is in the repo and would run on pull_request or push.'),
        feature('Env hygiene: .env.example, secrets not committed', 10, true, 'CI uses GitHub secrets placeholders in docs, not real keys.'),
        feature('Basic observability: structured logs or request ids', 8, false, 'Enough to debug a failed request from logs.'),
        feature('README architecture + runbook', 12, true, 'Includes ports, volumes, and how to reset the DB volume.'),
        feature('Git history showing incremental DevOps work', 8, true, 'At least 7 commits; Dockerfile not introduced only in the last commit with everything else.'),
      ],
    },
  ].map((a) => ({
    ...a,
    vendorId,
    createdBy,
    source: 'vendor',
    status: 'active',
    assignmentType: 'individual',
    deadline: DEADLINE,
    evaluationWeights: a.evaluationWeights || { ...DEFAULT_WEIGHTS },
    repositoryRules: a.repositoryRules,
    totalAssigned: 0,
    totalSubmitted: 0,
    totalEvaluated: 0,
  }));
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.findOne({ email: SOURCE_EMAIL, role: 'vendor_admin', isActive: true });
  if (!admin?.vendorId) throw new Error(`Vendor admin not found: ${SOURCE_EMAIL}`);

  const existing = await Assignment.find({ vendorId: admin.vendorId, title: { $in: TITLES } }).select('title').lean();
  if (existing.length) {
    throw new Error(`Demo assignments already exist: ${existing.map((a) => a.title).join('; ')}`);
  }

  const docs = assignments(admin.vendorId, admin._id);
  docs.forEach(assertMarks);

  const created = await Assignment.insertMany(docs);
  const verify = await Assignment.find({ vendorId: admin.vendorId, title: { $in: TITLES } }).lean();
  if (verify.length !== 5) throw new Error(`Expected 5 assignments, found ${verify.length}`);

  for (const a of verify) {
    if (a.status !== 'active') throw new Error(`${a.title} not active`);
    if (!a.featureChecklist?.length) throw new Error(`${a.title} missing features`);
    const sum = a.featureChecklist.reduce((s, f) => s + f.marks, 0);
    if (sum !== a.totalMarks) throw new Error(`${a.title} marks mismatch`);
    if ((a.totalAssigned || 0) !== 0) throw new Error(`${a.title} unexpectedly assigned`);
    if (!a.deadline || new Date(a.deadline) <= new Date()) throw new Error(`${a.title} deadline not in the future`);
  }

  console.log(JSON.stringify({
    ok: true,
    assignments: verify.map((a) => ({
      title: a.title,
      category: a.category,
      difficulty: a.difficulty,
      duration: a.duration,
      totalMarks: a.totalMarks,
      features: a.featureChecklist.length,
      requiredFeatures: a.featureChecklist.filter((f) => f.required).length,
      tech: a.allowedTechStack,
      status: a.status,
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
