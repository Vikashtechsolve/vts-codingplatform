import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import StudentShell from './components/Layout/StudentShell';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AnnouncementProvider } from './context/AnnouncementContext';
import { ExamLockProvider } from './context/ExamLockContext';
import { VendorBrandingProvider } from './context/VendorBrandingContext';
import ExamNavigationGuard from './components/ExamNavigationGuard';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Layout/Navbar';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import JoinAttempt from './pages/JoinAttempt';
import ContestLanding from './pages/Contest/ContestLanding';

// Super Admin (routes in routes/SuperAdminRoutes.js)
import SuperAdminShell from './components/Layout/SuperAdminShell';
import SuperAdminRoutes from './routes/SuperAdminRoutes';

// Vendor Admin (routes in routes/VendorAdminRoutes.js)
import VendorShell from './components/Layout/VendorShell';
import VendorAdminRoutes from './routes/VendorAdminRoutes';

// Reused by super-admin global question routes (also routed via SuperAdminRoutes)

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
import StudentAnnouncements from './pages/Student/StudentAnnouncements';
import StudentCourses from './pages/Student/Courses';
import CoursePlayer from './pages/Student/CoursePlayer';
import LecturePlayer from './pages/Student/LecturePlayer';

import './App.css';
import './styles/student-panel-dark.css';
import './styles/vendor-assessment-pages.css';
import './styles/courses-pages.css';
import './styles/vendor-hub-pages.css';
import './styles/super-admin-pages.css';
import './styles/vendor-question-form.css';
import './styles/vendor-test-form.css';

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
      <ToastProvider>
      <AuthProvider>
        <AnnouncementProvider>
        <VendorBrandingProvider>
        <Router>
          <ExamLockProvider>
          <div className="App">
            <ExamNavigationGuard />
            <Navbar />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/contest/:slug" element={<ContestLanding />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              {/* Student share links — open assessment after login */}
              <Route path="/join/test/:testId" element={<JoinAttempt kind="test" />} />
              <Route path="/join/interview/:interviewId" element={<JoinAttempt kind="interview" />} />
              <Route path="/join/assignment/:assignmentId" element={<JoinAttempt kind="assignment" />} />
              <Route path="/join/system-design/:problemId" element={<JoinAttempt kind="system-design" />} />
              
              {/* Super Admin — sidebar layout */}
              <Route path="/super-admin" element={<SuperAdminShell />}>
                {SuperAdminRoutes}
              </Route>

              {/* Vendor Admin — sidebar layout */}
              <Route path="/vendor-admin" element={<VendorShell />}>
                {VendorAdminRoutes}
              </Route>

              {/* Student panel — sidebar layout for dashboard & test sections */}
              <Route path="/student" element={<StudentShell />}>
                <Route path="dashboard" element={<StudentDashboard />} />
                <Route path="announcements" element={<StudentAnnouncements />} />
                <Route path="announcements/:id" element={<StudentAnnouncements />} />
                <Route path="courses" element={<StudentCourses />} />
                <Route path="courses/:courseId" element={<CoursePlayer />} />
                <Route path="courses/:courseId/lectures/:lectureId" element={<LecturePlayer />} />
                <Route path="tests/:type" element={<TestsByType />} />
              </Route>
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
                path="/student/result/test/:testId"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <TestResult />
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
          </ExamLockProvider>
        </Router>
        </VendorBrandingProvider>
        </AnnouncementProvider>
      </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;

