import React, { useState } from 'react';
import { FiLink2, FiCheck } from 'react-icons/fi';
import { getFullShareUrl } from '../utils/shareLinks';
import './CopyShareLinkButton.css';

const CopyShareLinkButton = ({ item, className = '', title }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const url = getFullShareUrl(item);
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const label =
    title ||
    (item?.kind === 'interview'
      ? 'Copy interview link for students'
      : item?.kind === 'assignment'
        ? 'Copy assignment link for students'
        : item?.kind === 'system_design'
          ? 'Copy system design link for students'
          : 'Copy test link for students');

  return (
    <button
      type="button"
      className={`copy-share-link-btn ${copied ? 'copied' : ''} ${className}`.trim()}
      onClick={handleCopy}
      title={copied ? 'Copied!' : label}
      aria-label={copied ? 'Link copied' : label}
    >
      {copied ? <FiCheck aria-hidden="true" /> : <FiLink2 aria-hidden="true" />}
      <span className="copy-share-link-tooltip">{copied ? 'Copied!' : 'Copy link'}</span>
    </button>
  );
};

export default CopyShareLinkButton;
