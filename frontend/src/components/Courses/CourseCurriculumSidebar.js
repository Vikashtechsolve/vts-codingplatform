import React, { useMemo, useState } from 'react';
import {
  FiClipboard,
  FiLayers,
  FiPlus,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi';

const moduleStats = (mod) => {
  const count = (mod.lectures || []).length;
  const hasQuiz = !!mod.testId;
  return { count, hasQuiz };
};

/**
 * Left rail — modules only. Lectures are shown in the main panel after selecting a module.
 */
const CourseCurriculumSidebar = ({
  modules,
  activeModuleId,
  newModuleTitle,
  addingModule,
  onNewModuleTitleChange,
  onSelectModule,
  onOpenQuiz,
  onAddModule,
  onDeleteModule,
}) => {
  const [search, setSearch] = useState('');

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter((m) => m.title?.toLowerCase().includes(q));
  }, [modules, search]);

  return (
    <div className="vh-panel sa-module-rail">
      <div className="vh-panel-head sa-module-rail-head">
        <div className="sa-module-rail-title-row">
          <div className="sa-module-rail-icon-wrap">
            <FiLayers size={18} />
          </div>
          <div className="sa-module-rail-head-text">
            <h2 className="vh-panel-title">Modules</h2>
            <p className="vh-panel-desc">
              {modules.length} in this course
            </p>
          </div>
        </div>
      </div>

      <div className="vh-panel-body sa-module-rail-body">
        {modules.length > 4 && (
          <div className="sa-outline-search">
            <FiSearch size={15} />
            <input
              type="search"
              placeholder="Search modules…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {!modules.length ? (
          <div className="sa-outline-empty">
            <p>No modules yet</p>
            <span>Add your first module below</span>
          </div>
        ) : !filteredModules.length ? (
          <p className="sa-outline-no-match">No modules match “{search}”</p>
        ) : (
          <ul className="sa-module-rail-list">
            {filteredModules.map((mod, idx) => {
              const isActive = activeModuleId === mod._id;
              const { count, hasQuiz } = moduleStats(mod);
              return (
                <li key={mod._id} className={`sa-module-card ${isActive ? 'is-active' : ''}`}>
                  <button
                    type="button"
                    className="sa-module-card-main"
                    onClick={() => onSelectModule(mod._id)}
                    title={mod.title}
                  >
                    <span className={`sa-module-num ${isActive ? 'is-active' : ''}`}>
                      {idx + 1}
                    </span>
                    <span className="sa-module-card-text">
                      <span className="sa-module-card-title">{mod.title}</span>
                      <span className="sa-module-card-meta">
                        {count} lecture{count !== 1 ? 's' : ''}
                        {hasQuiz && (
                          <span className="sa-module-card-tag">Quiz</span>
                        )}
                      </span>
                    </span>
                  </button>
                  <div className="sa-module-card-foot">
                    <button
                      type="button"
                      className="sa-module-card-action"
                      title="Module quiz"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenQuiz(mod._id);
                      }}
                    >
                      <FiClipboard size={13} />
                      Quiz
                    </button>
                    <button
                      type="button"
                      className="sa-module-card-action sa-module-card-action--danger"
                      title="Delete module"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteModule(mod._id);
                      }}
                    >
                      <FiTrash2 size={13} />
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <form className="sa-module-add-form" onSubmit={onAddModule}>
          <p className="sa-module-add-label">New module</p>
          <div className="sa-module-add-row">
            <input
              id="sidebar-new-module"
              type="text"
              placeholder="e.g. Week 1 — Introduction"
              value={newModuleTitle}
              onChange={(e) => onNewModuleTitleChange(e.target.value)}
              maxLength={120}
            />
            <button
              type="submit"
              className="vh-btn vh-btn--primary vh-btn--sm sa-module-add-btn"
              disabled={addingModule || !newModuleTitle.trim()}
            >
              <FiPlus size={16} />
              {addingModule ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseCurriculumSidebar;
