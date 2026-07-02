import React from 'react';
import { FiCpu, FiDollarSign, FiShield, FiBarChart2 } from 'react-icons/fi';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import { SUPER_ADMIN_ACCENT } from '../../constants/superAdminSections';
import '../../styles/super-admin-pages.css';

const SETTINGS_CARDS = [
  {
    title: 'AI model management',
    description: 'Configure evaluator and follow-up models for mock interviews.',
    icon: FiCpu,
    accent: '#6366f1',
  },
  {
    title: 'Pricing & credits',
    description: 'Define interview pricing policies and default credit allocations.',
    icon: FiDollarSign,
    accent: '#059669',
  },
  {
    title: 'Quality & abuse monitoring',
    description: 'Monitor misuse signals and interview quality metrics.',
    icon: FiShield,
    accent: '#dc2626',
  },
  {
    title: 'Analytics & reports',
    description: 'Track platform-wide usage, scores, and engagement trends.',
    icon: FiBarChart2,
    accent: '#7c3aed',
  },
];

const InterviewAISettings = () => {
  return (
    <VendorHubPage
      className="sa-page"
      eyebrow="Platform configuration"
      title="AI interview settings"
      subtitle="Configure platform-wide AI interview behavior, pricing, and monitoring."
      accent={SUPER_ADMIN_ACCENT}
    >
      <div className="vh-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">Coming soon</h2>
            <p className="vh-panel-desc">
              These settings will let you manage AI models, credit policies, and quality controls
              across all vendors.
            </p>
          </div>
        </div>
        <div className="vh-panel-body">
          <div className="sa-ai-grid">
            {SETTINGS_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className="sa-ai-card"
                  style={{ '--card-accent': card.accent }}
                >
                  <div className="sa-ai-card-icon">
                    <Icon />
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  <span className="sa-soon-badge">Coming soon</span>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </VendorHubPage>
  );
};

export default InterviewAISettings;
