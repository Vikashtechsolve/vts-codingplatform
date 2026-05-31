import React from 'react';
import Modal from '../Modal';
import VendorQuestionFormPage from './VendorQuestionFormPage';
import { QUESTION_FORM_META } from '../../utils/vendorQuestionFormMeta';

export function EnglishFormModal({ modal, onClose }) {
  return (
    <Modal isOpen={modal.isOpen} onClose={onClose} title={modal.title} type={modal.type}>
      <p>{modal.message}</p>
    </Modal>
  );
}

export function EnglishQuestionFormShell({
  subtype,
  title,
  subtitle,
  pageLoading = false,
  modal,
  formId,
  onCancel,
  saving = false,
  isEditMode = false,
  children,
}) {
  const meta = QUESTION_FORM_META.english;
  const footer = (
    <div className="form-actions">
      <button type="button" onClick={onCancel} className="btn btn-secondary">
        Cancel
      </button>
      <button type="submit" form={formId} className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : isEditMode ? 'Update question' : 'Create question'}
      </button>
    </div>
  );

  return (
    <VendorQuestionFormPage
      className="create-english-question"
      loading={pageLoading}
      backTo={meta.back}
      backLabel="Back to English questions"
      eyebrow={`${meta.label} · ${subtype}`}
      title={title}
      subtitle={subtitle}
      accent={meta.accent}
      modal={modal}
      footer={footer}
    >
      {children}
    </VendorQuestionFormPage>
  );
}
