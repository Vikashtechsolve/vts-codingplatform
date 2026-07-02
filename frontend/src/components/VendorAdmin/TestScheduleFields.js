import React from 'react';

/**
 * Shared schedule fields for vendor test create/edit forms.
 */
const TestScheduleFields = ({
  startDate,
  endDate,
  autoSubmitAtWindowEnd = true,
  onStartDateChange,
  onEndDateChange,
  onAutoSubmitChange,
  startId = 'test-start',
  endId = 'test-end',
  fieldClassName = 'vtf-field',
  rowClassName = 'vtf-row',
}) => {
  const hasSchedule = Boolean(startDate || endDate);

  return (
    <>
      <div className={rowClassName}>
        <div className={fieldClassName}>
          <label htmlFor={startId}>Start (optional)</label>
          <input
            id={startId}
            type="datetime-local"
            name="startDate"
            value={startDate}
            onChange={onStartDateChange}
          />
          <span className="vh-field-hint">Students can see the test before this time but cannot start until then.</span>
        </div>
        <div className={fieldClassName}>
          <label htmlFor={endId}>End (optional)</label>
          <input
            id={endId}
            type="datetime-local"
            name="endDate"
            value={endDate}
            onChange={onEndDateChange}
          />
          <span className="vh-field-hint">After this time, new attempts are blocked.</span>
        </div>
      </div>

      {hasSchedule && (
        <div className={fieldClassName} style={{ marginTop: 4 }}>
          <label className="test-schedule-checkbox">
            <input
              type="checkbox"
              checked={autoSubmitAtWindowEnd}
              onChange={(e) => onAutoSubmitChange?.(e.target.checked)}
            />
            <span>Auto-submit in-progress attempts when the window ends</span>
          </label>
          <span className="vh-field-hint">
            When enabled, students still in the test at end time are submitted automatically.
            When disabled, they may finish using their remaining test duration after the window closes.
          </span>
        </div>
      )}
    </>
  );
};

export default TestScheduleFields;
