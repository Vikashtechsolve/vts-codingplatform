import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import VendorAdminDashboard from '../pages/VendorAdmin/Dashboard';
import CreateTest from '../pages/VendorAdmin/CreateTest';
import TestList from '../pages/VendorAdmin/TestList';
import StudentManagement from '../pages/VendorAdmin/StudentManagement';
import CreateCodingQuestion from '../pages/VendorAdmin/CreateCodingQuestion';
import CreateMCQQuestion from '../pages/VendorAdmin/CreateMCQQuestion';
import CreateAptitudeQuestion from '../pages/VendorAdmin/CreateAptitudeQuestion';
import CreateTheoryQuestion from '../pages/VendorAdmin/CreateTheoryQuestion';
import QuestionList from '../pages/VendorAdmin/QuestionList';
import Analytics from '../pages/VendorAdmin/Analytics';
import VendorSettings from '../pages/VendorAdmin/Settings';
import AssignTest from '../pages/VendorAdmin/AssignTest';
import TestResults from '../pages/VendorAdmin/TestResults';
import ResultDetails from '../pages/VendorAdmin/ResultDetails';
import StudentAnalysis from '../pages/VendorAdmin/StudentAnalysis';
import ClassroomList from '../pages/VendorAdmin/ClassroomList';
import CreateClassroom from '../pages/VendorAdmin/CreateClassroom';
import ManageClassroomStudents from '../pages/VendorAdmin/ManageClassroomStudents';
import AssignTestToClassroom from '../pages/VendorAdmin/AssignTestToClassroom';
import DatasetTemplateList from '../pages/VendorAdmin/DatasetTemplateList';
import CreateDatasetTemplate from '../pages/VendorAdmin/CreateDatasetTemplate';
import CreateSQLTest from '../pages/VendorAdmin/CreateSQLTest';
import SQLTestQuestions from '../pages/VendorAdmin/SQLTestQuestions';
import CreateInterview from '../pages/VendorAdmin/CreateInterview';
import InterviewQuestionList from '../pages/VendorAdmin/InterviewQuestionList';
import CreateInterviewQuestion from '../pages/VendorAdmin/CreateInterviewQuestion';
import AssignInterview from '../pages/VendorAdmin/AssignInterview';
import InterviewResults from '../pages/VendorAdmin/InterviewResults';
import InterviewResultDetails from '../pages/VendorAdmin/InterviewResultDetails';
import CreateAssignment from '../pages/VendorAdmin/CreateAssignment';
import AssignmentDetails from '../pages/VendorAdmin/AssignmentDetails';
import AssignAssignment from '../pages/VendorAdmin/AssignAssignment';
import AssignmentSubmissions from '../pages/VendorAdmin/AssignmentSubmissions';
import CreateSystemDesign from '../pages/VendorAdmin/CreateSystemDesign';
import AssignSystemDesign from '../pages/VendorAdmin/AssignSystemDesign';
import SystemDesignSubmissions from '../pages/VendorAdmin/SystemDesignSubmissions';
import AnnouncementList from '../pages/VendorAdmin/AnnouncementList';
import CreateAnnouncement from '../pages/VendorAdmin/CreateAnnouncement';
import EnglishQuestionList from '../pages/VendorAdmin/EnglishQuestionList';
import CreateEnglishGrammarQuestion from '../pages/VendorAdmin/CreateEnglishGrammarQuestion';
import CreateEnglishVocabularyQuestion from '../pages/VendorAdmin/CreateEnglishVocabularyQuestion';
import CreateEnglishReadingQuestion from '../pages/VendorAdmin/CreateEnglishReadingQuestion';
import CreateEnglishEssayQuestion from '../pages/VendorAdmin/CreateEnglishEssayQuestion';
import CreateEnglishSpeakingQuestion from '../pages/VendorAdmin/CreateEnglishSpeakingQuestion';
import CreateEnglishListeningQuestion from '../pages/VendorAdmin/CreateEnglishListeningQuestion';
import CreateEnglishTest from '../pages/VendorAdmin/CreateEnglishTest';
import EvaluationResult from '../pages/Student/EvaluationResult';
import SystemDesignResult from '../pages/Student/SystemDesignResult';

const VendorAdminRoutes = (
  <>
    <Route index element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={<VendorAdminDashboard />} />
    <Route path="tests" element={<TestList />} />
    <Route path="tests/create" element={<CreateTest />} />
    <Route path="tests/:testId/edit" element={<CreateTest />} />
    <Route path="tests/:testId/assign" element={<AssignTest />} />
    <Route path="tests/:testId/results" element={<TestResults />} />
    <Route path="results/:resultId" element={<ResultDetails />} />
    <Route path="students" element={<StudentManagement />} />
    <Route path="students/:studentId/analysis" element={<StudentAnalysis />} />
    <Route path="questions" element={<QuestionList />} />
    <Route path="interviews" element={<Navigate to="/vendor-admin/tests?type=interview" replace />} />
    <Route path="interviews/create" element={<CreateInterview />} />
    <Route path="interviews/:interviewId/edit" element={<CreateInterview />} />
    <Route path="interviews/results/:sessionId" element={<InterviewResultDetails />} />
    <Route path="interviews/:interviewId/assign" element={<AssignInterview />} />
    <Route path="interviews/:interviewId/results" element={<InterviewResults />} />
    <Route path="interview-questions" element={<InterviewQuestionList />} />
    <Route path="interview-questions/create" element={<CreateInterviewQuestion />} />
    <Route path="interview-questions/edit/:id" element={<CreateInterviewQuestion />} />
    <Route path="questions/coding/create" element={<CreateCodingQuestion />} />
    <Route path="questions/coding/edit/:id" element={<CreateCodingQuestion />} />
    <Route path="questions/mcq/create" element={<CreateMCQQuestion />} />
    <Route path="questions/mcq/edit/:id" element={<CreateMCQQuestion />} />
    <Route path="questions/aptitude/create" element={<CreateAptitudeQuestion />} />
    <Route path="questions/aptitude/edit/:id" element={<CreateAptitudeQuestion />} />
    <Route path="questions/theory/create" element={<CreateTheoryQuestion />} />
    <Route path="questions/theory/edit/:id" element={<CreateTheoryQuestion />} />
    <Route path="analytics" element={<Analytics />} />
    <Route path="settings" element={<VendorSettings />} />
    <Route path="classrooms" element={<ClassroomList />} />
    <Route path="classrooms/create" element={<CreateClassroom />} />
    <Route path="classrooms/:id/edit" element={<CreateClassroom />} />
    <Route path="classrooms/:id/students" element={<ManageClassroomStudents />} />
    <Route path="classrooms/:id/tests" element={<AssignTestToClassroom />} />
    <Route path="dataset-templates" element={<DatasetTemplateList />} />
    <Route path="dataset-templates/create" element={<CreateDatasetTemplate />} />
    <Route path="dataset-templates/:id/edit" element={<CreateDatasetTemplate />} />
    <Route path="sql-tests/create" element={<CreateSQLTest />} />
    <Route path="sql-tests/:testId/edit" element={<CreateSQLTest />} />
    <Route path="sql-tests/:testId/questions" element={<SQLTestQuestions />} />
    <Route path="assignments" element={<Navigate to="/vendor-admin/tests?type=project" replace />} />
    <Route path="assignments/:id" element={<AssignmentDetails />} />
    <Route path="create-assignment" element={<CreateAssignment />} />
    <Route path="assignments/:id/edit" element={<CreateAssignment />} />
    <Route path="assignments/:id/assign" element={<AssignAssignment />} />
    <Route path="assignments/:id/submissions" element={<AssignmentSubmissions />} />
    <Route path="submission/:submissionId/result" element={<EvaluationResult />} />
    <Route path="system-designs" element={<Navigate to="/vendor-admin/tests?type=system" replace />} />
    <Route path="system-designs/create" element={<CreateSystemDesign />} />
    <Route path="system-designs/:id/edit" element={<CreateSystemDesign />} />
    <Route path="system-designs/:id/assign" element={<AssignSystemDesign />} />
    <Route path="system-designs/:id/submissions" element={<SystemDesignSubmissions />} />
    <Route path="system-design-result/:submissionId" element={<SystemDesignResult />} />
    <Route path="announcements" element={<AnnouncementList />} />
    <Route path="announcements/create" element={<CreateAnnouncement />} />
    <Route path="announcements/:id/edit" element={<CreateAnnouncement />} />
    <Route path="english-questions" element={<EnglishQuestionList />} />
    <Route path="english-questions/grammar/create" element={<CreateEnglishGrammarQuestion />} />
    <Route path="english-questions/grammar/edit/:id" element={<CreateEnglishGrammarQuestion />} />
    <Route path="english-questions/vocabulary/create" element={<CreateEnglishVocabularyQuestion />} />
    <Route path="english-questions/vocabulary/edit/:id" element={<CreateEnglishVocabularyQuestion />} />
    <Route path="english-questions/reading/create" element={<CreateEnglishReadingQuestion />} />
    <Route path="english-questions/reading/edit/:id" element={<CreateEnglishReadingQuestion />} />
    <Route path="english-questions/essay/create" element={<CreateEnglishEssayQuestion />} />
    <Route path="english-questions/essay/edit/:id" element={<CreateEnglishEssayQuestion />} />
    <Route path="english-questions/speaking/create" element={<CreateEnglishSpeakingQuestion />} />
    <Route path="english-questions/speaking/edit/:id" element={<CreateEnglishSpeakingQuestion />} />
    <Route path="english-questions/listening/create" element={<CreateEnglishListeningQuestion />} />
    <Route path="english-questions/listening/edit/:id" element={<CreateEnglishListeningQuestion />} />
    <Route path="english-tests/create" element={<CreateEnglishTest />} />
    <Route path="english-tests/edit/:id" element={<CreateEnglishTest />} />
  </>
);

export default VendorAdminRoutes;
