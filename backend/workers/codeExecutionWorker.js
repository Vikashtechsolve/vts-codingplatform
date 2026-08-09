const Queue = require('bull');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { getBullQueueOptions } = require('../config/redis');
const {
  CODE_EXECUTION_SINGLE,
  CODE_EXECUTION_BATCH
} = require('../config/bullQueueNames');
const {
  EXECUTION_TIMEOUT,
  WORKER_SINGLE_CONCURRENCY,
  WORKER_BATCH_CONCURRENCY,
  BATCH_CASE_PARALLELISM,
} = require('../config/codeExecution');

// --- Configuration ---
const TEMP_DIR = path.join(__dirname, '../temp');
const MAX_OUTPUT_SIZE = 64 * 1024;
const CLEANUP_INTERVAL = 2 * 60 * 1000;
const MAX_FILE_AGE = 5 * 60 * 1000;

// --- Bull Queues ---
const singleQueue = new Queue(CODE_EXECUTION_SINGLE, getBullQueueOptions());
const batchQueue = new Queue(CODE_EXECUTION_BATCH, getBullQueueOptions());

singleQueue.on('ready', () => console.log('  Single-execution queue ready.'));
batchQueue.on('ready', () => console.log('  Batch-execution queue ready.'));

let lastErrorLog = 0;
function logQueueError(err) {
  const now = Date.now();
  if (now - lastErrorLog > 60000) {
    lastErrorLog = now;
    console.error('Redis queue error:', err.message);
  }
}
singleQueue.on('error', logQueueError);
batchQueue.on('error', logQueueError);

// --- Temp directory cleanup ---
function cleanupTempDir() {
  if (!fs.existsSync(TEMP_DIR)) return;
  const now = Date.now();
  try {
    for (const entry of fs.readdirSync(TEMP_DIR)) {
      const entryPath = path.join(TEMP_DIR, entry);
      try {
        const stat = fs.statSync(entryPath);
        if (now - stat.mtimeMs > MAX_FILE_AGE) {
          fs.rmSync(entryPath, { recursive: true, force: true });
        }
      } catch { /* skip */ }
    }
  } catch (err) {
    console.error('Temp cleanup error:', err.message);
  }
}

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function cleanupFiles(...paths) {
  for (const p of paths) {
    try { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); } catch { /* */ }
  }
}

cleanupTempDir();
setInterval(cleanupTempDir, CLEANUP_INTERVAL);

// --- Process runner with output cap + timeout ---
function runProcess(cmd, args, opts, input) {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    const spawnOpts = {
      stdio: ['pipe', 'pipe', 'pipe'],
      ...opts,
    };
    // Own process group on Unix so timeouts kill child processes spawned by student code.
    if (!isWin) {
      spawnOpts.detached = true;
    }

    const proc = spawn(cmd, args, spawnOpts);
    let output = '';
    let error = '';
    let outputSize = 0;
    let killed = false;
    const startTime = Date.now();

    const killProcessTree = () => {
      if (killed) return;
      killed = true;
      try {
        if (!isWin && proc.pid) {
          process.kill(-proc.pid, 'SIGKILL');
        } else {
          proc.kill('SIGKILL');
        }
      } catch {
        try {
          proc.kill('SIGKILL');
        } catch {
          /* already exited */
        }
      }
    };

    if (input) {
      proc.stdin.write(input);
    }
    proc.stdin.end();

    proc.stdout.on('data', (data) => {
      outputSize += data.length;
      if (outputSize <= MAX_OUTPUT_SIZE) {
        output += data.toString();
      } else if (!killed) {
        killProcessTree();
      }
    });

    proc.stderr.on('data', (data) => {
      if (error.length < MAX_OUTPUT_SIZE) error += data.toString();
    });

    const timeoutId = setTimeout(killProcessTree, EXECUTION_TIMEOUT);

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      const executionTime = Date.now() - startTime;
      if (killed && outputSize > MAX_OUTPUT_SIZE) {
        resolve({ success: false, output: output.trim(), error: 'Output size limit exceeded (64 KB max)', executionTime });
      } else if (killed) {
        resolve({ success: false, output: output.trim(), error: `Execution timeout (${EXECUTION_TIMEOUT}ms exceeded)`, executionTime });
      } else {
        resolve({ success: code === 0, output: output.trim(), error: error.trim(), executionTime });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

// --- Language helpers ---
function preparePython(code, id) {
  const filePath = path.join(TEMP_DIR, `code_${id}.py`);
  fs.writeFileSync(filePath, code);
  return { type: 'interpreted', filePath, cleanup: [filePath] };
}

function prepareJava(code, id) {
  const classMatch = code.match(/public\s+class\s+(\w+)/);
  let className = 'Solution';
  let modifiedCode = code;

  if (classMatch) {
    className = classMatch[1];
  } else {
    const lines = code.split('\n');
    const imports = [];
    const codeLines = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('import ') && trimmed.endsWith(';')) imports.push(trimmed);
      else codeLines.push(line);
    }
    const importSection = imports.length > 0 ? imports.join('\n') + '\n\n' : '';
    const nonEmpty = codeLines.filter(l => l.trim().length > 0);
    const wrapped = nonEmpty.map(l => '        ' + l).join('\n');
    modifiedCode = `${importSection}public class Solution {\n    public static void main(String[] args) {\n${wrapped}\n    }\n}`;
  }

  const execDir = path.join(TEMP_DIR, `java_${id}`);
  fs.mkdirSync(execDir, { recursive: true });
  const filePath = path.join(execDir, `${className}.java`);
  fs.writeFileSync(filePath, modifiedCode);
  return { type: 'java', filePath, execDir, className, cleanup: [execDir] };
}

function prepareCpp(code, id) {
  const filePath = path.join(TEMP_DIR, `code_${id}.cpp`);
  const executablePath = path.join(TEMP_DIR, `code_${id}_bin`);
  fs.writeFileSync(filePath, code);
  return { type: 'compiled', filePath, executablePath, compiler: 'g++', compilerName: 'G++', cleanup: [filePath, executablePath] };
}

function prepareC(code, id) {
  const filePath = path.join(TEMP_DIR, `code_${id}.c`);
  const executablePath = path.join(TEMP_DIR, `code_${id}_bin`);
  fs.writeFileSync(filePath, code);
  return { type: 'compiled', filePath, executablePath, compiler: 'gcc', compilerName: 'GCC', cleanup: [filePath, executablePath] };
}

function prepareCode(code, language, id) {
  switch (language) {
    case 'python': return preparePython(code, id);
    case 'java':   return prepareJava(code, id);
    case 'cpp':    return prepareCpp(code, id);
    case 'c':      return prepareC(code, id);
    default: throw new Error('Unsupported language');
  }
}

async function compileCode(prepared) {
  if (prepared.type === 'interpreted') return { success: true };

  if (prepared.type === 'java') {
    try {
      const r = await runProcess('javac', [prepared.filePath], { cwd: prepared.execDir }, null);
      return r.success ? { success: true } : { success: false, error: r.error || 'Compilation failed' };
    } catch (err) {
      if (err.code === 'ENOENT') return { success: false, error: 'Java compiler (javac) not found.' };
      return { success: false, error: `Compilation error: ${err.message}` };
    }
  }

  if (prepared.type === 'compiled') {
    try {
      const r = await runProcess(prepared.compiler, [prepared.filePath, '-o', prepared.executablePath], {}, null);
      return r.success ? { success: true } : { success: false, error: r.error || 'Compilation failed' };
    } catch (err) {
      if (err.code === 'ENOENT') return { success: false, error: `${prepared.compilerName} compiler not found.` };
      return { success: false, error: `Compilation error: ${err.message}` };
    }
  }
  return { success: false, error: 'Unknown language type' };
}

async function runCode(prepared, input) {
  if (prepared.type === 'interpreted') {
    const cmd = process.platform === 'win32' ? 'python' : 'python3';
    try {
      return await runProcess(cmd, [prepared.filePath], { cwd: path.dirname(prepared.filePath) }, input);
    } catch (err) {
      if (err.code === 'ENOENT') throw new Error('Python 3 not found.');
      throw err;
    }
  }
  if (prepared.type === 'java') {
    try {
      return await runProcess('java', ['-cp', prepared.execDir, prepared.className], {}, input);
    } catch (err) {
      if (err.code === 'ENOENT') throw new Error('Java runtime not found.');
      throw err;
    }
  }
  if (prepared.type === 'compiled') {
    return await runProcess(prepared.executablePath, [], {}, input);
  }
  throw new Error('Unknown language type');
}

const normalize = (s) => (s || '').trim().replace(/\r\n/g, '\n').replace(/\s+$/gm, '');

/** Run async tasks with a fixed concurrency pool. */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex;
      nextIndex += 1;
      results[i] = await fn(items[i], i);
    }
  }

  const pool = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: pool }, () => worker()));
  return results;
}

// --- Single execution processor ---
singleQueue.process(WORKER_SINGLE_CONCURRENCY, async (job) => {
  const { code, language, input } = job.data;
  ensureTempDir();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${job.id}`;
  let prepared;
  try {
    prepared = prepareCode(code, language, id);
    const comp = await compileCode(prepared);
    if (!comp.success) {
      return { success: false, output: '', error: comp.error, executionTime: 0 };
    }
    return await runCode(prepared, input || '');
  } catch (err) {
    return { success: false, output: '', error: err.message || 'Execution failed', executionTime: 0 };
  } finally {
    if (prepared) cleanupFiles(...prepared.cleanup);
  }
});

// --- Batch execution processor (compile once, run N test cases) ---
batchQueue.process(WORKER_BATCH_CONCURRENCY, async (job) => {
  const { code, language, testCases } = job.data;
  const n = Array.isArray(testCases) ? testCases.length : 0;
  console.log(`[code-worker] batch job ${job.id} start (${n} cases, ${language})`);
  ensureTempDir();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${job.id}`;
  let prepared;
  try {
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return { success: false, error: 'Missing or empty testCases', results: [], testCasesPassed: 0, total: 0 };
    }
    prepared = prepareCode(code, language, id);

    const comp = await compileCode(prepared);
    if (!comp.success) {
      const cases = Array.isArray(testCases) ? testCases : [];
      const failedResults = cases.map(() => ({
        success: false, output: '', error: comp.error, executionTime: 0, passed: false
      }));
      return {
        success: false,
        compilationError: comp.error,
        results: failedResults,
        testCasesPassed: 0,
        total: cases.length
      };
    }

    const caseResults = await mapWithConcurrency(
      testCases,
      BATCH_CASE_PARALLELISM,
      async (tc) => {
        try {
          const r = await runCode(prepared, tc.input || '');
          const tcPassed = r.success && normalize(tc.expectedOutput) === normalize(r.output);
          return {
            success: r.success,
            output: r.output,
            error: r.error,
            executionTime: r.executionTime,
            passed: tcPassed,
          };
        } catch (err) {
          return {
            success: false,
            output: '',
            error: err.message || 'Execution failed',
            executionTime: 0,
            passed: false,
          };
        }
      }
    );

    const results = caseResults;
    let passed = 0;
    for (const r of results) {
      if (r.passed) passed += 1;
    }

    return { success: true, results, testCasesPassed: passed, total: testCases.length };
  } catch (err) {
    console.error(`[code-worker] batch job ${job.id} error:`, err.message);
    return { success: false, error: err.message || 'Execution failed', results: [], testCasesPassed: 0, total: 0 };
  } finally {
    if (prepared) cleanupFiles(...prepared.cleanup);
  }
});

// --- Event handlers ---
singleQueue.on('completed', (job) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`  Single job ${job.id} done (${job.returnvalue?.executionTime || 0}ms)`);
  }
});
singleQueue.on('failed', (job, err) => console.error(`  Single job ${job.id} failed:`, err.message));

batchQueue.on('completed', (job) => {
  const rv = job.returnvalue;
  const passed = rv?.testCasesPassed ?? '?';
  const total = rv?.total ?? '?';
  let detail = '';
  if (rv?.compilationError) {
    detail = ` — compile: ${rv.compilationError}`;
  } else if (Array.isArray(rv?.results)) {
    const firstErr = rv.results.find((r) => r && r.error);
    if (firstErr?.error) detail = ` — error: ${firstErr.error}`;
  } else if (rv?.error) {
    detail = ` — error: ${rv.error}`;
  }
  console.log(`[code-worker] batch job ${job.id} done: ${passed}/${total} passed${detail}`);
});
batchQueue.on('failed', (job, err) => console.error(`  Batch job ${job.id} failed:`, err.message));

// Standalone: `node workers/codeExecutionWorker.js`. Embedded in API: server.js owns SIGTERM/SIGINT.
const isStandaloneCodeWorkerProcess = require.main === module;

let closeCodeQueuesPromise = null;
async function closeCodeExecutionQueues() {
  if (closeCodeQueuesPromise) return closeCodeQueuesPromise;
  closeCodeQueuesPromise = (async () => {
    try {
      await Promise.all([
        singleQueue.close().catch((err) => {
          console.error('singleQueue.close error:', err && err.message ? err.message : err);
        }),
        batchQueue.close().catch((err) => {
          console.error('batchQueue.close error:', err && err.message ? err.message : err);
        })
      ]);
    } catch (err) {
      console.error('closeCodeExecutionQueues error:', err && err.message ? err.message : err);
    }
  })();
  return closeCodeQueuesPromise;
}

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down code execution worker...`);
  try {
    await closeCodeExecutionQueues();
  } catch (err) {
    console.error('Shutdown error:', err && err.message ? err.message : err);
  }
  process.exit(0);
}
function onShutdownSignal(signal) {
  void shutdown(signal).catch((err) => {
    console.error('Fatal shutdown error:', err && err.message ? err.message : err);
    process.exit(1);
  });
}
if (isStandaloneCodeWorkerProcess) {
  process.on('SIGTERM', () => onShutdownSignal('SIGTERM'));
  process.on('SIGINT', () => onShutdownSignal('SIGINT'));
}

function toolchainPresent(cmd) {
  try {
    const { spawnSync } = require('child_process');
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', timeout: 5000 });
    return r.error?.code === 'ENOENT' ? false : r.status === 0 || r.status === null;
  } catch {
    return false;
  }
}

console.log('='.repeat(50));
console.log('Code Execution Worker Started');
console.log('='.repeat(50));
console.log(
  `  Toolchain: python3=${toolchainPresent('python3') ? 'ok' : 'MISSING'} ` +
    `javac=${toolchainPresent('javac') ? 'ok' : 'MISSING'} ` +
    `gcc=${toolchainPresent('gcc') ? 'ok' : 'MISSING'} ` +
    `g++=${toolchainPresent('g++') ? 'ok' : 'MISSING'}`
);
console.log(`  Single concurrency: ${WORKER_SINGLE_CONCURRENCY} parallel jobs`);
console.log(`  Batch concurrency: ${WORKER_BATCH_CONCURRENCY} parallel jobs`);
console.log(`  Batch case parallelism: ${BATCH_CASE_PARALLELISM} cases/job`);
console.log(`  Timeout: ${EXECUTION_TIMEOUT}ms per run`);
console.log(`  Output cap: ${MAX_OUTPUT_SIZE / 1024} KB`);
console.log(`  Temp dir: ${TEMP_DIR}`);
console.log(`  Queues: ${CODE_EXECUTION_SINGLE} | ${CODE_EXECUTION_BATCH}`);
console.log('  Waiting for jobs...\n');

module.exports = { singleQueue, batchQueue, closeCodeExecutionQueues };
