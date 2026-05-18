import React, { useState, useEffect, useMemo } from 'react';
import axiosInstance from '../utils/axios';
import './ExportReportModal.css';

const SHEET_ORDER = ['summary', 'detail', 'sections'];

const SHEET_LABELS = {
  summary: 'Student summary',
  detail: 'Detailed breakdown',
  sections: 'Section scores',
};

const ExportReportModal = ({ isOpen, onClose, optionsUrl, exportUrl, title }) => {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState(null);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (!isOpen || !optionsUrl) return;

    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const { data } = await axiosInstance.get(optionsUrl);
        if (cancelled) return;
        setOptions(data);
        setSelected(new Set(data.defaultSelected || []));
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load export options.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, optionsUrl]);

  const groupedColumns = useMemo(() => {
    if (!options?.columns) return {};
    const groups = {};
    options.columns.forEach((col) => {
      const sheet = col.sheet || 'summary';
      if (!groups[sheet]) groups[sheet] = [];
      groups[sheet].push(col);
    });
    return groups;
  }, [options]);

  const toggleColumn = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectDefaults = () => {
    setSelected(new Set(options?.defaultSelected || []));
  };

  const selectAll = () => {
    setSelected(new Set((options?.columns || []).map((c) => c.key)));
  };

  const clearAll = () => setSelected(new Set());

  const handleExport = async () => {
    if (selected.size === 0) {
      setError('Select at least one column.');
      return;
    }
    setExporting(true);
    setError('');
    try {
      const response = await axiosInstance.post(
        exportUrl,
        { columns: [...selected] },
        { responseType: 'blob' }
      );

      const disposition = response.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] || `${title || 'report'}.xlsx`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          setError(parsed.message || 'Export failed.');
        } catch {
          setError('Export failed.');
        }
      } else {
        setError(err.response?.data?.message || err.message || 'Export failed.');
      }
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="export-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="export-modal"
        role="dialog"
        aria-labelledby="export-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="export-modal-header">
          <h2 id="export-modal-title">Download Excel report</h2>
          <p className="export-modal-subtitle">{title}</p>
          <button type="button" className="export-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="export-modal-body">
          {loading && <p className="export-modal-loading">Loading options…</p>}
          {error && <div className="export-modal-error">{error}</div>}

          {!loading && options && (
            <>
              <p className="export-modal-hint">
                Choose which fields to include. Defaults are pre-selected. Enrolled students without
                submissions appear in the summary with their enrollment status.
              </p>

              <div className="export-modal-actions-row">
                <button type="button" className="btn btn-secondary btn-sm" onClick={selectDefaults}>
                  Reset defaults
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={selectAll}>
                  Select all
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={clearAll}>
                  Clear all
                </button>
                <span className="export-selected-count">{selected.size} selected</span>
              </div>

              {SHEET_ORDER.filter((s) => groupedColumns[s]?.length).map((sheetId) => (
                <div key={sheetId} className="export-column-group">
                  <h3>{SHEET_LABELS[sheetId] || sheetId}</h3>
                  <div className="export-column-grid">
                    {groupedColumns[sheetId].map((col) => (
                      <label key={col.key} className="export-column-check">
                        <input
                          type="checkbox"
                          checked={selected.has(col.key)}
                          onChange={() => toggleColumn(col.key)}
                        />
                        <span>{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="export-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={exporting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExport}
            disabled={loading || exporting || selected.size === 0}
          >
            {exporting ? 'Generating…' : 'Download Excel (.xlsx)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportReportModal;
