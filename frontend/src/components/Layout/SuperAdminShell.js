import React from 'react';
import PrivateRoute from '../PrivateRoute';
import SuperAdminLayout from './SuperAdminLayout';

const SuperAdminShell = () => (
  <PrivateRoute allowedRoles={['super_admin']}>
    <SuperAdminLayout />
  </PrivateRoute>
);

export default SuperAdminShell;
