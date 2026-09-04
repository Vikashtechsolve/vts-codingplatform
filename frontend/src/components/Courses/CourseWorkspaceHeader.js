import React from 'react';
import { FiArrowLeft, FiClipboard, FiLayers, FiList, FiVideo } from 'react-icons/fi';

const MODE_META = {
  empty: {
    icon: FiLayers,
    title: 'Select a module',
    subtitle: 'Choose a module from the left to manage its lectures',
  },
  module: {
    icon: FiList,
    title: 'Lectures',
    subtitle: 'Click a lecture to edit details, video, and notes',
  },
  lecture: {
    icon: FiVideo,
    title: 'Edit lecture',
    subtitle: 'Details · Video · Notes',
  },
  quiz: {
    icon: FiClipboard,
    title: 'Module quiz',
    subtitle: 'Optional assessment — unlocks next module after submit',
  },
};

const CourseWorkspaceHeader = ({
  mode,
  moduleTitle,
  lectureTitle,
  onBack,
  showBack,
  actions,
}) => {
  const meta = MODE_META[mode] || MODE_META.empty;
  const Icon = meta.icon;

  return (
    <div className="sa-workspace-header">
      <div className="sa-workspace-header-left">
        {showBack && (
          <button type="button" className="sa-workspace-back" onClick={onBack}>
            <FiArrowLeft size={16} />
            Back
          </button>
        )}
        <div className="sa-workspace-icon">
          <Icon size={18} />
        </div>
        <div>
          {moduleTitle && (
            <p className="sa-workspace-crumb">
              {moduleTitle}
              {lectureTitle ? ` › ${lectureTitle}` : mode === 'module' ? ' › Lectures' : mode === 'quiz' ? ' › Quiz' : ''}
            </p>
          )}
          <h3 className="sa-workspace-title">{meta.title}</h3>
          <p className="sa-workspace-subtitle">{meta.subtitle}</p>
        </div>
      </div>
      {actions && <div className="sa-workspace-actions">{actions}</div>}
    </div>
  );
};

export default CourseWorkspaceHeader;
