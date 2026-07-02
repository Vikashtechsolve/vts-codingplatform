import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import SuperAdminDashboard from '../pages/SuperAdmin/Dashboard';
import VendorManagement from '../pages/SuperAdmin/VendorManagement';
import GlobalQuestions from '../pages/SuperAdmin/GlobalQuestions';
import InterviewQuestions from '../pages/SuperAdmin/InterviewQuestions';
import InterviewCredits from '../pages/SuperAdmin/InterviewCredits';
import InterviewAISettings from '../pages/SuperAdmin/InterviewAISettings';
import CreateCodingQuestion from '../pages/VendorAdmin/CreateCodingQuestion';
import CreateMCQQuestion from '../pages/VendorAdmin/CreateMCQQuestion';
import CreateAptitudeQuestion from '../pages/VendorAdmin/CreateAptitudeQuestion';
import CreateInterviewQuestion from '../pages/VendorAdmin/CreateInterviewQuestion';

const SuperAdminRoutes = (
  <>
    <Route index element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={<SuperAdminDashboard />} />
    <Route path="vendors" element={<VendorManagement />} />
    <Route path="global-questions" element={<GlobalQuestions />} />
    <Route path="global-questions/coding/create" element={<CreateCodingQuestion />} />
    <Route path="global-questions/coding/edit/:id" element={<CreateCodingQuestion />} />
    <Route path="global-questions/mcq/create" element={<CreateMCQQuestion />} />
    <Route path="global-questions/mcq/edit/:id" element={<CreateMCQQuestion />} />
    <Route path="global-questions/aptitude/create" element={<CreateAptitudeQuestion />} />
    <Route path="global-questions/aptitude/edit/:id" element={<CreateAptitudeQuestion />} />
    <Route path="interview-questions" element={<InterviewQuestions />} />
    <Route path="interview-questions/create" element={<CreateInterviewQuestion />} />
    <Route path="interview-questions/edit/:id" element={<CreateInterviewQuestion />} />
    <Route path="interview-credits" element={<InterviewCredits />} />
    <Route path="interview-ai-settings" element={<InterviewAISettings />} />
  </>
);

export default SuperAdminRoutes;
