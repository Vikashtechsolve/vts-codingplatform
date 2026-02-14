/**
 * Scoring Engine for Project Evaluations
 * Calculates final scores based on AI analysis and evaluation criteria
 */

class ScoringEngine {
  /**
   * Calculate final score for a project submission
   * @param {Object} params - Scoring parameters
   * @returns {Object} - Final evaluation result
   */
  calculateFinalScore(params) {
    const {
      assignment,
      aiEvaluation,
      repositoryValidation,
      gitAnalysis,
      documentationAnalysis
    } = params;

    // Get evaluation weights
    const weights = assignment.evaluationWeights;

    // Calculate category scores
    const categoryScores = this._calculateCategoryScores(
      assignment,
      aiEvaluation,
      gitAnalysis,
      documentationAnalysis,
      weights
    );

    // Calculate total score
    const totalScore = this._calculateWeightedTotal(categoryScores, weights);
    const totalPossibleScore = assignment.totalMarks;
    const percentage = (totalScore / totalPossibleScore) * 100;

    // Calculate grade
    const grade = this._calculateGrade(percentage);

    // Prepare feature evaluation
    const featureEvaluation = this._prepareFeatureEvaluation(
      assignment.featureChecklist,
      aiEvaluation.featureEvaluation || []
    );

    // Prepare overall feedback
    const overallFeedback = this._prepareOverallFeedback(
      aiEvaluation,
      percentage,
      grade
    );

    return {
      totalScore: Math.round(totalScore * 100) / 100,
      totalPossibleScore,
      percentage: Math.round(percentage * 100) / 100,
      grade,
      categoryScores,
      featureEvaluation,
      aiAnalysis: {
        summary: aiEvaluation.overallSummary || '',
        strengths: aiEvaluation.strengths || [],
        weaknesses: aiEvaluation.weaknesses || [],
        codeQualityIssues: aiEvaluation.codeQualityIssues || [],
        securityIssues: aiEvaluation.securityIssues || [],
        architectureAnalysis: aiEvaluation.architectureAnalysis || '',
        bestPracticesFollowed: aiEvaluation.bestPracticesFollowed || [],
        bestPracticesViolated: aiEvaluation.bestPracticesViolated || []
      },
      gitAnalysis: gitAnalysis || {},
      documentationAnalysis: documentationAnalysis || {},
      overallFeedback
    };
  }

  /**
   * Calculate category-wise scores
   */
  _calculateCategoryScores(assignment, aiEvaluation, gitAnalysis, docAnalysis, weights) {
    const totalMarks = assignment.totalMarks;

    // Calculate max score for each category based on weights
    const maxScores = {
      featureCompletion: (totalMarks * weights.featureCompletion) / 100,
      codeQuality: (totalMarks * weights.codeQuality) / 100,
      architecture: (totalMarks * weights.architecture) / 100,
      security: (totalMarks * weights.security) / 100,
      gitPractices: (totalMarks * weights.gitPractices) / 100,
      documentation: (totalMarks * weights.documentation) / 100
    };

    // Get scores from AI evaluation
    const aiScores = aiEvaluation.categoryScores || {};

    // Calculate actual scores
    const scores = {
      featureCompletion: {
        score: this._normalizeScore(aiScores.featureCompletion?.score, maxScores.featureCompletion),
        maxScore: maxScores.featureCompletion,
        percentage: 0
      },
      codeQuality: {
        score: this._normalizeScore(aiScores.codeQuality?.score, maxScores.codeQuality),
        maxScore: maxScores.codeQuality,
        percentage: 0
      },
      architecture: {
        score: this._normalizeScore(aiScores.architecture?.score, maxScores.architecture),
        maxScore: maxScores.architecture,
        percentage: 0
      },
      security: {
        score: this._normalizeScore(aiScores.security?.score, maxScores.security),
        maxScore: maxScores.security,
        percentage: 0
      },
      gitPractices: {
        score: gitAnalysis?.commitQuality?.score 
          ? (gitAnalysis.commitQuality.score / 10) * maxScores.gitPractices
          : this._normalizeScore(aiScores.gitPractices?.score, maxScores.gitPractices),
        maxScore: maxScores.gitPractices,
        percentage: 0
      },
      documentation: {
        score: docAnalysis?.readmeQuality?.score
          ? (docAnalysis.readmeQuality.score / 10) * maxScores.documentation
          : this._normalizeScore(aiScores.documentation?.score, maxScores.documentation),
        maxScore: maxScores.documentation,
        percentage: 0
      }
    };

    // Calculate percentages
    Object.keys(scores).forEach(key => {
      scores[key].percentage = scores[key].maxScore > 0
        ? Math.round((scores[key].score / scores[key].maxScore) * 100 * 100) / 100
        : 0;
    });

    return scores;
  }

  /**
   * Normalize score to fit within max score
   */
  _normalizeScore(score, maxScore) {
    if (!score || score <= 0) return 0;
    if (score > maxScore) return maxScore;
    return Math.round(score * 100) / 100;
  }

  /**
   * Calculate weighted total score
   */
  _calculateWeightedTotal(categoryScores, weights) {
    let total = 0;
    Object.values(categoryScores).forEach(category => {
      total += category.score;
    });
    return total;
  }

  /**
   * Calculate grade based on percentage
   */
  _calculateGrade(percentage) {
    if (percentage >= 90) return 'A+';
    if (percentage >= 85) return 'A';
    if (percentage >= 80) return 'B+';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C+';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  }

  /**
   * Prepare feature evaluation with scored marks
   */
  _prepareFeatureEvaluation(featureChecklist, aiFeatureEval) {
    return featureChecklist.map(feature => {
      // Find corresponding AI evaluation
      const aiEval = aiFeatureEval.find(
        ae => ae.feature.toLowerCase().includes(feature.feature.toLowerCase()) ||
              feature.feature.toLowerCase().includes(ae.feature.toLowerCase())
      );

      if (aiEval) {
        return {
          feature: feature.feature,
          expectedMarks: feature.marks,
          scoredMarks: Math.min(aiEval.scoredMarks || 0, feature.marks),
          status: aiEval.status || 'missing',
          aiAnalysis: aiEval.analysis || '',
          suggestions: aiEval.suggestions || []
        };
      }

      // If AI didn't evaluate this feature, mark as missing
      return {
        feature: feature.feature,
        expectedMarks: feature.marks,
        scoredMarks: 0,
        status: 'missing',
        aiAnalysis: 'Feature not found or not evaluated',
        suggestions: ['Ensure this feature is properly implemented']
      };
    });
  }

  /**
   * Prepare overall feedback
   */
  _prepareOverallFeedback(aiEvaluation, percentage, grade) {
    const performanceLevel = this._getPerformanceLevel(percentage);

    return {
      summary: aiEvaluation.overallSummary || `Project scored ${percentage.toFixed(1)}% (Grade: ${grade})`,
      performanceLevel,
      topStrengths: (aiEvaluation.strengths || []).slice(0, 5),
      areasForImprovement: (aiEvaluation.areasForImprovement || aiEvaluation.weaknesses || []).slice(0, 5),
      nextSteps: this._generateNextSteps(percentage, aiEvaluation),
      recommendedResources: aiEvaluation.recommendedResources || []
    };
  }

  /**
   * Get performance level description
   */
  _getPerformanceLevel(percentage) {
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 80) return 'Very Good';
    if (percentage >= 70) return 'Good';
    if (percentage >= 60) return 'Satisfactory';
    if (percentage >= 50) return 'Needs Improvement';
    return 'Unsatisfactory';
  }

  /**
   * Generate next steps for improvement
   */
  _generateNextSteps(percentage, aiEvaluation) {
    const steps = [];

    if (percentage < 70) {
      steps.push('Review the assignment requirements and ensure all features are implemented');
    }

    if (aiEvaluation.codeQualityIssues?.length > 0) {
      steps.push('Address the identified code quality issues');
    }

    if (aiEvaluation.securityIssues?.length > 0) {
      steps.push('Fix security vulnerabilities immediately');
    }

    if (aiEvaluation.bestPracticesViolated?.length > 0) {
      steps.push('Learn and apply industry best practices');
    }

    if (steps.length === 0) {
      steps.push('Continue learning and building more complex projects');
      steps.push('Explore advanced features and optimizations');
    }

    return steps;
  }

  /**
   * Validate if project passes minimum requirements
   */
  validateMinimumRequirements(assignment, featureEvaluation) {
    const requiredFeatures = assignment.featureChecklist.filter(f => f.required);
    
    const missingRequired = [];
    
    for (const required of requiredFeatures) {
      const evaluation = featureEvaluation.find(
        fe => fe.feature === required.feature
      );
      
      if (!evaluation || evaluation.status === 'missing') {
        missingRequired.push(required.feature);
      }
    }

    return {
      passed: missingRequired.length === 0,
      missingRequired
    };
  }

  /**
   * Calculate time efficiency score
   */
  calculateTimeEfficiency(timeSpent, estimatedTime) {
    if (!timeSpent || !estimatedTime) return null;

    const ratio = timeSpent / estimatedTime;

    if (ratio <= 0.8) {
      return {
        score: 10,
        efficiency: 'Excellent',
        feedback: 'Completed well within expected time'
      };
    } else if (ratio <= 1.0) {
      return {
        score: 8,
        efficiency: 'Good',
        feedback: 'Completed within expected time'
      };
    } else if (ratio <= 1.2) {
      return {
        score: 6,
        efficiency: 'Fair',
        feedback: 'Took slightly longer than expected'
      };
    } else {
      return {
        score: 4,
        efficiency: 'Needs Improvement',
        feedback: 'Consider time management strategies'
      };
    }
  }
}

module.exports = new ScoringEngine();
