import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AdminLayout from '../AdminLayout';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  getAdminStats: jest.fn(),
  getSystemHealth: jest.fn(),
  getRecentActivity: jest.fn(),
}));

// Mock React Router
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/admin' }),
}));

// Test wrapper with auth context
const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
);

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

describe('AdminLayout Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.getItem.mockImplementation((key) => {
      if (key === 'authToken') return 'mock-admin-token';
      if (key === 'userData') return JSON.stringify({
        id: 1,
        email: 'admin@university.edu',
        name: 'Admin User',
        role: 'admin'
      });
      return null;
    });
  });

  describe('Component Rendering', () => {
    it('renders admin layout correctly', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({
        data: {
          totalUsers: 150,
          activeUsers: 75,
          totalSlips: 1000,
          totalReports: 500
        }
      });

      getSystemHealth.mockResolvedValue({
        data: {
          status: 'healthy',
          database: 'connected',
          api: 'operational'
        }
      });

      getRecentActivity.mockResolvedValue({
        data: [
          {
            id: 1,
            type: 'user_created',
            description: 'New user account created',
            timestamp: '2024-01-15T10:30:00Z',
            user: 'Admin User'
          }
        ]
      });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/admin panel/i)).toBeInTheDocument();
        expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
      });

      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('admin@university.edu')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      expect(screen.getByText(/loading admin data/i)).toBeInTheDocument();
    });

    it('displays error message when data loading fails', async () => {
      const { getAdminStats } = require('../../services/api');
      
      getAdminStats.mockRejectedValue(new Error('Failed to load admin data'));

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load admin data/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Menu', () => {
    it('renders all admin navigation items', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /signup requests/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /analytics/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /reports/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /violations/i })).toBeInTheDocument();
      });
    });

    it('highlights active navigation item', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
        expect(dashboardLink).toHaveClass('active');
      });
    });

    it('navigates to different admin sections', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument();
      });

      const usersLink = screen.getByRole('link', { name: /users/i });
      await userEvent.click(usersLink);

      expect(mockNavigate).toHaveBeenCalledWith('/admin/users');
    });
  });

  describe('Admin Statistics', () => {
    it('displays admin statistics correctly', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({
        data: {
          totalUsers: 150,
          activeUsers: 75,
          totalSlips: 1000,
          totalReports: 500,
          pendingRequests: 12,
          resolvedCases: 488
        }
      });

      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
        expect(screen.getByText('75')).toBeInTheDocument();
        expect(screen.getByText('1000')).toBeInTheDocument();
        expect(screen.getByText('500')).toBeInTheDocument();
        expect(screen.getByText('12')).toBeInTheDocument();
        expect(screen.getByText('488')).toBeInTheDocument();
      });

      expect(screen.getByText(/total users/i)).toBeInTheDocument();
      expect(screen.getByText(/active users/i)).toBeInTheDocument();
      expect(screen.getByText(/total slips/i)).toBeInTheDocument();
      expect(screen.getByText(/total reports/i)).toBeInTheDocument();
      expect(screen.getByText(/pending requests/i)).toBeInTheDocument();
      expect(screen.getByText(/resolved cases/i)).toBeInTheDocument();
    });

    it('shows statistics loading state', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/loading statistics/i)).toBeInTheDocument();
      });
    });
  });

  describe('System Health', () => {
    it('displays system health status', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      
      getSystemHealth.mockResolvedValue({
        data: {
          status: 'healthy',
          database: 'connected',
          api: 'operational',
          storage: 'available',
          memory: 'normal',
          cpu: 'normal'
        }
      });

      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/system health/i)).toBeInTheDocument();
        expect(screen.getByText('healthy')).toBeInTheDocument();
        expect(screen.getByText('database: connected')).toBeInTheDocument();
        expect(screen.getByText('api: operational')).toBeInTheDocument();
        expect(screen.getByText('storage: available')).toBeInTheDocument();
      });
    });

    it('shows warning status for degraded system', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      
      getSystemHealth.mockResolvedValue({
        data: {
          status: 'warning',
          database: 'connected',
          api: 'operational',
          storage: 'low',
          memory: 'high',
          cpu: 'normal'
        }
      });

      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('warning')).toBeInTheDocument();
        expect(screen.getByText('storage: low')).toBeInTheDocument();
        expect(screen.getByText('memory: high')).toBeInTheDocument();
      });
    });

    it('shows critical status for system issues', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      
      getSystemHealth.mockResolvedValue({
        data: {
          status: 'critical',
          database: 'disconnected',
          api: 'slow',
          storage: 'full',
          memory: 'critical',
          cpu: 'high'
        }
      });

      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('critical')).toBeInTheDocument();
        expect(screen.getByText('database: disconnected')).toBeInTheDocument();
        expect(screen.getByText('api: slow')).toBeInTheDocument();
        expect(screen.getByText('storage: full')).toBeInTheDocument();
      });
    });
  });

  describe('Recent Activity', () => {
    it('displays recent admin activity', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });

      getRecentActivity.mockResolvedValue({
        data: [
          {
            id: 1,
            type: 'user_created',
            description: 'New user account created',
            timestamp: '2024-01-15T10:30:00Z',
            user: 'Admin User'
          },
          {
            id: 2,
            type: 'request_approved',
            description: 'Signup request approved',
            timestamp: '2024-01-15T09:15:00Z',
            user: 'Admin User'
          },
          {
            id: 3,
            type: 'settings_updated',
            description: 'System settings updated',
            timestamp: '2024-01-15T08:45:00Z',
            user: 'Admin User'
          }
        ]
      });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/recent activity/i)).toBeInTheDocument();
        expect(screen.getByText('New user account created')).toBeInTheDocument();
        expect(screen.getByText('Signup request approved')).toBeInTheDocument();
        expect(screen.getByText('System settings updated')).toBeInTheDocument();
      });
    });

    it('shows empty state when no recent activity', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });

      getRecentActivity.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/no recent activity/i)).toBeInTheDocument();
        expect(screen.getByText(/admin actions will appear here/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Menu', () => {
    it('displays user information', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Admin User')).toBeInTheDocument();
        expect(screen.getByText('admin@university.edu')).toBeInTheDocument();
        expect(screen.getByText('Administrator')).toBeInTheDocument();
      });
    });

    it('opens user menu dropdown', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /user menu/i })).toBeInTheDocument();
      });

      const userMenuButton = screen.getByRole('button', { name: /user menu/i });
      await userEvent.click(userMenuButton);

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /profile/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /settings/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /logout/i })).toBeInTheDocument();
      });
    });

    it('logs out user', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        const userMenuButton = screen.getByRole('button', { name: /user menu/i });
        userEvent.click(userMenuButton);
      });

      await waitFor(() => {
        const logoutMenuItem = screen.getByRole('menuitem', { name: /logout/i });
        userEvent.click(logoutMenuItem);
      });

      await waitFor(() => {
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('authToken');
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('userData');
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });

    it('navigates to profile', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        const userMenuButton = screen.getByRole('button', { name: /user menu/i });
        userEvent.click(userMenuButton);
      });

      await waitFor(() => {
        const profileMenuItem = screen.getByRole('menuitem', { name: /profile/i });
        userEvent.click(profileMenuItem);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/admin/profile');
    });
  });

  describe('Sidebar Toggle', () => {
    it('toggles sidebar on mobile', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      // Set mobile viewport
      window.innerWidth = 768;
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /toggle sidebar/i })).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('navigation')).toHaveClass('open');
      });
    });

    it('closes sidebar when clicking outside', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      // Set mobile viewport
      window.innerWidth = 768;
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      // Open sidebar
      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('navigation')).toHaveClass('open');
      });

      // Click outside
      const mainContent = screen.getByRole('main');
      await userEvent.click(mainContent);

      await waitFor(() => {
        expect(screen.getByRole('navigation')).not.toHaveClass('open');
      });
    });
  });

  describe('Quick Actions', () => {
    it('displays quick action buttons', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /view requests/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /system settings/i })).toBeInTheDocument();
      });
    });

    it('navigates to quick action destinations', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        const addUserButton = screen.getByRole('button', { name: /add user/i });
        userEvent.click(addUserButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/admin/users/new');
    });
  });

  describe('Data Refresh', () => {
    it('refreshes admin data periodically', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: { totalUsers: 150 } });
      getSystemHealth.mockResolvedValue({ data: { status: 'healthy' } });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getAdminStats).toHaveBeenCalledTimes(1);
        expect(getSystemHealth).toHaveBeenCalledTimes(1);
        expect(getRecentActivity).toHaveBeenCalledTimes(1);
      });

      // Simulate periodic refresh
      jest.advanceTimersByTime(30000); // 30 seconds

      await waitFor(() => {
        expect(getAdminStats).toHaveBeenCalledTimes(2);
        expect(getSystemHealth).toHaveBeenCalledTimes(2);
        expect(getRecentActivity).toHaveBeenCalledTimes(2);
      });
    });

    it('allows manual refresh', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh data/i })).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh data/i });
      await userEvent.click(refreshButton);

      await waitFor(() => {
        expect(getAdminStats).toHaveBeenCalledTimes(2);
        expect(getSystemHealth).toHaveBeenCalledTimes(2);
        expect(getRecentActivity).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('handles individual service failures', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: { totalUsers: 150 } });
      getSystemHealth.mockRejectedValue(new Error('Health check failed'));
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
        expect(screen.getByText(/system health unavailable/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry health check/i })).toBeInTheDocument();
      });
    });

    it('allows retry after error', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce({ data: { totalUsers: 150 } });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Admin Navigation');
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Admin Main Content');
        expect(screen.getByRole('complementary')).toHaveAttribute('aria-label', 'Admin Sidebar');
      });
    });

    it('should support keyboard navigation', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
        dashboardLink.focus();
        expect(dashboardLink).toHaveFocus();

        userEvent.tab();
        expect(screen.getByRole('link', { name: /users/i })).toHaveFocus();
      });
    });

    it('should announce status changes to screen readers', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: { status: 'healthy' } });
      getRecentActivity.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        const healthStatus = screen.getByText('healthy');
        expect(healthStatus).toHaveAttribute('role', 'status');
        expect(healthStatus).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to different screen sizes', async () => {
      const { getAdminStats, getSystemHealth, getRecentActivity } = require('../../services/api');
      
      getAdminStats.mockResolvedValue({ data: {} });
      getSystemHealth.mockResolvedValue({ data: {} });
      getRecentActivity.mockResolvedValue({ data: [] });

      // Desktop
      window.innerWidth = 1200;
      window.dispatchEvent(new Event('resize'));

      const { unmount } = render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('navigation')).not.toHaveClass('mobile');
      });

      unmount();

      // Tablet
      window.innerWidth = 768;
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('navigation')).toHaveClass('tablet');
      });

      // Mobile
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <AdminLayout />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('navigation')).toHaveClass('mobile');
      });
    });
  });
});
