import React from 'react';
import './InterviewAISettings.css';

const InterviewAISettings = () => {
  return (
    <div className="container interview-ai-settings">
      <h1 className="page-title">AI Interview Settings</h1>
      <div className="ai-settings-grid">
        <div className="ai-settings-card">
          <h3>AI Model Management</h3>
          <p>Configure evaluator and follow-up models.</p>
          <span className="coming-soon-badge">Coming Soon</span>
        </div>
        <div className="ai-settings-card">
          <h3>Pricing & Credits</h3>
          <p>Define interview pricing and credit policies.</p>
          <span className="coming-soon-badge">Coming Soon</span>
        </div>
        <div className="ai-settings-card">
          <h3>Quality & Abuse Monitoring</h3>
          <p>Monitor misuse and quality signals.</p>
          <span className="coming-soon-badge">Coming Soon</span>
        </div>
        <div className="ai-settings-card">
          <h3>Analytics & Reports</h3>
          <p>Track usage, scores, and engagement.</p>
          <span className="coming-soon-badge">Coming Soon</span>
        </div>
      </div>
    </div>
  );
};

export default InterviewAISettings;
