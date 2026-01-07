const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { auth } = require('../middleware/auth');

// Simple code execution service
// Note: In production, use a proper sandboxed execution environment

router.post('/execute', [
  auth,
  body('code').notEmpty().withMessage('Code is required'),
  body('language').isIn(['java', 'cpp', 'c', 'python']).withMessage('Invalid language'),
  body('input').optional()
], async (req, res) => {
  try {
    console.log('🔧 Code execution request:', { 
      language: req.body.language, 
      codeLength: req.body.code?.length,
      hasInput: !!req.body.input,
      userId: req.user?._id 
    });
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      const errorMessages = errors.array().map(e => e.msg).join(', ');
      return res.status(400).json({ 
        success: false,
        output: '',
        error: errorMessages,
        executionTime: 0
      });
    }

    const { code, language, input } = req.body;
    
    if (!code || !code.trim()) {
      return res.status(400).json({ 
        success: false,
        output: '',
        error: 'Code cannot be empty',
        executionTime: 0
      });
    }
    
    const tempDir = path.join(__dirname, '../temp');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log('📁 Created temp directory:', tempDir);
    }

    const timestamp = Date.now();
    let result;

    try {
      console.log(`▶️ Executing ${language} code...`);
      switch (language) {
        case 'python':
          result = await executePython(code, input || '', tempDir, timestamp);
          break;
        case 'java':
          result = await executeJava(code, input || '', tempDir, timestamp);
          break;
        case 'cpp':
          result = await executeCpp(code, input || '', tempDir, timestamp);
          break;
        case 'c':
          result = await executeC(code, input || '', tempDir, timestamp);
          break;
        default:
          return res.status(400).json({ 
            success: false,
            output: '',
            error: 'Unsupported language',
            executionTime: 0
          });
      }

      console.log('✅ Code executed:', { 
        success: result.success, 
        hasOutput: !!result.output, 
        hasError: !!result.error,
        executionTime: result.executionTime 
      });
      res.json(result);
    } catch (error) {
      console.error('❌ Code execution error:', error);
      res.status(500).json({
        success: false,
        output: '',
        error: error.message || 'Execution failed. Please check your code syntax.',
        executionTime: 0
      });
    }
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({ 
      success: false,
      output: '',
      error: error.message || 'Server error. Please try again.',
      executionTime: 0
    });
  }
});

function executePython(code, input, tempDir, timestamp) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(tempDir, `code_${timestamp}.py`);
    
    try {
      fs.writeFileSync(filePath, code);
      console.log('📝 Python file created:', filePath);
    } catch (err) {
      return reject(new Error(`Failed to create Python file: ${err.message}`));
    }

    const startTime = Date.now();
    let timeoutId;
    
    // Try python3 first, fallback to python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const pythonProcess = spawn(pythonCmd, [filePath]);

    let output = '';
    let error = '';

    if (input) {
      pythonProcess.stdin.write(input);
      pythonProcess.stdin.end();
    }

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    pythonProcess.on('close', (code) => {
      clearTimeout(timeoutId);
      const executionTime = Date.now() - startTime;
      
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error('Error cleaning up Python file:', err);
      }

      resolve({
        success: code === 0,
        output: output.trim(),
        error: error.trim(),
        executionTime
      });
    });

    pythonProcess.on('error', (err) => {
      clearTimeout(timeoutId);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupErr) {
        console.error('Error cleaning up Python file:', cleanupErr);
      }
      
      if (err.code === 'ENOENT') {
        reject(new Error(`Python interpreter not found. Please install Python 3.`));
      } else {
        reject(new Error(`Failed to execute Python: ${err.message}`));
      }
    });

    // Timeout after 5 seconds
    timeoutId = setTimeout(() => {
      pythonProcess.kill('SIGKILL');
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupErr) {
        console.error('Error cleaning up Python file:', cleanupErr);
      }
      reject(new Error('Execution timeout (5 seconds exceeded)'));
    }, 5000);
  });
}

function executeJava(code, input, tempDir, timestamp) {
  return new Promise((resolve, reject) => {
    // Extract class name from code
    const classMatch = code.match(/public\s+class\s+(\w+)/);
    let className = 'Solution';
    let modifiedCode = code;
    
    if (classMatch) {
      className = classMatch[1];
      // Code already has a class, use it as-is
      modifiedCode = code;
    } else {
      // If no public class found, extract imports and wrap the rest in Solution class
      const lines = code.split('\n');
      const imports = [];
      const codeLines = [];
      
      // Extract import statements (must be at the top level, not inside class)
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('import ') && trimmedLine.endsWith(';')) {
          imports.push(trimmedLine); // Use trimmed import (no indentation)
        } else {
          codeLines.push(line);
        }
      }
      
      // Build the modified code with imports at top level, then wrapped class
      const importSection = imports.length > 0 ? imports.join('\n') + '\n\n' : '';
      // Remove empty lines from codeLines and wrap non-empty lines
      const nonEmptyCodeLines = codeLines.filter(line => line.trim().length > 0);
      const wrappedCode = nonEmptyCodeLines.map(line => '        ' + line).join('\n');
      modifiedCode = `${importSection}public class Solution {\n    public static void main(String[] args) {\n${wrappedCode}\n    }\n}`;
    }
    
    // Create a unique subdirectory for this execution to avoid conflicts
    const execDir = path.join(tempDir, `java_${timestamp}`);
    if (!fs.existsSync(execDir)) {
      fs.mkdirSync(execDir, { recursive: true });
      console.log('📁 Created Java execution directory:', execDir);
    }
    
    // File name must match class name exactly (Java requirement)
    const filePath = path.join(execDir, `${className}.java`);
    
    try {
      fs.writeFileSync(filePath, modifiedCode);
      console.log('📝 Java file created:', filePath, 'Class:', className);
    } catch (err) {
      return reject(new Error(`Failed to create Java file: ${err.message}`));
    }

    const startTime = Date.now();
    let timeoutId;
    const compileProcess = spawn('javac', [filePath]);

    let compileError = '';

    compileProcess.stderr.on('data', (data) => {
      compileError += data.toString();
    });

    compileProcess.on('close', (compileCode) => {
      if (compileCode !== 0) {
        // Clean up directory
        if (fs.existsSync(execDir)) {
          try {
            fs.readdirSync(execDir).forEach(file => {
              fs.unlinkSync(path.join(execDir, file));
            });
            fs.rmdirSync(execDir);
          } catch (cleanupErr) {
            console.error('Error cleaning up:', cleanupErr);
          }
        }
        return resolve({
          success: false,
          output: '',
          error: compileError.trim() || 'Compilation failed',
          executionTime: Date.now() - startTime
        });
      }

      console.log('✅ Java compilation successful, running...');
      const classPath = execDir;
      const runProcess = spawn('java', ['-cp', classPath, className]);

      let output = '';
      let error = '';

      if (input) {
        runProcess.stdin.write(input);
        runProcess.stdin.end();
      }

      runProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      runProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      runProcess.on('close', (runCode) => {
        clearTimeout(timeoutId);
        const executionTime = Date.now() - startTime;
        // Clean up entire directory
        if (fs.existsSync(execDir)) {
          try {
            fs.readdirSync(execDir).forEach(file => {
              fs.unlinkSync(path.join(execDir, file));
            });
            fs.rmdirSync(execDir);
          } catch (err) {
            console.error('Error cleaning up Java execution directory:', err);
          }
        }

        resolve({
          success: runCode === 0,
          output: output.trim(),
          error: error.trim(),
          executionTime
        });
      });

      runProcess.on('error', (err) => {
        clearTimeout(timeoutId);
        // Clean up directory
        if (fs.existsSync(execDir)) {
          try {
            fs.readdirSync(execDir).forEach(file => {
              fs.unlinkSync(path.join(execDir, file));
            });
            fs.rmdirSync(execDir);
          } catch (cleanupErr) {
            console.error('Error cleaning up:', cleanupErr);
          }
        }
        
        if (err.code === 'ENOENT') {
          reject(new Error(`Java runtime not found. Please install Java.`));
        } else {
          reject(new Error(`Failed to execute Java: ${err.message}`));
        }
      });

      timeoutId = setTimeout(() => {
        runProcess.kill('SIGKILL');
        // Clean up directory
        if (fs.existsSync(execDir)) {
          try {
            fs.readdirSync(execDir).forEach(file => {
              fs.unlinkSync(path.join(execDir, file));
            });
            fs.rmdirSync(execDir);
          } catch (cleanupErr) {
            console.error('Error cleaning up:', cleanupErr);
          }
        }
        reject(new Error('Execution timeout (5 seconds exceeded)'));
      }, 5000);
    });

    compileProcess.on('error', (err) => {
      // Clean up directory
      if (fs.existsSync(execDir)) {
        try {
          fs.readdirSync(execDir).forEach(file => {
            fs.unlinkSync(path.join(execDir, file));
          });
          fs.rmdirSync(execDir);
        } catch (cleanupErr) {
          console.error('Error cleaning up:', cleanupErr);
        }
      }
      
      if (err.code === 'ENOENT') {
        reject(new Error(`Java compiler (javac) not found. Please install Java JDK.`));
      } else {
        reject(new Error(`Failed to compile Java: ${err.message}`));
      }
    });
  });
}

function executeCpp(code, input, tempDir, timestamp) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(tempDir, `code_${timestamp}.cpp`);
    const executablePath = path.join(tempDir, `code_${timestamp}`);
    
    fs.writeFileSync(filePath, code);

    const startTime = Date.now();
    const compileProcess = spawn('g++', [filePath, '-o', executablePath]);

    let compileError = '';

    compileProcess.stderr.on('data', (data) => {
      compileError += data.toString();
    });

    compileProcess.on('close', (compileCode) => {
      if (compileCode !== 0) {
        fs.unlinkSync(filePath);
        return resolve({
          success: false,
          output: '',
          error: compileError.trim(),
          executionTime: Date.now() - startTime
        });
      }

      const runProcess = spawn(executablePath);

      let output = '';
      let error = '';

      if (input) {
        runProcess.stdin.write(input);
        runProcess.stdin.end();
      }

      runProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      runProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      runProcess.on('close', (runCode) => {
        const executionTime = Date.now() - startTime;
        fs.unlinkSync(filePath);
        if (fs.existsSync(executablePath)) fs.unlinkSync(executablePath);

        resolve({
          success: runCode === 0,
          output: output.trim(),
          error: error.trim(),
          executionTime
        });
      });

      runProcess.on('error', (err) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(executablePath)) fs.unlinkSync(executablePath);
        reject(err);
      });

      setTimeout(() => {
        runProcess.kill();
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(executablePath)) fs.unlinkSync(executablePath);
        reject(new Error('Execution timeout'));
      }, 5000);
    });
  });
}

function executeC(code, input, tempDir, timestamp) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(tempDir, `code_${timestamp}.c`);
    const executablePath = path.join(tempDir, `code_${timestamp}`);
    
    fs.writeFileSync(filePath, code);

    const startTime = Date.now();
    const compileProcess = spawn('gcc', [filePath, '-o', executablePath]);

    let compileError = '';

    compileProcess.stderr.on('data', (data) => {
      compileError += data.toString();
    });

    compileProcess.on('close', (compileCode) => {
      if (compileCode !== 0) {
        fs.unlinkSync(filePath);
        return resolve({
          success: false,
          output: '',
          error: compileError.trim(),
          executionTime: Date.now() - startTime
        });
      }

      const runProcess = spawn(executablePath);

      let output = '';
      let error = '';

      if (input) {
        runProcess.stdin.write(input);
        runProcess.stdin.end();
      }

      runProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      runProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      runProcess.on('close', (runCode) => {
        const executionTime = Date.now() - startTime;
        fs.unlinkSync(filePath);
        if (fs.existsSync(executablePath)) fs.unlinkSync(executablePath);

        resolve({
          success: runCode === 0,
          output: output.trim(),
          error: error.trim(),
          executionTime
        });
      });

      runProcess.on('error', (err) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(executablePath)) fs.unlinkSync(executablePath);
        reject(err);
      });

      setTimeout(() => {
        runProcess.kill();
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(executablePath)) fs.unlinkSync(executablePath);
        reject(new Error('Execution timeout'));
      }, 5000);
    });
  });
}

module.exports = router;

