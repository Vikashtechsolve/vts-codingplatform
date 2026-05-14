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

// --- Configuration ---
const TEMP_DIR = path.join(__dirname, '../temp');
const MAX_OUTPUT_SIZE = 64 * 1024;
const EXECUTION_TIMEOUT = parseInt(process.env.CODE_EXECUTION_TIMEOUT || '5000', 10);
const WORKER_CONCURRENCY = parseInt(process.env.CODE_WORKER_CONCURRENCY || '8', 10);
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
    const proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], ...opts });
    let output = '';
    let error = '';
    let outputSize = 0;
    let killed = false;
    const startTime = Date.now();

    if (input) { proc.stdin.write(input); }
    proc.stdin.end();

    proc.stdout.on('data', (data) => {
      outputSize += data.length;
      if (outputSize <= MAX_OUTPUT_SIZE) {
        output += data.toString();
      } else if (!killed) {
        killed = true;
        proc.kill('SIGKILL');
      }
    });

    proc.stderr.on('data', (data) => {
      if (error.length < MAX_OUTPUT_SIZE) error += data.toString();
    });

    const timeoutId = setTimeout(() => {
      if (!killed) { killed = true; proc.kill('SIGKILL'); }
    }, EXECUTION_TIMEOUT);

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

    proc.on('error', (err) => { clearTimeout(timeoutId); reject(err); });
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

// --- Single execution processor ---
singleQueue.process(WORKER_CONCURRENCY, async (job) => {
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
batchQueue.process(WORKER_CONCURRENCY, async (job) => {
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

    const results = [];
    let passed = 0;

    for (const tc of testCases) {
      try {
        const r = await runCode(prepared, tc.input || '');
        const tcPassed = r.success && normalize(tc.expectedOutput) === normalize(r.output);
        if (tcPassed) passed++;
        results.push({ success: r.success, output: r.output, error: r.error, executionTime: r.executionTime, passed: tcPassed });
      } catch (err) {
        results.push({ success: false, output: '', error: err.message || 'Execution failed', executionTime: 0, passed: false });
      }
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
  console.log(`[code-worker] batch job ${job.id} done: ${rv?.testCasesPassed ?? '?'}/${rv?.total ?? '?'} passed`);
});
batchQueue.on('failed', (job, err) => console.error(`  Batch job ${job.id} failed:`, err.message));

// --- Graceful shutdown ---
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down code execution worker...`);
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
process.on('SIGTERM', () => onShutdownSignal('SIGTERM'));
process.on('SIGINT', () => onShutdownSignal('SIGINT'));

console.log('='.repeat(50));
console.log('Code Execution Worker Started');
console.log('='.repeat(50));
console.log(`  Concurrency: ${WORKER_CONCURRENCY} parallel jobs`);
console.log(`  Timeout: ${EXECUTION_TIMEOUT}ms per run`);
console.log(`  Output cap: ${MAX_OUTPUT_SIZE / 1024} KB`);
console.log(`  Temp dir: ${TEMP_DIR}`);
console.log(`  Queues: ${CODE_EXECUTION_SINGLE} | ${CODE_EXECUTION_BATCH}`);
console.log('  Waiting for jobs...\n');

module.exports = { singleQueue, batchQueue };
