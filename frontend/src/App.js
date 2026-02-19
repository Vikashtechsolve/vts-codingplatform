import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Layout/Navbar';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';

// Super Admin
import SuperAdminDashboard from './pages/SuperAdmin/Dashboard';
import VendorManagement from './pages/SuperAdmin/VendorManagement';
import GlobalQuestions from './pages/SuperAdmin/GlobalQuestions';
import InterviewQuestions from './pages/SuperAdmin/InterviewQuestions';
import InterviewCredits from './pages/SuperAdmin/InterviewCredits';
import InterviewAISettings from './pages/SuperAdmin/InterviewAISettings';

// Vendor Admin
import VendorAdminDashboard from './pages/VendorAdmin/Dashboard';
import CreateTest from './pages/VendorAdmin/CreateTest';
import TestList from './pages/VendorAdmin/TestList';
import StudentManagement from './pages/VendorAdmin/StudentManagement';
import CreateCodingQuestion from './pages/VendorAdmin/CreateCodingQuestion';
import CreateMCQQuestion from './pages/VendorAdmin/CreateMCQQuestion';
import CreateAptitudeQuestion from './pages/VendorAdmin/CreateAptitudeQuestion';
import CreateTheoryQuestion from './pages/VendorAdmin/CreateTheoryQuestion';
import QuestionList from './pages/VendorAdmin/QuestionList';
import Analytics from './pages/VendorAdmin/Analytics';
import VendorSettings from './pages/VendorAdmin/Settings';
import AssignTest from './pages/VendorAdmin/AssignTest';
import TestResults from './pages/VendorAdmin/TestResults';
import ResultDetails from './pages/VendorAdmin/ResultDetails';
import StudentAnalysis from './pages/VendorAdmin/StudentAnalysis';
import ClassroomList from './pages/VendorAdmin/ClassroomList';
import CreateClassroom from './pages/VendorAdmin/CreateClassroom';
import ManageClassroomStudents from './pages/VendorAdmin/ManageClassroomStudents';
import AssignTestToClassroom from './pages/VendorAdmin/AssignTestToClassroom';
import DatasetTemplateList from './pages/VendorAdmin/DatasetTemplateList';
import CreateDatasetTemplate from './pages/VendorAdmin/CreateDatasetTemplate';
import CreateSQLTest from './pages/VendorAdmin/CreateSQLTest';
import SQLTestQuestions from './pages/VendorAdmin/SQLTestQuestions';
import InterviewList from './pages/VendorAdmin/InterviewList';
import CreateInterview from './pages/VendorAdmin/CreateInterview';
import InterviewQuestionList from './pages/VendorAdmin/InterviewQuestionList';
import CreateInterviewQuestion from './pages/VendorAdmin/CreateInterviewQuestion';
import AssignInterview from './pages/VendorAdmin/AssignInterview';
import InterviewResults from './pages/VendorAdmin/InterviewResults';
import InterviewResultDetails from './pages/VendorAdmin/InterviewResultDetails';
import AssignmentList from './pages/VendorAdmin/AssignmentList';
import CreateAssignment from './pages/VendorAdmin/CreateAssignment';
import AssignmentDetails from './pages/VendorAdmin/AssignmentDetails';
import AssignAssignment from './pages/VendorAdmin/AssignAssignment';
import AssignmentSubmissions from './pages/VendorAdmin/AssignmentSubmissions';
import SystemDesignListAdmin from './pages/VendorAdmin/SystemDesignList';
import CreateSystemDesign from './pages/VendorAdmin/CreateSystemDesign';
import AssignSystemDesign from './pages/VendorAdmin/AssignSystemDesign';
import SystemDesignSubmissions from './pages/VendorAdmin/SystemDesignSubmissions';

// Vendor Admin - English
import EnglishQuestionList from './pages/VendorAdmin/EnglishQuestionList';
import CreateEnglishGrammarQuestion from './pages/VendorAdmin/CreateEnglishGrammarQuestion';
import CreateEnglishVocabularyQuestion from './pages/VendorAdmin/CreateEnglishVocabularyQuestion';
import CreateEnglishReadingQuestion from './pages/VendorAdmin/CreateEnglishReadingQuestion';
import CreateEnglishEssayQuestion from './pages/VendorAdmin/CreateEnglishEssayQuestion';
import CreateEnglishSpeakingQuestion from './pages/VendorAdmin/CreateEnglishSpeakingQuestion';
import CreateEnglishListeningQuestion from './pages/VendorAdmin/CreateEnglishListeningQuestion';
import CreateEnglishTest from './pages/VendorAdmin/CreateEnglishTest';

// Student
import StudentDashboard from './pages/Student/Dashboard';
import TestTaking from './pages/Student/TestTaking';
import TestResult from './pages/Student/TestResult';
import TestsByType from './pages/Student/TestsByType';
import MockInterviewRoom from './pages/Student/MockInterviewRoom';
import MockInterviewFeedback from './pages/Student/MockInterviewFeedback';
import AssignmentDashboard from './pages/Student/AssignmentDashboard';
import SubmitAssignment from './pages/Student/SubmitAssignment';
import EvaluationResult from './pages/Student/EvaluationResult';
import SystemDesignListStudent from './pages/Student/SystemDesignList';
import SystemDesignTaking from './pages/Student/SystemDesignTaking';
import SystemDesignFollowUp from './pages/Student/SystemDesignFollowUp';
import SystemDesignResult from './pages/Student/SystemDesignResult';
import EnglishTestTaking from './pages/Student/EnglishTestTaking';
import EnglishTestResult from './pages/Student/EnglishTestResult';

import './App.css';

// Reuse same components for global questions (they detect route automatically)
const CreateGlobalCodingQuestion = CreateCodingQuestion;
const CreateGlobalMCQQuestion = CreateMCQQuestion;
const CreateGlobalAptitudeQuestion = CreateAptitudeQuestion;
const CreateGlobalInterviewQuestion = CreateInterviewQuestion;

// Root route component that redirects based on authentication
const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (user) {
    // Redirect authenticated users to their dashboard
    if (user.role === 'super_admin') {
      return <Navigate to="/super-admin/dashboard" replace />;
    } else if (user.role === 'vendor_admin') {
      return <Navigate to="/vendor-admin/dashboard" replace />;
    } else if (user.role === 'student') {
      return <Navigate to="/student/dashboard" replace />;
    }
  }

  // Redirect unauthenticated users to login
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="App">
            <Navbar />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Super Admin Routes */}
              <Route
                path="/super-admin/dashboard"
                element={
                  <PrivateRoute allowedRoles={['super_admin']}>
                    <SuperAdminDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/super-admin/vendors"
                element={
                  <PrivateRoute allowedRoles={['super_admin']}>
                    <VendorManagement />
                  </PrivateRoute>
                }
              />
              <Route
                path="/super-admin/global-questions"
                element={
                  <PrivateRoute allowedRoles={['super_admin']}>
                    <GlobalQuestions />
                  </PrivateRoute>
                }
              />
              <Route
                path="/super-admin/global-questions/coding/create"
                element={
                  <PrivateRoute allowedRoles={['super_admin']}>
                    <CreateGlobalCodingQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/super-admin/global-questions/coding/edit/:id"
                element={
                  <PrivateRoute allowedRoles={['super_admin']}>
                    <CreateGlobalCodingQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/super-admin/global-questions/mcq/create"
                element={
                  <PrivateRoute allowedRoles={['super_admin']}>
                    <CreateGlobalMCQQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/super-admin/global-questions/mcq/edit/:id"
                element={
                  <PrivateRoute allowedRoles={['super_admin']}>
                    <CreateGlobalMCQQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/super-admin/interview-questions"
                element={
                  <PrivateRoute allowedRoles={['super_admin']}>
                    <InterviewQuestions />
                  </PrivateRoute>
                }
              />
              <Route
                path="/super-admin/interview-questions/create"
                element={
                  <PrivateRoute allowedRoles={['super_admin']}>
                    <CreateGlobalInterviewQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/super-admin/interview-questions/edit/:id"
                element={
                  <PrivateRoute allowedRoles={['super_admin']}>
                    <CreateGlobalInterviewQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/super-admin/interview-credits"
                element={
                  <PrivateRoute allowedRoles={['super_admin']}>
                    <InterviewCredits />
                  </PrivateRoute>
                }
              />
              <Route
                path="/super-admin/interview-ai-settings"
                element={
                  <PrivateRoute allowedRoles={['super_admin']}>
                    <InterviewAISettings />
                  </PrivateRoute>
                }
              />
              <Route
                path="/super-admin/global-questions/aptitude/create"
                element={
                  <PrivateRoute allowedRoles={['super_admin']}>
                    <CreateGlobalAptitudeQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/super-admin/global-questions/aptitude/edit/:id"
                element={
                  <PrivateRoute allowedRoles={['super_admin']}>
                    <CreateGlobalAptitudeQuestion />
                  </PrivateRoute>
                }
              />

              {/* Vendor Admin Routes */}
              <Route
                path="/vendor-admin/dashboard"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <VendorAdminDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/tests"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <TestList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/tests/create"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateTest />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/tests/:testId/assign"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <AssignTest />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/tests/:testId/results"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <TestResults />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/results/:resultId"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <ResultDetails />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/students"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <StudentManagement />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/students/:studentId/analysis"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <StudentAnalysis />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/questions"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <QuestionList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/interviews"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <InterviewList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/interviews/create"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateInterview />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/interviews/results/:sessionId"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <InterviewResultDetails />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/interviews/:interviewId/assign"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <AssignInterview />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/interviews/:interviewId/results"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <InterviewResults />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/interview-questions"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <InterviewQuestionList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/interview-questions/create"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateInterviewQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/interview-questions/edit/:id"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateInterviewQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/questions/coding/create"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateCodingQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/questions/coding/edit/:id"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateCodingQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/questions/mcq/create"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateMCQQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/questions/mcq/edit/:id"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateMCQQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/questions/aptitude/create"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateAptitudeQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/questions/aptitude/edit/:id"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateAptitudeQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/questions/theory/create"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateTheoryQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/questions/theory/edit/:id"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateTheoryQuestion />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/analytics"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <Analytics />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/settings"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <VendorSettings />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/classrooms"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <ClassroomList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/classrooms/create"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateClassroom />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/classrooms/:id/edit"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateClassroom />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/classrooms/:id/students"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <ManageClassroomStudents />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/classrooms/:id/tests"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <AssignTestToClassroom />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/dataset-templates"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <DatasetTemplateList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/dataset-templates/create"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateDatasetTemplate />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/dataset-templates/:id/edit"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateDatasetTemplate />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/sql-tests/create"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateSQLTest />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/sql-tests/:testId/questions"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <SQLTestQuestions />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/assignments"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <AssignmentList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/assignments/:id"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <AssignmentDetails />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/create-assignment"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateAssignment />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/assignments/:id/edit"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateAssignment />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/assignments/:id/assign"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <AssignAssignment />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/assignments/:id/submissions"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <AssignmentSubmissions />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/submission/:submissionId/result"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <EvaluationResult />
                  </PrivateRoute>
                }
              />

              {/* System Design - Vendor Admin */}
              <Route
                path="/vendor-admin/system-designs"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <SystemDesignListAdmin />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/system-designs/create"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateSystemDesign />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/system-designs/:id/edit"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <CreateSystemDesign />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/system-designs/:id/assign"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <AssignSystemDesign />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/system-designs/:id/submissions"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <SystemDesignSubmissions />
                  </PrivateRoute>
                }
              />
              <Route
                path="/vendor-admin/system-design-result/:submissionId"
                element={
                  <PrivateRoute allowedRoles={['vendor_admin']}>
                    <SystemDesignResult />
                  </PrivateRoute>
                }
              />

              {/* English / Verbal - Vendor Admin */}
              <Route path="/vendor-admin/english-questions" element={<PrivateRoute allowedRoles={['vendor_admin']}><EnglishQuestionList /></PrivateRoute>} />
              <Route path="/vendor-admin/english-questions/grammar/create" element={<PrivateRoute allowedRoles={['vendor_admin']}><CreateEnglishGrammarQuestion /></PrivateRoute>} />
              <Route path="/vendor-admin/english-questions/grammar/edit/:id" element={<PrivateRoute allowedRoles={['vendor_admin']}><CreateEnglishGrammarQuestion /></PrivateRoute>} />
              <Route path="/vendor-admin/english-questions/vocabulary/create" element={<PrivateRoute allowedRoles={['vendor_admin']}><CreateEnglishVocabularyQuestion /></PrivateRoute>} />
              <Route path="/vendor-admin/english-questions/vocabulary/edit/:id" element={<PrivateRoute allowedRoles={['vendor_admin']}><CreateEnglishVocabularyQuestion /></PrivateRoute>} />
              <Route path="/vendor-admin/english-questions/reading/create" element={<PrivateRoute allowedRoles={['vendor_admin']}><CreateEnglishReadingQuestion /></PrivateRoute>} />
              <Route path="/vendor-admin/english-questions/reading/edit/:id" element={<PrivateRoute allowedRoles={['vendor_admin']}><CreateEnglishReadingQuestion /></PrivateRoute>} />
              <Route path="/vendor-admin/english-questions/essay/create" element={<PrivateRoute allowedRoles={['vendor_admin']}><CreateEnglishEssayQuestion /></PrivateRoute>} />
              <Route path="/vendor-admin/english-questions/essay/edit/:id" element={<PrivateRoute allowedRoles={['vendor_admin']}><CreateEnglishEssayQuestion /></PrivateRoute>} />
              <Route path="/vendor-admin/english-questions/speaking/create" element={<PrivateRoute allowedRoles={['vendor_admin']}><CreateEnglishSpeakingQuestion /></PrivateRoute>} />
              <Route path="/vendor-admin/english-questions/speaking/edit/:id" element={<PrivateRoute allowedRoles={['vendor_admin']}><CreateEnglishSpeakingQuestion /></PrivateRoute>} />
              <Route path="/vendor-admin/english-questions/listening/create" element={<PrivateRoute allowedRoles={['vendor_admin']}><CreateEnglishListeningQuestion /></PrivateRoute>} />
              <Route path="/vendor-admin/english-questions/listening/edit/:id" element={<PrivateRoute allowedRoles={['vendor_admin']}><CreateEnglishListeningQuestion /></PrivateRoute>} />
              <Route path="/vendor-admin/english-tests/create" element={<PrivateRoute allowedRoles={['vendor_admin']}><CreateEnglishTest /></PrivateRoute>} />
              <Route path="/vendor-admin/english-tests/edit/:id" element={<PrivateRoute allowedRoles={['vendor_admin']}><CreateEnglishTest /></PrivateRoute>} />

              {/* Student Routes */}
              <Route
                path="/student/dashboard"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <StudentDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/student/tests/:type"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <TestsByType />
                  </PrivateRoute>
                }
              />
              <Route
                path="/student/interviews"
                element={<Navigate to="/student/tests/interview" replace />}
              />
              <Route
                path="/student/interviews/feedback/:sessionId"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <MockInterviewFeedback />
                  </PrivateRoute>
                }
              />
              <Route
                path="/student/interviews/:interviewId"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <MockInterviewRoom />
                  </PrivateRoute>
                }
              />
              <Route
                path="/student/test/:testId"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <TestTaking />
                  </PrivateRoute>
                }
              />
              <Route
                path="/student/result/:resultId"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <TestResult />
                  </PrivateRoute>
                }
              />
              <Route
                path="/student/result/test/:testId"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <TestResult />
                  </PrivateRoute>
                }
              />
              <Route
                path="/student/assignments"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <AssignmentDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/student/submit-assignment/:assignmentId"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <SubmitAssignment />
                  </PrivateRoute>
                }
              />
              <Route
                path="/student/submission/:submissionId/result"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <EvaluationResult />
                  </PrivateRoute>
                }
              />

              {/* English / Verbal - Student */}
              <Route path="/student/english-test/:testId" element={<PrivateRoute allowedRoles={['student']}><EnglishTestTaking /></PrivateRoute>} />
              <Route path="/student/english-result/:resultId" element={<PrivateRoute allowedRoles={['student']}><EnglishTestResult /></PrivateRoute>} />

              {/* System Design - Student */}
              <Route
                path="/student/system-designs"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <SystemDesignListStudent />
                  </PrivateRoute>
                }
              />
              <Route
                path="/student/system-design/:problemId"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <SystemDesignTaking />
                  </PrivateRoute>
                }
              />
              <Route
                path="/student/system-design/:submissionId/follow-up"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <SystemDesignFollowUp />
                  </PrivateRoute>
                }
              />
              <Route
                path="/student/system-design-result/:submissionId"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <SystemDesignResult />
                  </PrivateRoute>
                }
              />

              <Route path="/" element={<RootRedirect />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

