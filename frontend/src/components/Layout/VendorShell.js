import React from 'react';
import PrivateRoute from '../PrivateRoute';
import { VendorPanelProvider } from '../../context/VendorPanelContext';
import VendorLayout from './VendorLayout';

const VendorShell = () => (
  <PrivateRoute allowedRoles={['vendor_admin']}>
    <VendorPanelProvider>
      <VendorLayout />
    </VendorPanelProvider>
  </PrivateRoute>
);

export default VendorShell;
