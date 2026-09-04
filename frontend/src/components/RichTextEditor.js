import React, { useMemo, useRef, useCallback, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { registerClipboardMatchers } from '../utils/richTextPaste';
import './RichTextEditor.css';

const STANDARD_TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  ['link'],
  ['clean'],
];

const FULL_TOOLBAR = [
  [{ header: [1, 2, 3, 4, false] }],
  [{ size: ['small', false, 'large', 'huge'] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ script: 'sub' }, { script: 'super' }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ align: [] }],
  ['blockquote', 'code-block'],
  ['link', 'image', 'video'],
  ['clean'],
];

const STANDARD_FORMATS = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list', 'bullet', 'indent',
  'link',
];

const FULL_FORMATS = [
  'header', 'size',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'script',
  'list', 'bullet', 'indent',
  'align',
  'blockquote', 'code-block',
  'link', 'image', 'video',
];

const RichTextEditor = ({
  value = '',
  onChange,
  placeholder = 'Enter content...',
  minHeight = 150,
  readOnly = false,
  id,
  variant = 'standard',
  className = '',
}) => {
  const quillRef = useRef(null);

  const imageHandler = useCallback(function imageHandler() {
    const quill = this.quill;
    const url = window.prompt(
      'Image URL\n\nPaste a direct link (https://...) to embed the image in the question.'
    );
    if (!url || !url.trim()) return;
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      window.alert('Please use a valid http or https image URL.');
      return;
    }
    const range = quill.getSelection(true);
    const index = range ? range.index : quill.getLength();
    quill.insertEmbed(index, 'image', trimmed, 'user');
    quill.setSelection(index + 1);
  }, []);

  const videoHandler = useCallback(function videoHandler() {
    const quill = this.quill;
    const url = window.prompt('Video URL\n\nPaste a YouTube or direct video link.');
    if (!url || !url.trim()) return;
    const range = quill.getSelection(true);
    const index = range ? range.index : quill.getLength();
    quill.insertEmbed(index, 'video', url.trim(), 'user');
    quill.setSelection(index + 1);
  }, []);

  const modules = useMemo(() => {
    const isFull = variant === 'full';
    return {
      toolbar: {
        container: isFull ? FULL_TOOLBAR : STANDARD_TOOLBAR,
        handlers: isFull
          ? {
              image: imageHandler,
              video: videoHandler,
            }
          : {},
      },
      clipboard: {
        // Full notes: keep visual structure from Notion/Docs/web paste.
        matchVisual: isFull,
      },
    };
  }, [variant, imageHandler, videoHandler]);

  useEffect(() => {
    const bind = () => {
      const editor = quillRef.current?.getEditor?.();
      if (editor) registerClipboardMatchers(editor);
    };
    bind();
    const id = window.requestAnimationFrame(bind);
    return () => window.cancelAnimationFrame(id);
  }, [variant]);

  const formats = variant === 'full' ? FULL_FORMATS : STANDARD_FORMATS;

  return (
    <div className={`rich-text-editor-wrapper rich-text-editor-wrapper--${variant} ${className}`.trim()}>
      {variant === 'full' && (
        <p className="rich-text-editor-hint">
          Paste from Notion, Google Docs, or the web — headings, lists, colors, highlights, and code are kept.
        </p>
      )}
      <ReactQuill
        ref={quillRef}
        id={id}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly}
        className="rich-text-editor"
        style={{ minHeight: `${minHeight}px` }}
      />
    </div>
  );
};

export default RichTextEditor;
