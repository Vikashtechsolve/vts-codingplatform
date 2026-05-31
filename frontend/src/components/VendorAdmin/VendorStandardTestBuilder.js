import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';
import VendorTestSelectedPanel from './VendorTestSelectedPanel';

function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const CREATE_LINKS = {
  coding: '/vendor-admin/questions/coding/create',
  mcq: '/vendor-admin/questions/mcq/create',
  aptitude: '/vendor-admin/questions/aptitude/create',
  theory: '/vendor-admin/questions/theory/create',
};

function countBySource(list, sourceKey) {
  if (!Array.isArray(list)) return 0;
  return list.filter((q) =>
    sourceKey === 'my' ? q.source === 'vendor' : q.source === 'global'
  ).length;
}

const VendorStandardTestBuilder = ({
  formData,
  selectedTab,
  setSelectedTab,
  questionSource,
  setQuestionSource,
  searchTerm,
  setSearchTerm,
  selectedTag,
  setSelectedTag,
  availableTagsByTab,
  filteredCoding,
  filteredMcq,
  filteredAptitude,
  filteredTheory,
  questionPools,
  onAddQuestion,
  onRemoveQuestion,
  onPointsChange,
  onMoveQuestion,
  getQuestionTitle,
  isQuestionAdded,
}) => {
  const pools = useMemo(() => questionPools || {}, [questionPools]);
  const tagsByTab = availableTagsByTab || {};

  const tabSourceCounts = useMemo(() => {
    const pool = pools[selectedTab] || [];
    return {
      my: countBySource(pool, 'my'),
      global: countBySource(pool, 'global'),
    };
  }, [pools, selectedTab]);

  const tabs = [];
  if (formData.type === 'mixed' || formData.type === 'coding') {
    tabs.push({
      id: 'coding',
      label: 'Coding',
      count: filteredCoding.length,
      poolMy: countBySource(pools.coding, 'my'),
    });
  }
  if (formData.type === 'mixed' || formData.type === 'mcq') {
    tabs.push({
      id: 'mcq',
      label: 'MCQ',
      count: filteredMcq.length,
      poolMy: countBySource(pools.mcq, 'my'),
    });
  }
  if (formData.type === 'mixed' || formData.type === 'aptitude') {
    tabs.push({
      id: 'aptitude',
      label: 'Aptitude',
      count: filteredAptitude.length,
      poolMy: countBySource(pools.aptitude, 'my'),
    });
  }
  if (formData.type === 'mixed' || formData.type === 'theory') {
    tabs.push({
      id: 'theory',
      label: 'Theory',
      count: filteredTheory.length,
      poolMy: countBySource(pools.theory, 'my'),
    });
  }

  const activeTabLabel = tabs.find((t) => t.id === selectedTab)?.label || selectedTab;
  const activeTags = tagsByTab[selectedTab] || [];

  const tagOptionSlug = (tag) =>
    typeof tag === 'object' && tag?.slug ? tag.slug : String(tag || '');
  const tagOptionLabel = (tag) =>
    typeof tag === 'object' && tag?.label ? tag.label : String(tag || '');

  const activeList =
    selectedTab === 'coding'
      ? filteredCoding
      : selectedTab === 'mcq'
        ? filteredMcq
        : selectedTab === 'aptitude'
          ? filteredAptitude
          : filteredTheory;

  const noBank =
    (pools.coding?.length || 0) +
      (pools.mcq?.length || 0) +
      (pools.aptitude?.length || 0) +
      (pools.theory?.length || 0) ===
    0;

  const totalPoints = formData.questions.reduce(
    (sum, q) => sum + (Number(q.points) || 0),
    0
  );

  const selectedItems = formData.questions.map((q, index) => ({
    key: `${q.questionId}-${index}`,
    id: q.questionId,
    points: q.points,
    raw: q,
    index,
  }));

  const renderAddBtn = (q, type, added) => (
    <button
      type="button"
      className={`vtf-btn-add ${added ? 'is-added' : ''}`}
      disabled={added}
      onClick={() => onAddQuestion(q._id, type, q)}
    >
      {added ? 'Added to test' : 'Add to test'}
    </button>
  );

  const renderTags = (q) =>
    q.tags?.length ? (
      <div className="vtf-tags-row">
        {q.tags.slice(0, 4).map((tag) => {
          const slug = tagOptionSlug(tag);
          return (
            <button
              key={slug}
              type="button"
              className={`vtf-tag-chip ${selectedTag === slug ? 'is-active' : ''}`}
              onClick={() => setSelectedTag(selectedTag === slug ? '' : slug)}
            >
              #{tagOptionLabel(tag)}
            </button>
          );
        })}
      </div>
    ) : null;

  const renderCodingCards = () =>
    filteredCoding.map((q) => {
      const added = isQuestionAdded(q._id);
      return (
        <div key={q._id} className="vtf-q-card">
          <div className="vtf-q-card-top">
            <h4>{q.title}</h4>
            <span className={`vtf-badge vtf-badge--${q.difficulty || 'medium'}`}>
              {q.difficulty || 'medium'}
            </span>
          </div>
          {q.description && (
            <p className="vtf-q-preview">{stripHtml(q.description).slice(0, 120)}</p>
          )}
          <div className="vtf-q-meta">
            <span>{q.allowedLanguages?.join(', ') || 'Any language'}</span>
            <span>{q.testCases?.length || 0} cases</span>
          </div>
          {renderTags(q)}
          {renderAddBtn(q, 'coding', added)}
        </div>
      );
    });

  const renderMcqCards = () =>
    filteredMcq.map((q) => {
      const added = isQuestionAdded(q._id);
      return (
        <div key={q._id} className="vtf-q-card">
          <div className="vtf-q-card-top">
            <h4>{stripHtml(q.question).slice(0, 80) || 'MCQ'}</h4>
            <span className={`vtf-badge vtf-badge--${q.difficulty || 'medium'}`}>
              {q.difficulty || 'medium'}
            </span>
          </div>
          <div className="vtf-q-meta">
            <span>{q.options?.length || 0} options</span>
          </div>
          {renderTags(q)}
          {renderAddBtn(q, 'mcq', added)}
        </div>
      );
    });

  const renderAptitudeCards = () =>
    filteredAptitude.map((q) => {
      const added = isQuestionAdded(q._id);
      return (
        <div key={q._id} className="vtf-q-card">
          <div className="vtf-q-card-top">
            <h4>{stripHtml(q.question).slice(0, 80)}</h4>
            <span className={`vtf-badge vtf-badge--${q.difficulty || 'medium'}`}>
              {q.difficulty || 'medium'}
            </span>
          </div>
          <div className="vtf-q-meta">
            <span>{q.section}</span>
            <span>{q.questionType}</span>
          </div>
          {renderTags(q)}
          {renderAddBtn(q, 'aptitude', added)}
        </div>
      );
    });

  const renderTheoryCards = () =>
    filteredTheory.map((q) => {
      const added = isQuestionAdded(q._id);
      return (
        <div key={q._id} className="vtf-q-card">
          <div className="vtf-q-card-top">
            <h4>{stripHtml(q.questionText).slice(0, 80)}</h4>
            <span className={`vtf-badge vtf-badge--${q.difficulty || 'medium'}`}>
              {q.difficulty || 'medium'}
            </span>
          </div>
          <div className="vtf-q-meta">
            <span>{q.subjectId?.name || 'Subject'}</span>
            <span>{q.maxMarks || 10} marks</span>
          </div>
          {renderTags(q)}
          {renderAddBtn(q, 'theory', added)}
        </div>
      );
    });

  const renderTabEmpty = (type) => (
    <div className="vtf-empty">
      <h3>No {type} questions</h3>
      <p>
        {searchTerm
          ? 'No matches for your search.'
          : `No ${questionSource === 'my' ? 'custom' : 'global'} ${type} questions in this tab.`}
      </p>
      {questionSource === 'my' && !searchTerm && (
        <Link to={CREATE_LINKS[type]} className="vtf-btn-add" style={{ width: 'auto', display: 'inline-flex' }}>
          Create {type} question
        </Link>
      )}
    </div>
  );

  return (
    <div className="vtf-builder">
      <div className="vtf-builder-main">
        <section className="vtf-section">
          <h2 className="vtf-section-title">Question bank</h2>
          <p className="vtf-section-hint">
            Counts below are for the active tab ({activeTabLabel}). Pick My or Global, then add
            questions to your test lineup on the right.
          </p>

          {noBank ? (
            <div className="vtf-empty">
              <h3>No questions in your bank yet</h3>
              <p>Create questions first, then add them to this assessment.</p>
              <div className="vtf-empty-actions">
                <Link to={CREATE_LINKS.coding} className="vtf-btn-add" style={{ width: 'auto' }}>
                  Coding
                </Link>
                <Link to={CREATE_LINKS.mcq} className="vtf-btn-ghost-sm">
                  MCQ
                </Link>
                <Link to={CREATE_LINKS.aptitude} className="vtf-btn-ghost-sm">
                  Aptitude
                </Link>
                <Link to={CREATE_LINKS.theory} className="vtf-btn-ghost-sm">
                  Theory
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="vtf-segment">
                <button
                  type="button"
                  className={`vtf-segment-btn ${questionSource === 'my' ? 'active' : ''}`}
                  onClick={() => setQuestionSource('my')}
                >
                  My questions
                  <span className="vtf-segment-count">{tabSourceCounts.my}</span>
                </button>
                <button
                  type="button"
                  className={`vtf-segment-btn ${questionSource === 'global' ? 'active' : ''}`}
                  onClick={() => setQuestionSource('global')}
                >
                  Global
                  <span className="vtf-segment-count">{tabSourceCounts.global}</span>
                </button>
              </div>

              <div className="vtf-search">
                <FiSearch />
                <input
                  type="search"
                  placeholder={`Search ${activeTabLabel.toLowerCase()} by text or tag…`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                />
              </div>
              {activeTags.length > 0 && (
                <div className="vtf-tags-filter-wrap">
                  <button
                    type="button"
                    className={`vtf-tag-chip ${selectedTag === '' ? 'is-active' : ''}`}
                    onClick={() => setSelectedTag('')}
                  >
                    All tags
                  </button>
                  {activeTags.map((tag) => {
                    const slug = tagOptionSlug(tag);
                    const label = tagOptionLabel(tag);
                    return (
                      <button
                        key={slug}
                        type="button"
                        className={`vtf-tag-chip ${selectedTag === slug ? 'is-active' : ''}`}
                        onClick={() => setSelectedTag(selectedTag === slug ? '' : slug)}
                      >
                        #{label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="vtf-tabs">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`vtf-tab ${selectedTab === t.id ? 'active' : ''}`}
                    onClick={() => setSelectedTab(t.id)}
                  >
                    {t.label}
                    <span className="vtf-tab-count">{t.count}</span>
                  </button>
                ))}
              </div>

              {activeList.length === 0 ? (
                renderTabEmpty(selectedTab)
              ) : (
                <div className="vtf-q-grid">
                  {selectedTab === 'coding' && renderCodingCards()}
                  {selectedTab === 'mcq' && renderMcqCards()}
                  {selectedTab === 'aptitude' && renderAptitudeCards()}
                  {selectedTab === 'theory' && renderTheoryCards()}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <aside className="vtf-builder-aside">
        <VendorTestSelectedPanel
          items={selectedItems}
          emptyTitle="Your test is empty"
          emptyHint="Browse the bank and tap “Add to test” for each question you want."
          totalPoints={totalPoints}
          getTitle={(item) =>
            getQuestionTitle(item.raw.questionId, item.raw.type, item.raw.questionData)
          }
          getType={(item) => item.raw.type}
          onPointsChange={onPointsChange}
          onMove={onMoveQuestion}
          onRemove={onRemoveQuestion}
        />
      </aside>
    </div>
  );
};

export default VendorStandardTestBuilder;
