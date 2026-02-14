const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class GitHubCloner {
  constructor() {
    this.baseDir = path.join(__dirname, '../temp-repos');
  }

  /**
   * Initialize temp directory
   */
  async initTempDir() {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      console.error('Error creating temp directory:', error);
      throw error;
    }
  }

  /**
   * Clone a GitHub repository
   * @param {string} repoUrl - GitHub repository URL
   * @param {string} branch - Branch name to clone
   * @param {string} submissionId - Unique submission ID for folder naming
   * @returns {Promise<Object>} - Clone result with path and metadata
   */
  async cloneRepository(repoUrl, branch = 'main', submissionId) {
    await this.initTempDir();
    
    const repoPath = path.join(this.baseDir, submissionId);
    
    try {
      // Clean up if directory already exists
      await this.cleanupRepo(submissionId);
      
      console.log(`Cloning repository: ${repoUrl} (branch: ${branch})`);
      
      const git = simpleGit();
      
      // Clone with depth=1 for faster cloning (shallow clone)
      await git.clone(repoUrl, repoPath, ['--depth', '1', '--branch', branch]);
      
      console.log(`Repository cloned successfully to: ${repoPath}`);
      
      // Get repository metadata
      const metadata = await this.getRepoMetadata(repoPath, branch);
      
      return {
        success: true,
        path: repoPath,
        metadata
      };
    } catch (error) {
      console.error('Error cloning repository:', error);
      
      // Try with default branch if specified branch fails
      if (branch !== 'main' && branch !== 'master') {
        try {
          console.log(`Retrying with main branch...`);
          const git = simpleGit();
          await git.clone(repoUrl, repoPath, ['--depth', '1']);
          
          const metadata = await this.getRepoMetadata(repoPath, 'main');
          
          return {
            success: true,
            path: repoPath,
            metadata,
            warning: `Branch '${branch}' not found, used default branch`
          };
        } catch (retryError) {
          throw new Error(`Failed to clone repository: ${retryError.message}`);
        }
      }
      
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  /**
   * Get repository metadata
   * @param {string} repoPath - Path to cloned repository
   * @param {string} branch - Branch name
   * @returns {Promise<Object>} - Repository metadata
   */
  async getRepoMetadata(repoPath, branch) {
    try {
      const git = simpleGit(repoPath);
      
      // Get commit count
      const log = await git.log();
      const commitCount = log.total;
      
      // Get last commit info
      const latestCommit = log.latest;
      
      // Get branch info
      const branches = await git.branch();
      
      return {
        commitCount,
        lastCommit: {
          hash: latestCommit.hash,
          message: latestCommit.message,
          date: latestCommit.date,
          author: latestCommit.author_name
        },
        branch: branches.current,
        branches: branches.all
      };
    } catch (error) {
      console.error('Error getting repo metadata:', error);
      return {
        commitCount: 0,
        lastCommit: null,
        branch: branch,
        branches: []
      };
    }
  }

  /**
   * Get commit log with dates (for late commit detection)
   * @param {string} repoPath - Path to cloned repository
   * @param {number} maxCount - Max commits to fetch
   * @returns {Promise<Array>} - Array of { hash, date, message, author }
   */
  async getCommitLog(repoPath, maxCount = 50) {
    try {
      const git = simpleGit(repoPath);
      const log = await git.log({ maxCount });
      return (log.all || []).map(c => ({
        hash: c.hash,
        date: c.date,
        message: c.message,
        author: c.author_name
      }));
    } catch (error) {
      console.error('Error getting commit log:', error);
      return [];
    }
  }

  /**
   * Validate repository structure
   * @param {string} repoPath - Path to cloned repository
   * @param {Object} rules - Validation rules
   * @returns {Promise<Object>} - Validation result
   */
  async validateRepository(repoPath, rules = {}) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      checks: {}
    };

    try {
      const files = await fs.readdir(repoPath);
      
      // Check for README
      if (rules.mustIncludeReadme) {
        const hasReadme = files.some(file => 
          file.toLowerCase().startsWith('readme')
        );
        validation.checks.hasReadme = hasReadme;
        
        if (!hasReadme) {
          validation.errors.push('README file is missing');
          validation.isValid = false;
        }
      }
      
      // Check for .env.example
      if (rules.mustIncludeEnvExample) {
        const hasEnvExample = files.some(file => 
          file === '.env.example' || file === 'env.example'
        );
        validation.checks.hasEnvExample = hasEnvExample;
        
        if (!hasEnvExample) {
          validation.warnings.push('.env.example file is missing');
        }
      }
      
      // Check for secrets in .env file
      if (rules.mustNotContainSecrets) {
        const hasEnv = files.includes('.env');
        validation.checks.containsSecrets = hasEnv;
        
        if (hasEnv) {
          validation.errors.push('.env file should not be committed (security risk)');
          validation.isValid = false;
        }
      }
      
      // Check commit count
      if (rules.minimumCommits) {
        const git = simpleGit(repoPath);
        const log = await git.log();
        validation.checks.commitCount = log.total;
        
        if (log.total < rules.minimumCommits) {
          validation.errors.push(
            `Insufficient commits: ${log.total}/${rules.minimumCommits} required`
          );
          validation.isValid = false;
        }
      }
      
      // Check for node_modules or venv (should be in .gitignore)
      const hasNodeModules = files.includes('node_modules');
      const hasVenv = files.includes('venv') || files.includes('env');
      
      if (hasNodeModules || hasVenv) {
        validation.warnings.push(
          'Dependencies folder should not be committed (use .gitignore)'
        );
      }
      
    } catch (error) {
      console.error('Error validating repository:', error);
      validation.errors.push(`Validation error: ${error.message}`);
      validation.isValid = false;
    }

    return validation;
  }

  /**
   * Get folder structure as string
   * @param {string} repoPath - Path to cloned repository
   * @param {number} maxDepth - Maximum depth to traverse
   * @returns {Promise<string>} - Folder structure
   */
  async getFolderStructure(repoPath, maxDepth = 3) {
    try {
      // Use tree command if available, otherwise use custom implementation
      try {
        const { stdout } = await execPromise(
          `tree -L ${maxDepth} -I 'node_modules|venv|.git|__pycache__|dist|build' "${repoPath}"`,
          { maxBuffer: 1024 * 1024 * 10 }
        );
        return stdout;
      } catch (treeError) {
        // Fallback to custom implementation
        return await this._buildFolderStructure(repoPath, '', maxDepth, 0);
      }
    } catch (error) {
      console.error('Error getting folder structure:', error);
      return 'Unable to retrieve folder structure';
    }
  }

  /**
   * Custom folder structure builder (fallback)
   */
  async _buildFolderStructure(dirPath, prefix, maxDepth, currentDepth) {
    if (currentDepth >= maxDepth) return '';
    
    const ignoreList = ['node_modules', 'venv', '.git', '__pycache__', 'dist', 'build'];
    let structure = '';
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        if (ignoreList.includes(entry.name)) continue;
        
        const isLast = i === entries.length - 1;
        const marker = isLast ? '└── ' : '├── ';
        structure += `${prefix}${marker}${entry.name}\n`;
        
        if (entry.isDirectory()) {
          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          structure += await this._buildFolderStructure(
            path.join(dirPath, entry.name),
            newPrefix,
            maxDepth,
            currentDepth + 1
          );
        }
      }
    } catch (error) {
      console.error('Error building folder structure:', error);
    }
    
    return structure;
  }

  /**
   * Detect tech stack from repository
   * @param {string} repoPath - Path to cloned repository
   * @returns {Promise<Array>} - Detected technologies
   */
  async detectTechStack(repoPath) {
    const techStack = [];
    
    try {
      const files = await fs.readdir(repoPath);
      
      // Frontend frameworks
      if (files.includes('package.json')) {
        const packageJson = JSON.parse(
          await fs.readFile(path.join(repoPath, 'package.json'), 'utf8')
        );
        
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (deps.react) techStack.push('React');
        if (deps.vue) techStack.push('Vue');
        if (deps.angular) techStack.push('Angular');
        if (deps.next) techStack.push('Next.js');
        if (deps.express) techStack.push('Express.js');
        if (deps.nestjs) techStack.push('NestJS');
        if (deps.typescript) techStack.push('TypeScript');
        
        techStack.push('Node.js');
      }
      
      // Python
      if (files.includes('requirements.txt') || files.includes('setup.py') || files.includes('pyproject.toml')) {
        techStack.push('Python');
        
        if (files.includes('manage.py')) techStack.push('Django');
        
        try {
          const reqContent = await fs.readFile(path.join(repoPath, 'requirements.txt'), 'utf8');
          if (reqContent.includes('flask')) techStack.push('Flask');
          if (reqContent.includes('fastapi')) techStack.push('FastAPI');
        } catch (e) {}
      }
      
      // Java
      if (files.includes('pom.xml')) {
        techStack.push('Java', 'Maven');
      }
      if (files.includes('build.gradle')) {
        techStack.push('Java', 'Gradle');
      }
      
      // Database
      if (files.includes('docker-compose.yml')) {
        const dockerContent = await fs.readFile(path.join(repoPath, 'docker-compose.yml'), 'utf8');
        if (dockerContent.includes('postgres')) techStack.push('PostgreSQL');
        if (dockerContent.includes('mysql')) techStack.push('MySQL');
        if (dockerContent.includes('mongodb')) techStack.push('MongoDB');
        if (dockerContent.includes('redis')) techStack.push('Redis');
      }
      
      // Go
      if (files.includes('go.mod')) {
        techStack.push('Go');
      }
      
      // Ruby
      if (files.includes('Gemfile')) {
        techStack.push('Ruby', 'Ruby on Rails');
      }
      
    } catch (error) {
      console.error('Error detecting tech stack:', error);
    }
    
    return [...new Set(techStack)]; // Remove duplicates
  }

  /**
   * Get important files content
   * @param {string} repoPath - Path to cloned repository
   * @returns {Promise<Array>} - Array of file objects
   */
  async getImportantFiles(repoPath) {
    const importantFiles = [];
    const maxFileSize = 50000; // 50KB max per file
    const maxTotalSize = 500000; // 500KB total
    let totalSize = 0;
    
    const patterns = [
      'package.json',
      'requirements.txt',
      'README.md',
      'README.txt',
      '.env.example',
      'docker-compose.yml',
      'Dockerfile'
    ];
    
    try {
      for (const pattern of patterns) {
        const filePath = path.join(repoPath, pattern);
        
        try {
          const stats = await fs.stat(filePath);
          
          if (stats.size <= maxFileSize && totalSize + stats.size <= maxTotalSize) {
            const content = await fs.readFile(filePath, 'utf8');
            importantFiles.push({
              name: pattern,
              content: content,
              size: stats.size
            });
            totalSize += stats.size;
          }
        } catch (fileError) {
          // File doesn't exist, skip
        }
      }
    } catch (error) {
      console.error('Error getting important files:', error);
    }
    
    return importantFiles;
  }

  /**
   * Get core source files
   * @param {string} repoPath - Path to cloned repository
   * @param {number} maxFiles - Maximum number of files to retrieve
   * @returns {Promise<Array>} - Array of core file objects
   */
  async getCoreFiles(repoPath, maxFiles = 10) {
    const coreFiles = [];
    const maxFileSize = 30000; // 30KB max per file
    
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rb'];
    const ignoreDirs = ['node_modules', 'venv', '.git', '__pycache__', 'dist', 'build', 'test', 'tests'];
    
    async function findFiles(dir, depth = 0) {
      if (depth > 3 || coreFiles.length >= maxFiles) return;
      
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (coreFiles.length >= maxFiles) break;
          
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            if (!ignoreDirs.includes(entry.name)) {
              await findFiles(fullPath, depth + 1);
            }
          } else {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              try {
                const stats = await fs.stat(fullPath);
                if (stats.size <= maxFileSize) {
                  const content = await fs.readFile(fullPath, 'utf8');
                  const relativePath = path.relative(repoPath, fullPath);
                  
                  coreFiles.push({
                    path: relativePath,
                    content: content,
                    size: stats.size
                  });
                }
              } catch (fileError) {
                // Skip files we can't read
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
      }
    }
    
    await findFiles(repoPath);
    return coreFiles;
  }

  /**
   * Count lines of code
   * @param {string} repoPath - Path to cloned repository
   * @returns {Promise<Object>} - LOC statistics
   */
  async countLinesOfCode(repoPath) {
    const stats = {
      totalLines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      fileCount: 0
    };
    
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rb', '.html', '.css'];
    const ignoreDirs = ['node_modules', 'venv', '.git', '__pycache__', 'dist', 'build'];
    
    async function countInDir(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            if (!ignoreDirs.includes(entry.name)) {
              await countInDir(fullPath);
            }
          } else {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              try {
                const content = await fs.readFile(fullPath, 'utf8');
                const lines = content.split('\n');
                
                stats.fileCount++;
                stats.totalLines += lines.length;
                
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (trimmed === '') {
                    stats.blankLines++;
                  } else if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
                    stats.commentLines++;
                  } else {
                    stats.codeLines++;
                  }
                }
              } catch (fileError) {
                // Skip files we can't read
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error counting in directory ${dir}:`, error);
      }
    }
    
    await countInDir(repoPath);
    return stats;
  }

  /**
   * Clean up cloned repository
   * @param {string} submissionId - Submission ID
   */
  async cleanupRepo(submissionId) {
    const repoPath = path.join(this.baseDir, submissionId);
    
    try {
      await fs.rm(repoPath, { recursive: true, force: true });
      console.log(`Cleaned up repository: ${repoPath}`);
    } catch (error) {
      console.error(`Error cleaning up repository ${repoPath}:`, error);
    }
  }
}

module.exports = new GitHubCloner();
