import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSectionById } from '../../constants/studentSections';
import SectionDetailView from '../../components/Student/SectionDetail/SectionDetailView';

const TestsByType = () => {
  const { type } = useParams();
  const section = getSectionById(type);

  if (!section || section.isOverview) {
    return (
      <div className="student-tests-page tests-by-type-not-found">
        <h1>Section not found</h1>
        <p>This assessment type does not exist.</p>
        <Link to="/student/dashboard" className="student-hero-cta" style={{ marginTop: 16, display: 'inline-flex' }}>
          Back to overview
        </Link>
      </div>
    );
  }

  return <SectionDetailView section={section} />;
};

export default TestsByType;
