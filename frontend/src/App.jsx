import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Brands from './pages/Brands';
import Products from './pages/Products';
import StockEntry from './pages/StockEntry';
import StockList from './pages/StockList';
import StockDetails from './pages/StockDetails';
import Reports from './pages/Reports';
import DailyStock from './pages/DailyStock';
import Expenses from './pages/Expenses';
import ClosingHistory from './pages/ClosingHistory';
import ShopManagement from './pages/ShopManagement';
import Sizes from './pages/Sizes';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-stock"
            element={
              <ProtectedRoute>
                <DailyStock />
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <Expenses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/closing-history"
            element={
              <ProtectedRoute>
                <ClosingHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <ClosingHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shops"
            element={
              <ProtectedRoute adminOnly={true}>
                <ShopManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/brands"
            element={
              <ProtectedRoute adminOnly={true}>
                <Brands />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sizes"
            element={
              <ProtectedRoute adminOnly={true}>
                <Sizes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <Products />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock/entry"
            element={
              <ProtectedRoute adminOnly={true}>
                <StockEntry />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock/list"
            element={
              <ProtectedRoute>
                <StockList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock/details/:id"
            element={
              <ProtectedRoute>
                <StockDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
