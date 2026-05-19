import React from 'react';
import PrivateRoute from '../PrivateRoute';
import { StudentPanelProvider } from '../../context/StudentPanelContext';
import StudentLayout from './StudentLayout';

const StudentShell = () => (
  <PrivateRoute allowedRoles={['student']}>
    <StudentPanelProvider>
      <StudentLayout />
    </StudentPanelProvider>
  </PrivateRoute>
);

export default StudentShell;
