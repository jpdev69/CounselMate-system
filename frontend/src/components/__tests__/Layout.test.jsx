import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Layout from '../Layout';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  getSystemStatus: jest.fn(),
  getNotifications: jest.fn(),
  markNotificationAsRead: jest.fn(),
}));

// Mock React Router
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/dashboard' }),
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

describe('Layout Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.getItem.mockImplementation((key) => {
      if (key === 'authToken') return 'mock-token';
      if (key === 'userData') return JSON.stringify({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'counselor'
      });
      return null;
    });
  });

  describe('Component Rendering', () => {
    it('renders layout with header and main content', () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      expect(screen.getByRole('banner')).toBeInTheDocument(); // Header
      expect(screen.getByRole('main')).toBeInTheDocument(); // Main content
      expect(screen.getByText('Page Content')).toBeInTheDocument();
    });

    it('renders navigation menu', () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /report student/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /admission slips/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /search records/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /student manual/i })).toBeInTheDocument();
    });

    it('renders user profile section', () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /user menu/i })).toBeInTheDocument();
    });

    it('renders system status indicator', async () => {
      const { getSystemStatus } = require('../../services/api');
      
      getSystemStatus.mockResolvedValue({
        data: {
          status: 'healthy',
          message: 'All systems operational'
        }
      });

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('healthy')).toBeInTheDocument();
        expect(screen.getByText('All systems operational')).toBeInTheDocument();
      });
    });

    it('renders notifications when available', async () => {
      const { getNotifications } = require('../../services/api');
      
      getNotifications.mockResolvedValue({
        data: [
          {
            id: 1,
            type: 'info',
            title: 'System Update',
            message: 'System will be updated tonight',
            timestamp: '2024-01-15T10:30:00Z',
            isRead: false
          },
          {
            id: 2,
            type: 'warning',
            title: 'Data Backup',
            message: 'Backup completed with warnings',
            timestamp: '2024-01-15T09:15:00Z',
            isRead: false
          }
        ]
      });

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // Notification count
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to different pages', () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      userEvent.click(dashboardLink);

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('should highlight active navigation item', () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      // Dashboard should be active since pathname is '/dashboard'
      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      expect(dashboardLink).toHaveClass('active');
    });

    it('should show navigation tooltip on hover', async () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const reportStudentLink = screen.getByRole('link', { name: /report student/i });
      userEvent.hover(reportStudentLink);

      await waitFor(() => {
        expect(screen.getByText('Report a student violation')).toBeInTheDocument();
      });
    });
  });

  describe('User Menu', () => {
    it('should open user menu dropdown', async () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const userMenuButton = screen.getByRole('button', { name: /user menu/i });
      userEvent.click(userMenuButton);

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /profile/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /change password/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /logout/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /recovery email/i })).toBeInTheDocument();
      });
    });

    it('should navigate to profile page', async () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const userMenuButton = screen.getByRole('button', { name: /user menu/i });
      userEvent.click(userMenuButton);

      await waitFor(() => {
        const profileMenuItem = screen.getByRole('menuitem', { name: /profile/i });
        userEvent.click(profileMenuItem);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/profile');
    });

    it('should navigate to change password page', async () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const userMenuButton = screen.getByRole('button', { name: /user menu/i });
      userEvent.click(userMenuButton);

      await waitFor(() => {
        const changePasswordMenuItem = screen.getByRole('menuitem', { name: /change password/i });
        userEvent.click(changePasswordMenuItem);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/change-password');
    });

    it('should logout user', async () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const userMenuButton = screen.getByRole('button', { name: /user menu/i });
      userEvent.click(userMenuButton);

      await waitFor(() => {
        const logoutMenuItem = screen.getByRole('menuitem', { name: /logout/i });
        userEvent.click(logoutMenuItem);
      });

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('userData');
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should close user menu when clicking outside', async () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const userMenuButton = screen.getByRole('button', { name: /user menu/i });
      userEvent.click(userMenuButton);

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /profile/i })).toBeInTheDocument();
      });

      // Click outside
      const mainContent = screen.getByRole('main');
      userEvent.click(mainContent);

      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: /profile/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Notifications', () => {
    it('should open notifications dropdown', async () => {
      const { getNotifications } = require('../../services/api');
      
      getNotifications.mockResolvedValue({
        data: [
          {
            id: 1,
            type: 'info',
            title: 'System Update',
            message: 'System will be updated tonight',
            timestamp: '2024-01-15T10:30:00Z',
            isRead: false
          }
        ]
      });

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      await waitFor(() => {
        const notificationsButton = screen.getByRole('button', { name: /notifications/i });
        userEvent.click(notificationsButton);
      });

      await waitFor(() => {
        expect(screen.getByText('System Update')).toBeInTheDocument();
        expect(screen.getByText('System will be updated tonight')).toBeInTheDocument();
      });
    });

    it('should mark notification as read', async () => {
      const { getNotifications, markNotificationAsRead } = require('../../services/api');
      
      getNotifications.mockResolvedValue({
        data: [
          {
            id: 1,
            type: 'info',
            title: 'System Update',
            message: 'System will be updated tonight',
            timestamp: '2024-01-15T10:30:00Z',
            isRead: false
          }
        ]
      });

      markNotificationAsRead.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      // Open notifications
      await waitFor(() => {
        const notificationsButton = screen.getByRole('button', { name: /notifications/i });
        userEvent.click(notificationsButton);
      });

      // Click on notification
      await waitFor(() => {
        const notificationItem = screen.getByText('System Update');
        userEvent.click(notificationItem);
      });

      await waitFor(() => {
        expect(markNotificationAsRead).toHaveBeenCalledWith(1);
      });
    });

    it('should show notification count badge', async () => {
      const { getNotifications } = require('../../services/api');
      
      getNotifications.mockResolvedValue({
        data: [
          { id: 1, isRead: false },
          { id: 2, isRead: false },
          { id: 3, isRead: true }
        ]
      });

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // Unread notifications
      });
    });

    it('should show empty state when no notifications', async () => {
      const { getNotifications } = require('../../services/api');
      
      getNotifications.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      await waitFor(() => {
        const notificationsButton = screen.getByRole('button', { name: /notifications/i });
        userEvent.click(notificationsButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
        expect(screen.getByText(/you're all caught up/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should collapse navigation on mobile', async () => {
      // Set mobile viewport
      window.innerWidth = 768;
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /toggle navigation/i })).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toHaveClass('collapsed');
    });

    it('should toggle navigation on mobile', async () => {
      // Set mobile viewport
      window.innerWidth = 768;
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const toggleButton = screen.getByRole('button', { name: /toggle navigation/i });
      userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('navigation')).toHaveClass('expanded');
      });

      userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('navigation')).toHaveClass('collapsed');
      });
    });

    it('should adapt header for mobile', async () => {
      // Set mobile viewport
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('mobile-header');
    });
  });

  describe('System Status', () => {
    it('should show healthy status', async () => {
      const { getSystemStatus } = require('../../services/api');
      
      getSystemStatus.mockResolvedValue({
        data: {
          status: 'healthy',
          message: 'All systems operational'
        }
      });

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('healthy')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveClass('status-healthy');
      });
    });

    it('should show warning status', async () => {
      const { getSystemStatus } = require('../../services/api');
      
      getSystemStatus.mockResolvedValue({
        data: {
          status: 'warning',
          message: 'Some services degraded'
        }
      });

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('warning')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveClass('status-warning');
      });
    });

    it('should show error status', async () => {
      const { getSystemStatus } = require('../../services/api');
      
      getSystemStatus.mockResolvedValue({
        data: {
          status: 'error',
          message: 'Critical system issues'
        }
      });

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('error')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveClass('status-error');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      expect(screen.getByRole('banner')).toHaveAttribute('aria-label', 'Main Header');
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Main Navigation');
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Main Content');
    });

    it('should support keyboard navigation', () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      dashboardLink.focus();
      expect(dashboardLink).toHaveFocus();

      userEvent.tab();
      expect(screen.getByRole('link', { name: /report student/i })).toHaveFocus();

      userEvent.tab();
      expect(screen.getByRole('link', { name: /admission slips/i })).toHaveFocus();
    });

    it('should announce navigation changes to screen readers', () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Error Handling', () => {
    it('should handle system status errors gracefully', async () => {
      const { getSystemStatus } = require('../../services/api');
      
      getSystemStatus.mockRejectedValue(new Error('Failed to get system status'));

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/status unavailable/i)).toBeInTheDocument();
      });
    });

    it('should handle notification errors gracefully', async () => {
      const { getNotifications } = require('../../services/api');
      
      getNotifications.mockRejectedValue(new Error('Failed to load notifications'));

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
        // Should still show notifications button even if loading fails
      });
    });
  });

  describe('Theme and Styling', () => {
    it('should apply dark theme when enabled', () => {
      // Mock dark theme
      document.documentElement.setAttribute('data-theme', 'dark');

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('dark-theme');
    });

    it('should apply light theme when enabled', () => {
      // Mock light theme
      document.documentElement.setAttribute('data-theme', 'light');

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('light-theme');
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderCount = jest.fn();
      
      const TestComponent = React.memo(() => {
        renderCount();
        return <div>Test content</div>;
      });

      const { rerender } = render(
        <TestWrapper>
          <Layout>
            <TestComponent />
          </Layout>
        </TestWrapper>
      );

      // Initial render
      expect(renderCount).toHaveBeenCalledTimes(1);

      // Re-render with same props
      rerender(
        <TestWrapper>
          <Layout>
            <TestComponent />
          </Layout>
        </TestWrapper>
      );

      // Should not re-render TestComponent
      expect(renderCount).toHaveBeenCalledTimes(1);
    });

    it('should debounce navigation clicks', async () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      
      // Rapidly click multiple times
      userEvent.click(dashboardLink);
      userEvent.click(dashboardLink);
      userEvent.click(dashboardLink);

      // Should only navigate once due to debouncing
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Search Functionality', () => {
    it('should show search input in header', () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      expect(screen.getByRole('searchbox')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });

    it('should handle search input', async () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const searchInput = screen.getByRole('searchbox');
      userEvent.type(searchInput, 'test search');

      expect(searchInput).toHaveValue('test search');
    });

    it('should clear search input', async () => {
      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const searchInput = screen.getByRole('searchbox');
      userEvent.type(searchInput, 'test search');

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      userEvent.click(clearButton);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Breadcrumb Navigation', () => {
    it('should show breadcrumbs when provided', () => {
      const breadcrumbs = [
        { label: 'Home', path: '/dashboard' },
        { label: 'Reports', path: '/reports' },
        { label: 'Student Reports', path: '/reports/students' }
      ];

      render(
        <TestWrapper>
          <Layout breadcrumbs={breadcrumbs}>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByText('Student Reports')).toBeInTheDocument();
    });

    it('should navigate when breadcrumb is clicked', () => {
      const breadcrumbs = [
        { label: 'Home', path: '/dashboard' },
        { label: 'Reports', path: '/reports' }
      ];

      render(
        <TestWrapper>
          <Layout breadcrumbs={breadcrumbs}>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      const homeBreadcrumb = screen.getByText('Home');
      userEvent.click(homeBreadcrumb);

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Page Title', () => {
    it('should update document title when pageTitle prop is provided', () => {
      const originalTitle = document.title;

      render(
        <TestWrapper>
          <Layout pageTitle="Student Reports">
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      expect(document.title).toBe('Student Reports - GuidanceOS');

      // Restore original title
      document.title = originalTitle;
    });

    it('should use default title when pageTitle not provided', () => {
      const originalTitle = document.title;

      render(
        <TestWrapper>
          <Layout>
            <div>Page Content</div>
          </Layout>
        </TestWrapper>
      );

      expect(document.title).toBe('GuidanceOS');

      // Restore original title
      document.title = originalTitle;
    });
  });
});
