import { useLocation } from 'react-router-dom';
import { QUESTION_FORM_META } from '../utils/vendorQuestionFormMeta';

export function useEnglishQuestionFormRoutes(section) {
  const location = useLocation();
  const isGlobalEnglish = location.pathname.includes('/super-admin/global-questions/english');
  const englishApiBase = isGlobalEnglish
    ? '/super-admin/global-questions/english'
    : '/questions/english';
  const meta = QUESTION_FORM_META.english;

  return {
    isGlobalEnglish,
    englishApiBase,
    sectionEndpoint: `${englishApiBase}/${section}`,
    backTo: isGlobalEnglish ? '/super-admin/global-questions/english' : meta.back,
    meta,
  };
}
