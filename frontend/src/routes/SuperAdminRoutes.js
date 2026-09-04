import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import SuperAdminDashboard from '../pages/SuperAdmin/Dashboard';
import VendorManagement from '../pages/SuperAdmin/VendorManagement';
import VendorEditor from '../pages/SuperAdmin/VendorEditor';
import GlobalQuestions from '../pages/SuperAdmin/GlobalQuestions';
import InterviewQuestions from '../pages/SuperAdmin/InterviewQuestions';
import InterviewCredits from '../pages/SuperAdmin/InterviewCredits';
import InterviewAISettings from '../pages/SuperAdmin/InterviewAISettings';
import Courses from '../pages/SuperAdmin/Courses';
import CourseEditor from '../pages/SuperAdmin/CourseEditor';
import CreateCodingQuestion from '../pages/VendorAdmin/CreateCodingQuestion';
import CreateMCQQuestion from '../pages/VendorAdmin/CreateMCQQuestion';
import CreateAptitudeQuestion from '../pages/VendorAdmin/CreateAptitudeQuestion';
import CreateInterviewQuestion from '../pages/VendorAdmin/CreateInterviewQuestion';
import CreateTheoryQuestion from '../pages/VendorAdmin/CreateTheoryQuestion';
import CreateEnglishGrammarQuestion from '../pages/VendorAdmin/CreateEnglishGrammarQuestion';
import CreateEnglishVocabularyQuestion from '../pages/VendorAdmin/CreateEnglishVocabularyQuestion';
import CreateEnglishReadingQuestion from '../pages/VendorAdmin/CreateEnglishReadingQuestion';
import CreateEnglishEssayQuestion from '../pages/VendorAdmin/CreateEnglishEssayQuestion';
import CreateEnglishSpeakingQuestion from '../pages/VendorAdmin/CreateEnglishSpeakingQuestion';
import CreateEnglishListeningQuestion from '../pages/VendorAdmin/CreateEnglishListeningQuestion';
import CreateTest from '../pages/VendorAdmin/CreateTest';
import CreateEnglishTest from '../pages/VendorAdmin/CreateEnglishTest';
import CreateSQLTest from '../pages/VendorAdmin/CreateSQLTest';
import CreateInterview from '../pages/VendorAdmin/CreateInterview';
import CreateAssignment from '../pages/VendorAdmin/CreateAssignment';
import CreateSystemDesign from '../pages/VendorAdmin/CreateSystemDesign';
import SQLTestQuestions from '../pages/VendorAdmin/SQLTestQuestions';
import DatasetTemplateList from '../pages/VendorAdmin/DatasetTemplateList';
import CreateDatasetTemplate from '../pages/VendorAdmin/CreateDatasetTemplate';
import PlatformTests from '../pages/SuperAdmin/PlatformTests';
import PlatformAssessments from '../pages/SuperAdmin/PlatformAssessments';
import AllocatePlatformTest from '../pages/SuperAdmin/AllocatePlatformTest';
import AllocatePlatformAssessment from '../pages/SuperAdmin/AllocatePlatformAssessment';
import GlobalEnglishQuestions from '../pages/SuperAdmin/GlobalEnglishQuestions';

const SuperAdminRoutes = (
  <>
    <Route index element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={<SuperAdminDashboard />} />
    <Route path="vendors" element={<VendorManagement />} />
    <Route path="vendors/:vendorId/edit" element={<VendorEditor />} />
    <Route path="courses" element={<Courses />} />
    <Route path="courses/:courseId" element={<CourseEditor />} />
    <Route path="tests" element={<PlatformTests />} />
    <Route path="tests/create" element={<CreateTest />} />
    <Route path="tests/edit/:testId" element={<CreateTest />} />
    <Route path="tests/english/create" element={<CreateEnglishTest />} />
    <Route path="tests/english/edit/:testId" element={<CreateEnglishTest />} />
    <Route path="tests/sql/create" element={<CreateSQLTest />} />
    <Route path="tests/sql/edit/:testId" element={<CreateSQLTest />} />
    <Route path="tests/sql/:testId/questions" element={<SQLTestQuestions />} />
    <Route path="tests/dataset-templates" element={<DatasetTemplateList />} />
    <Route path="tests/dataset-templates/create" element={<CreateDatasetTemplate />} />
    <Route path="tests/dataset-templates/:id/edit" element={<CreateDatasetTemplate />} />
    <Route path="tests/:testId/allocate" element={<AllocatePlatformTest />} />
    <Route path="assessments" element={<PlatformAssessments />} />
    <Route path="assessments/interviews/create" element={<CreateInterview />} />
    <Route path="assessments/interviews/edit/:interviewId" element={<CreateInterview />} />
    <Route path="assessments/interviews/:resourceId/allocate" element={<AllocatePlatformAssessment />} />
    <Route path="assessments/assignments/create" element={<CreateAssignment />} />
    <Route path="assessments/assignments/edit/:id" element={<CreateAssignment />} />
    <Route path="assessments/assignments/:resourceId/allocate" element={<AllocatePlatformAssessment />} />
    <Route path="assessments/system-design/create" element={<CreateSystemDesign />} />
    <Route path="assessments/system-design/edit/:id" element={<CreateSystemDesign />} />
    <Route path="assessments/system-design/:resourceId/allocate" element={<AllocatePlatformAssessment />} />
    <Route path="global-questions" element={<GlobalQuestions />} />
    <Route path="global-questions/coding/create" element={<CreateCodingQuestion />} />
    <Route path="global-questions/coding/edit/:id" element={<CreateCodingQuestion />} />
    <Route path="global-questions/mcq/create" element={<CreateMCQQuestion />} />
    <Route path="global-questions/mcq/edit/:id" element={<CreateMCQQuestion />} />
    <Route path="global-questions/aptitude/create" element={<CreateAptitudeQuestion />} />
    <Route path="global-questions/aptitude/edit/:id" element={<CreateAptitudeQuestion />} />
    <Route path="global-questions/theory/create" element={<CreateTheoryQuestion />} />
    <Route path="global-questions/theory/edit/:id" element={<CreateTheoryQuestion />} />
    <Route path="global-questions/english" element={<GlobalEnglishQuestions />} />
    <Route path="global-questions/english/grammar/create" element={<CreateEnglishGrammarQuestion />} />
    <Route path="global-questions/english/grammar/edit/:id" element={<CreateEnglishGrammarQuestion />} />
    <Route path="global-questions/english/vocabulary/create" element={<CreateEnglishVocabularyQuestion />} />
    <Route path="global-questions/english/vocabulary/edit/:id" element={<CreateEnglishVocabularyQuestion />} />
    <Route path="global-questions/english/reading/create" element={<CreateEnglishReadingQuestion />} />
    <Route path="global-questions/english/reading/edit/:id" element={<CreateEnglishReadingQuestion />} />
    <Route path="global-questions/english/essay/create" element={<CreateEnglishEssayQuestion />} />
    <Route path="global-questions/english/essay/edit/:id" element={<CreateEnglishEssayQuestion />} />
    <Route path="global-questions/english/speaking/create" element={<CreateEnglishSpeakingQuestion />} />
    <Route path="global-questions/english/speaking/edit/:id" element={<CreateEnglishSpeakingQuestion />} />
    <Route path="global-questions/english/listening/create" element={<CreateEnglishListeningQuestion />} />
    <Route path="global-questions/english/listening/edit/:id" element={<CreateEnglishListeningQuestion />} />
    <Route path="interview-questions" element={<InterviewQuestions />} />
    <Route path="interview-questions/create" element={<CreateInterviewQuestion />} />
    <Route path="interview-questions/edit/:id" element={<CreateInterviewQuestion />} />
    <Route path="interview-credits" element={<InterviewCredits />} />
    <Route path="interview-ai-settings" element={<InterviewAISettings />} />
  </>
);

export default SuperAdminRoutes;
