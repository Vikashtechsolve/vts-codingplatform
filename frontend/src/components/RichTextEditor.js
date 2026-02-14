import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './RichTextEditor.css';

const RichTextEditor = ({
  value = '',
  onChange,
  placeholder = 'Enter content...',
  minHeight = 150,
  readOnly = false,
  id
}) => {
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        ['link'],
        ['clean']
      ],
      clipboard: {
        matchVisual: true
      }
    }),
    []
  );

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'indent',
    'link'
  ];

  return (
    <div className="rich-text-editor-wrapper">
      <ReactQuill
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
