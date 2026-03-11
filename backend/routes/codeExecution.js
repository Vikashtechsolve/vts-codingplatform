const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { auth } = require('../middleware/auth');

const TEMP_DIR = path.join(__dirname, '../temp');
const MAX_OUTPUT_SIZE = 64 * 1024; // 64 KB max output per execution
const EXECUTION_TIMEOUT = parseInt(process.env.CODE_EXECUTION_TIMEOUT || '5000', 10);
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '5', 10);
const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || '50', 10);
const CLEANUP_INTERVAL = 2 * 60 * 1000; // 2 minutes
const MAX_FILE_AGE = 5 * 60 * 1000; // 5 minutes

// --- Fix 2: Concurrency-limited execution queue ---
let activeExecutions = 0;
const waitQueue = [];

function acquireSlot() {
  return new Promise((resolve) => {
    if (activeExecutions < MAX_CONCURRENT) {
      activeExecutions++;
      return resolve();
    }
    waitQueue.push(resolve);
  });
}

function releaseSlot() {
  activeExecutions--;
  if (waitQueue.length > 0) {
    activeExecutions++;
    const next = waitQueue.shift();
    next();
  }
}

function getQueueDepth() {
  return waitQueue.length;
}

// --- Fix 5: Temp directory cleanup ---
function cleanupTempDir() {
  if (!fs.existsSync(TEMP_DIR)) return;
  const now = Date.now();
  try {
    fs.readdirSync(TEMP_DIR).forEach(entry => {
      if (entry === '.write-test') return;
      const entryPath = path.join(TEMP_DIR, entry);
      try {
        const stat = fs.statSync(entryPath);
        if (now - stat.mtimeMs > MAX_FILE_AGE) {
          fs.rmSync(entryPath, { recursive: true, force: true });
        }
      } catch { /* ignore individual file errors */ }
    });
  } catch (err) {
    console.error('Temp cleanup error:', err.message);
  }
}

cleanupTempDir();
setInterval(cleanupTempDir, CLEANUP_INTERVAL);

// --- Fix 3: Helper to run a process with output size cap ---
function runProcess(cmd, args, opts, input) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], ...opts });
    let output = '';
    let error = '';
    let outputSize = 0;
    let killed = false;
    const startTime = Date.now();

    if (input) {
      proc.stdin.write(input);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }

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
      const chunk = data.toString();
      if (error.length < MAX_OUTPUT_SIZE) {
        error += chunk;
      }
    });

    const timeoutId = setTimeout(() => {
      if (!killed) {
        killed = true;
        proc.kill('SIGKILL');
      }
    }, EXECUTION_TIMEOUT);

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      if (killed && outputSize > MAX_OUTPUT_SIZE) {
        resolve({
          success: false,
          output: output.trim(),
          error: 'Output size limit exceeded (64 KB max)',
          executionTime: Date.now() - startTime
        });
      } else if (killed) {
        resolve({
          success: false,
          output: output.trim(),
          error: `Execution timeout (${EXECUTION_TIMEOUT}ms exceeded)`,
          executionTime: Date.now() - startTime
        });
      } else {
        resolve({
          success: code === 0,
          output: output.trim(),
          error: error.trim(),
          executionTime: Date.now() - startTime
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

// --- Helpers to ensure temp dir is ready ---
function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function cleanupFiles(...paths) {
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
    } catch { /* best effort */ }
  }
}

// --- Language-specific compile + run helpers ---

function preparePython(code, tempDir, id) {
  const filePath = path.join(tempDir, `code_${id}.py`);
  fs.writeFileSync(filePath, code);
  return { type: 'interpreted', filePath, cleanup: [filePath] };
}

function prepareJava(code, tempDir, id) {
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
      if (trimmed.startsWith('import ') && trimmed.endsWith(';')) {
        imports.push(trimmed);
      } else {
        codeLines.push(line);
      }
    }
    const importSection = imports.length > 0 ? imports.join('\n') + '\n\n' : '';
    const nonEmpty = codeLines.filter(l => l.trim().length > 0);
    const wrapped = nonEmpty.map(l => '        ' + l).join('\n');
    modifiedCode = `${importSection}public class Solution {\n    public static void main(String[] args) {\n${wrapped}\n    }\n}`;
  }

  const execDir = path.join(tempDir, `java_${id}`);
  fs.mkdirSync(execDir, { recursive: true });
  const filePath = path.join(execDir, `${className}.java`);
  fs.writeFileSync(filePath, modifiedCode);
  return { type: 'java', filePath, execDir, className, cleanup: [execDir] };
}

function prepareCpp(code, tempDir, id) {
  const filePath = path.join(tempDir, `code_${id}.cpp`);
  const executablePath = path.join(tempDir, `code_${id}_bin`);
  fs.writeFileSync(filePath, code);
  return { type: 'compiled', filePath, executablePath, compiler: 'g++', compilerName: 'G++', cleanup: [filePath, executablePath] };
}

function prepareC(code, tempDir, id) {
  const filePath = path.join(tempDir, `code_${id}.c`);
  const executablePath = path.join(tempDir, `code_${id}_bin`);
  fs.writeFileSync(filePath, code);
  return { type: 'compiled', filePath, executablePath, compiler: 'gcc', compilerName: 'GCC', cleanup: [filePath, executablePath] };
}

async function compileCode(prepared) {
  if (prepared.type === 'interpreted') return { success: true };

  if (prepared.type === 'java') {
    try {
      const result = await runProcess('javac', [prepared.filePath], { cwd: prepared.execDir }, null);
      if (!result.success) {
        return { success: false, error: result.error || 'Compilation failed' };
      }
      return { success: true };
    } catch (err) {
      if (err.code === 'ENOENT') return { success: false, error: 'Java compiler (javac) not found on server.' };
      return { success: false, error: `Compilation error: ${err.message}` };
    }
  }

  if (prepared.type === 'compiled') {
    try {
      const result = await runProcess(prepared.compiler, [prepared.filePath, '-o', prepared.executablePath], {}, null);
      if (!result.success) {
        return { success: false, error: result.error || 'Compilation failed' };
      }
      return { success: true };
    } catch (err) {
      if (err.code === 'ENOENT') return { success: false, error: `${prepared.compilerName} compiler not found on server.` };
      return { success: false, error: `Compilation error: ${err.message}` };
    }
  }

  return { success: false, error: 'Unknown language type' };
}

async function runCode(prepared, input) {
  if (prepared.type === 'interpreted') {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    try {
      return await runProcess(pythonCmd, [prepared.filePath], { cwd: path.dirname(prepared.filePath) }, input);
    } catch (err) {
      if (err.code === 'ENOENT') throw new Error('Python interpreter not found. Please install Python 3.');
      throw err;
    }
  }

  if (prepared.type === 'java') {
    try {
      return await runProcess('java', ['-cp', prepared.execDir, prepared.className], {}, input);
    } catch (err) {
      if (err.code === 'ENOENT') throw new Error('Java runtime not found on server.');
      throw err;
    }
  }

  if (prepared.type === 'compiled') {
    return await runProcess(prepared.executablePath, [], {}, input);
  }

  throw new Error('Unknown language type');
}

function prepareCode(code, language, tempDir, id) {
  switch (language) {
    case 'python': return preparePython(code, tempDir, id);
    case 'java': return prepareJava(code, tempDir, id);
    case 'cpp': return prepareCpp(code, tempDir, id);
    case 'c': return prepareC(code, tempDir, id);
    default: throw new Error('Unsupported language');
  }
}

// --- Single execution endpoint (kept for custom test cases) ---
router.post('/execute', [
  auth,
  body('code').notEmpty().withMessage('Code is required'),
  body('language').isIn(['java', 'cpp', 'c', 'python']).withMessage('Invalid language'),
  body('input').optional()
], async (req, res) => {
  if (getQueueDepth() >= MAX_QUEUE_SIZE) {
    return res.status(429).json({
      success: false, output: '', error: 'Server busy. Please try again in a moment.', executionTime: 0
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false, output: '', error: errors.array().map(e => e.msg).join(', '), executionTime: 0
    });
  }

  const { code, language, input } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, output: '', error: 'Code cannot be empty', executionTime: 0 });
  }

  await acquireSlot();
  let prepared;
  try {
    ensureTempDir();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    prepared = prepareCode(code, language, TEMP_DIR, id);

    const compileResult = await compileCode(prepared);
    if (!compileResult.success) {
      return res.json({ success: false, output: '', error: compileResult.error, executionTime: 0 });
    }

    const result = await runCode(prepared, input || '');
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false, output: '', error: error.message || 'Execution failed.', executionTime: 0
    });
  } finally {
    if (prepared) cleanupFiles(...prepared.cleanup);
    releaseSlot();
  }
});

// --- Fix 1: Batch test case execution endpoint ---
router.post('/execute-batch', [
  auth,
  body('code').notEmpty().withMessage('Code is required'),
  body('language').isIn(['java', 'cpp', 'c', 'python']).withMessage('Invalid language'),
  body('testCases').isArray({ min: 1, max: 50 }).withMessage('testCases must be an array (1-50 items)')
], async (req, res) => {
  if (getQueueDepth() >= MAX_QUEUE_SIZE) {
    return res.status(429).json({
      success: false, error: 'Server busy. Please try again in a moment.', results: []
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false, error: errors.array().map(e => e.msg).join(', '), results: []
    });
  }

  const { code, language, testCases } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, error: 'Code cannot be empty', results: [] });
  }

  await acquireSlot();
  let prepared;
  try {
    ensureTempDir();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    prepared = prepareCode(code, language, TEMP_DIR, id);

    const compileResult = await compileCode(prepared);
    if (!compileResult.success) {
      const failedResults = testCases.map(() => ({
        success: false, output: '', error: compileResult.error, executionTime: 0, passed: false
      }));
      return res.json({
        success: false,
        compilationError: compileResult.error,
        results: failedResults,
        testCasesPassed: 0,
        total: testCases.length
      });
    }

    const results = [];
    let passed = 0;

    for (const tc of testCases) {
      try {
        const result = await runCode(prepared, tc.input || '');
        const normalize = (s) => (s || '').trim().replace(/\r\n/g, '\n').replace(/\s+$/gm, '');
        const expectedNorm = normalize(tc.expectedOutput);
        const actualNorm = normalize(result.output);
        const tcPassed = result.success && expectedNorm === actualNorm;
        if (tcPassed) passed++;

        results.push({
          success: result.success,
          output: result.output,
          error: result.error,
          executionTime: result.executionTime,
          passed: tcPassed
        });
      } catch (err) {
        results.push({
          success: false, output: '', error: err.message || 'Execution failed', executionTime: 0, passed: false
        });
      }
    }

    res.json({
      success: true,
      results,
      testCasesPassed: passed,
      total: testCases.length
    });
  } catch (error) {
    res.status(500).json({
      success: false, error: error.message || 'Execution failed.', results: []
    });
  } finally {
    if (prepared) cleanupFiles(...prepared.cleanup);
    releaseSlot();
  }
});

module.exports = router;
