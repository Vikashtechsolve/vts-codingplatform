const OpenAI = require('openai');

class AIEvaluator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    // Project evaluation uses its own model (separate from interview OPENAI_EVAL_MODEL)
    this.model = process.env.OPENAI_PROJECT_EVAL_MODEL || 'gpt-4o-mini';
  }

  /**
   * Evaluate project using AI
   * @param {Object} params - Evaluation parameters
   * @returns {Promise<Object>} - AI evaluation result
   */
  async evaluateProject(params) {
    const {
      assignment,
      repositoryAnalysis,
      folderStructure,
      importantFiles,
      coreFiles
    } = params;

    try {
      // Build comprehensive prompt
      const prompt = this._buildEvaluationPrompt(
        assignment,
        repositoryAnalysis,
        folderStructure,
        importantFiles,
        coreFiles
      );

      console.log('Sending evaluation request to OpenAI...');
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this._getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      console.log('AI evaluation completed successfully');
      
      return {
        success: true,
        evaluation: result,
        tokensUsed: response.usage.total_tokens,
        cost: this._calculateCost(response.usage)
      };
    } catch (error) {
      console.error('AI evaluation error:', error);
      throw new Error(`AI evaluation failed: ${error.message}`);
    }
  }

  /**
   * Get system prompt for AI evaluator
   */
  _getSystemPrompt() {
    return `You are an expert software architect and code reviewer with decades of experience evaluating software projects. Your role is to provide comprehensive, fair, and constructive evaluation of student coding projects.

Evaluation Criteria:
1. Feature Completion: Are all required features implemented correctly?
2. Code Quality: Is the code clean, maintainable, and following best practices?
3. Architecture: Is the project structure logical and scalable?
4. Security: Are there any security vulnerabilities?
5. Git Practices: Are commits meaningful and following good practices?
6. Documentation: Is the project well-documented?

Your evaluation must be:
- OBJECTIVE: Base scores on actual implementation, not potential
- FAIR: Give credit where due, but identify real issues
- CONSTRUCTIVE: Provide actionable feedback for improvement
- DETAILED: Explain reasoning behind scores
- CONSISTENT: Use the same standards for all evaluations

Return your evaluation in strict JSON format matching the provided structure.`;
  }

  /**
   * Build comprehensive evaluation prompt
   */
  _buildEvaluationPrompt(assignment, repoAnalysis, folderStructure, importantFiles, coreFiles) {
    const featureList = assignment.featureChecklist
      .map((f, i) => `${i + 1}. ${f.feature} - ${f.marks} marks${f.required ? ' (REQUIRED)' : ''}${f.description ? `\n   Description: ${f.description}` : ''}`)
      .join('\n');

    const techStack = repoAnalysis.detectedTechStack?.join(', ') || 'Not detected';

    const importantFilesContent = importantFiles
      ?.map(f => `\n### ${f.name}\n\`\`\`\n${f.content.substring(0, 2000)}\n\`\`\``)
      .join('\n') || '';

    const coreFilesContent = coreFiles
      ?.slice(0, 5)
      .map(f => `\n### ${f.path}\n\`\`\`\n${f.content.substring(0, 1500)}\n\`\`\``)
      .join('\n') || '';

    return `# Project Evaluation Task

## Assignment Details

**Title:** ${assignment.title}
**Category:** ${assignment.category}
**Difficulty:** ${assignment.difficulty}
**Total Marks:** ${assignment.totalMarks}

**Description:**
${assignment.description}

**Allowed Tech Stack:**
${assignment.allowedTechStack?.join(', ') || 'Any'}

## Required Features Checklist

${featureList}

## Repository Analysis

**Detected Tech Stack:** ${techStack}
**Total Files:** ${repoAnalysis.fileCount || 'N/A'}
**Lines of Code:** ${repoAnalysis.linesOfCode || 'N/A'}
**Commits:** ${repoAnalysis.commitCount || 'N/A'}

**Folder Structure:**
\`\`\`
${folderStructure}
\`\`\`

## Important Configuration Files

${importantFilesContent}

## Core Implementation Files (Sample)

${coreFilesContent}

## Evaluation Instructions

Please analyze this project comprehensively and provide scores for each feature and category. Be thorough but fair.

**Return your evaluation in this exact JSON structure:**

\`\`\`json
{
  "featureEvaluation": [
    {
      "feature": "Feature Name",
      "expectedMarks": 15,
      "scoredMarks": 12,
      "status": "implemented|partial|missing",
      "analysis": "Detailed explanation of implementation quality",
      "suggestions": ["Suggestion 1", "Suggestion 2"]
    }
  ],
  "categoryScores": {
    "featureCompletion": {
      "score": 35,
      "maxScore": 40,
      "analysis": "Overall feature completion analysis"
    },
    "codeQuality": {
      "score": 16,
      "maxScore": 20,
      "analysis": "Code quality assessment"
    },
    "architecture": {
      "score": 12,
      "maxScore": 15,
      "analysis": "Architecture evaluation"
    },
    "security": {
      "score": 7,
      "maxScore": 10,
      "analysis": "Security assessment"
    },
    "gitPractices": {
      "score": 8,
      "maxScore": 10,
      "analysis": "Git practices evaluation"
    },
    "documentation": {
      "score": 3,
      "maxScore": 5,
      "analysis": "Documentation quality"
    }
  },
  "codeQualityIssues": [
    {
      "severity": "high|medium|low",
      "issue": "Issue description",
      "location": "File or component name",
      "suggestion": "How to fix"
    }
  ],
  "securityIssues": [
    {
      "severity": "critical|high|medium|low",
      "issue": "Security issue description",
      "location": "Where the issue is",
      "suggestion": "How to fix"
    }
  ],
  "strengths": [
    "Strength 1",
    "Strength 2"
  ],
  "weaknesses": [
    "Weakness 1",
    "Weakness 2"
  ],
  "bestPracticesFollowed": [
    "Practice 1",
    "Practice 2"
  ],
  "bestPracticesViolated": [
    "Practice 1",
    "Practice 2"
  ],
  "architectureAnalysis": "Overall architecture assessment paragraph",
  "overallSummary": "Comprehensive summary of the project evaluation",
  "areasForImprovement": [
    "Area 1",
    "Area 2"
  ],
  "recommendedResources": [
    "Resource 1",
    "Resource 2"
  ]
}
\`\`\`

Important Guidelines:
1. Be objective and fair in scoring
2. Provide specific, actionable feedback
3. Reference actual code when possible
4. Consider the difficulty level and time constraints
5. Identify both strengths and areas for improvement
6. Ensure all scores are within their maximum limits
7. Be thorough in your analysis`;
  }

  /**
   * Evaluate git commit quality
   * @param {Array} commits - Array of commit objects
   * @returns {Promise<Object>} - Git evaluation result
   */
  async evaluateGitPractices(commits) {
    if (!commits || commits.length === 0) {
      return {
        score: 0,
        goodCommits: 0,
        poorCommits: 0,
        analysis: 'No commits found',
        examples: []
      };
    }

    try {
      const commitMessages = commits
        .slice(0, 20)
        .map((c, i) => `${i + 1}. ${c.message}`)
        .join('\n');

      const prompt = `Evaluate these git commit messages for quality:

${commitMessages}

Criteria:
- Clear and descriptive
- Follow conventional commits (feat:, fix:, etc.) or similar pattern
- Not too vague (e.g., "update", "fix bug")
- Appropriate length (not too short or too long)

Provide evaluation in JSON format:
{
  "qualityScore": 0-10,
  "goodCommits": count,
  "poorCommits": count,
  "analysis": "Brief analysis",
  "examples": [
    {
      "message": "commit message",
      "quality": "good|poor",
      "feedback": "explanation"
    }
  ]
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a git practices expert.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Git practices evaluation error:', error);
      return {
        score: 5,
        goodCommits: Math.floor(commits.length * 0.5),
        poorCommits: Math.ceil(commits.length * 0.5),
        analysis: 'Unable to evaluate git practices',
        examples: []
      };
    }
  }

  /**
   * Evaluate README quality
   * @param {string} readmeContent - README file content
   * @returns {Promise<Object>} - README evaluation result
   */
  async evaluateReadme(readmeContent) {
    if (!readmeContent) {
      return {
        score: 0,
        hasSetupInstructions: false,
        hasFeatureDescription: false,
        hasUsageExamples: false,
        hasDependencies: false,
        feedback: 'README not found'
      };
    }

    try {
      const prompt = `Evaluate this README for quality and completeness:

\`\`\`markdown
${readmeContent.substring(0, 3000)}
\`\`\`

Check for:
1. Setup/installation instructions
2. Feature descriptions
3. Usage examples
4. Dependencies list
5. Overall clarity and usefulness

Provide evaluation in JSON format:
{
  "score": 0-10,
  "hasSetupInstructions": true/false,
  "hasFeatureDescription": true/false,
  "hasUsageExamples": true/false,
  "hasDependencies": true/false,
  "feedback": "Detailed feedback"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a technical documentation expert.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('README evaluation error:', error);
      return {
        score: 5,
        hasSetupInstructions: false,
        hasFeatureDescription: false,
        hasUsageExamples: false,
        hasDependencies: false,
        feedback: 'Unable to evaluate README'
      };
    }
  }

  /**
   * Calculate API cost
   */
  _calculateCost(usage) {
    // GPT-4 Turbo pricing (as of 2024)
    const inputCostPer1k = 0.01; // $0.01 per 1K input tokens
    const outputCostPer1k = 0.03; // $0.03 per 1K output tokens

    const inputCost = (usage.prompt_tokens / 1000) * inputCostPer1k;
    const outputCost = (usage.completion_tokens / 1000) * outputCostPer1k;

    return {
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      inputCost: inputCost.toFixed(4),
      outputCost: outputCost.toFixed(4),
      totalCost: (inputCost + outputCost).toFixed(4)
    };
  }
}

module.exports = new AIEvaluator();
