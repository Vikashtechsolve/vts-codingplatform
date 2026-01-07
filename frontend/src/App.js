import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Layout/Navbar';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';

// Super Admin
import SuperAdminDashboard from './pages/SuperAdmin/Dashboard';
import VendorManagement from './pages/SuperAdmin/VendorManagement';
import GlobalQuestions from './pages/SuperAdmin/GlobalQuestions';

// Vendor Admin
import VendorAdminDashboard from './pages/VendorAdmin/Dashboard';
import CreateTest from './pages/VendorAdmin/CreateTest';
import TestList from './pages/VendorAdmin/TestList';
import StudentManagement from './pages/VendorAdmin/StudentManagement';
import CreateCodingQuestion from './pages/VendorAdmin/CreateCodingQuestion';
import CreateMCQQuestion from './pages/VendorAdmin/CreateMCQQuestion';
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

// Student
import StudentDashboard from './pages/Student/Dashboard';
import TestTaking from './pages/Student/TestTaking';
import TestResult from './pages/Student/TestResult';

import './App.css';

// Reuse same components for global questions (they detect route automatically)
const CreateGlobalCodingQuestion = CreateCodingQuestion;
const CreateGlobalMCQQuestion = CreateMCQQuestion;

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

              <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

