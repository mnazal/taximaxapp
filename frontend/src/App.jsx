import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import RoleSelection from './pages/RoleSelection';
import Login from './pages/Login';
import RiderPage from './pages/RiderPage';
import DriverPage from './pages/DriverPage';

// Protected Route component
const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (user.role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<RoleSelection />} />
      <Route path="/auth/:role" element={<Login />} />

      {/* Protected routes */}
      <Route
        path="/rider"
        element={
          <ProtectedRoute allowedRole="rider">
            <RiderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/driver"
        element={
          <ProtectedRoute allowedRole="driver">
            <DriverPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
};

export default App; 