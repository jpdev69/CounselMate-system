import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AdminPanel from '../AdminPanel';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  getUsers: jest.fn(),
  getSignupRequests: jest.fn(),
  getAdminSettings: jest.fn(),
  getSystemStats: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  approveSignupRequest: jest.fn(),
  rejectSignupRequest: jest.fn(),
  updateAdminSettings: jest.fn(),
  exportUserData: jest.fn(),
}));

// Mock React Router
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ section: 'dashboard' }),
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

describe('AdminPanel Component', () => {
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
    it('renders admin panel correctly', async () => {
      const { getUsers, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({
        data: [
          { id: 1, email: 'counselor@example.com', name: 'Test Counselor', role: 'counselor' },
          { id: 2, email: 'another@example.com', name: 'Another Counselor', role: 'counselor' }
        ]
      });

      getSignupRequests.mockResolvedValue({
        data: [
          { id: 1, email: 'newuser@gmail.com', name: 'New User', status: 'pending' }
        ]
      });

      getAdminSettings.mockResolvedValue({
        data: {
          maxLoginAttempts: 5,
          sessionTimeout: 30,
          enableEmailNotifications: true
        }
      });

      getSystemStats.mockResolvedValue({
        data: {
          totalUsers: 150,
          activeUsers: 75,
          totalSlips: 1000,
          totalReports: 500
        }
      });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/admin panel/i)).toBeInTheDocument();
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
        expect(screen.getByText(/users/i)).toBeInTheDocument();
        expect(screen.getByText(/signup requests/i)).toBeInTheDocument();
        expect(screen.getByText(/settings/i)).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      expect(screen.getByText(/loading admin panel/i)).toBeInTheDocument();
    });

    it('displays error message when data loading fails', async () => {
      const { getUsers } = require('../../services/api');
      
      getUsers.mockRejectedValue(new Error('Failed to load admin data'));

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load admin panel/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Dashboard Section', () => {
    it('displays dashboard statistics', async () => {
      const { getUsers, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({ data: [] });
      getSignupRequests.mockResolvedValue({ data: [] });
      getAdminSettings.mockResolvedValue({ data: {} });

      getSystemStats.mockResolvedValue({
        data: {
          totalUsers: 150,
          activeUsers: 75,
          totalSlips: 1000,
          totalReports: 500,
          pendingRequests: 12,
          resolvedCases: 488
        }
      });

      render(
        <TestWrapper>
          <AdminPanel />
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
    });

    it('shows system health indicators', async () => {
      const { getUsers, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({ data: [] });
      getSignupRequests.mockResolvedValue({ data: [] });
      getAdminSettings.mockResolvedValue({ data: {} });

      getSystemStats.mockResolvedValue({
        data: {
          systemHealth: 'healthy',
          databaseStatus: 'connected',
          apiStatus: 'operational',
          storageStatus: 'available'
        }
      });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('healthy')).toBeInTheDocument();
        expect(screen.getByText('database: connected')).toBeInTheDocument();
        expect(screen.getByText('api: operational')).toBeInTheDocument();
        expect(screen.getByText('storage: available')).toBeInTheDocument();
      });
    });
  });

  describe('Users Management', () => {
    it('displays users list', async () => {
      const { getUsers, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({
        data: [
          {
            id: 1,
            email: 'counselor@example.com',
            name: 'Test Counselor',
            role: 'counselor',
            status: 'active',
            createdAt: '2024-01-01T00:00:00Z',
            lastLogin: '2024-01-15T10:30:00Z'
          },
          {
            id: 2,
            email: 'another@example.com',
            name: 'Another Counselor',
            role: 'counselor',
            status: 'active',
            createdAt: '2024-01-02T00:00:00Z',
            lastLogin: '2024-01-14T15:45:00Z'
          }
        ]
      });

      getSignupRequests.mockResolvedValue({ data: [] });
      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to users section
      await waitFor(() => {
        const usersTab = screen.getByRole('tab', { name: /users/i });
        userEvent.click(usersTab);
      });

      await waitFor(() => {
        expect(screen.getByText('counselor@example.com')).toBeInTheDocument();
        expect(screen.getByText('Test Counselor')).toBeInTheDocument();
        expect(screen.getByText('another@example.com')).toBeInTheDocument();
        expect(screen.getByText('Another Counselor')).toBeInTheDocument();
      });
    });

    it('should create new user', async () => {
      const { getUsers, createUser, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({ data: [] });
      getSignupRequests.mockResolvedValue({ data: [] });
      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      createUser.mockResolvedValue({
        data: {
          success: true,
          user: {
            id: 3,
            email: 'newcounselor@university.edu',
            name: 'New Counselor',
            role: 'counselor'
          }
        }
      });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to users section
      await waitFor(() => {
        const usersTab = screen.getByRole('tab', { name: /users/i });
        userEvent.click(usersTab);
      });

      // Click add user button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument();
      });

      const addUserButton = screen.getByRole('button', { name: /add user/i });
      await userEvent.click(addUserButton);

      // Fill user form
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
      });

      await userEvent.type(screen.getByLabelText(/email/i), 'newcounselor@university.edu');
      await userEvent.type(screen.getByLabelText(/name/i), 'New Counselor');
      await userEvent.selectOptions(screen.getByLabelText(/role/i), 'counselor');

      const submitButton = screen.getByRole('button', { name: /create user/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(createUser).toHaveBeenCalledWith({
          email: 'newcounselor@university.edu',
          name: 'New Counselor',
          role: 'counselor'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/user created successfully/i)).toBeInTheDocument();
      });
    });

    it('should delete user', async () => {
      const { getUsers, deleteUser, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({
        data: [
          {
            id: 1,
            email: 'counselor@example.com',
            name: 'Test Counselor',
            role: 'counselor'
          }
        ]
      });

      getSignupRequests.mockResolvedValue({ data: [] });
      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      deleteUser.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to users section
      await waitFor(() => {
        const usersTab = screen.getByRole('tab', { name: /users/i });
        userEvent.click(usersTab);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete user/i })).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete user/i });
      await userEvent.click(deleteButton);

      // Confirm deletion
      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to delete this user/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(deleteUser).toHaveBeenCalledWith(1);
        expect(screen.getByText(/user deleted successfully/i)).toBeInTheDocument();
      });
    });

    it('should reset user password', async () => {
      const { getUsers, updateUser, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({
        data: [
          {
            id: 1,
            email: 'counselor@example.com',
            name: 'Test Counselor',
            role: 'counselor'
          }
        ]
      });

      getSignupRequests.mockResolvedValue({ data: [] });
      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      updateUser.mockResolvedValue({
        data: { success: true, message: 'Password reset successfully' }
      });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to users section
      await waitFor(() => {
        const usersTab = screen.getByRole('tab', { name: /users/i });
        userEvent.click(usersTab);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', { name: /reset password/i });
      await userEvent.click(resetButton);

      // Confirm reset
      await waitFor(() => {
        expect(screen.getByText(/reset user password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /confirm reset/i })).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm reset/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(updateUser).toHaveBeenCalledWith(1, { resetPassword: true });
        expect(screen.getByText(/password reset successfully/i)).toBeInTheDocument();
      });
    });

    it('should filter users', async () => {
      const { getUsers, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({
        data: [
          { id: 1, email: 'counselor@example.com', name: 'Test Counselor', role: 'counselor' },
          { id: 2, email: 'admin@university.edu', name: 'Admin User', role: 'admin' }
        ]
      });

      getSignupRequests.mockResolvedValue({ data: [] });
      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to users section
      await waitFor(() => {
        const usersTab = screen.getByRole('tab', { name: /users/i });
        userEvent.click(usersTab);
      });

      // Filter by role
      await waitFor(() => {
        expect(screen.getByLabelText(/filter by role/i)).toBeInTheDocument();
      });

      const roleFilter = screen.getByLabelText(/filter by role/i);
      await userEvent.selectOptions(roleFilter, 'counselor');

      await waitFor(() => {
        expect(getUsers).toHaveBeenCalledWith({ role: 'counselor' });
      });
    });
  });

  describe('Signup Requests Management', () => {
    it('displays signup requests', async () => {
      const { getUsers, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({ data: [] });
      
      getSignupRequests.mockResolvedValue({
        data: [
          {
            id: 1,
            email: 'newuser@gmail.com',
            name: 'New User',
            reason: 'I need access to the counseling system for my work',
            status: 'pending',
            createdAt: '2024-01-15T09:00:00Z'
          },
          {
            id: 2,
            email: 'anotheruser@gmail.com',
            name: 'Another User',
            reason: 'I am a new counselor joining the team',
            status: 'approved',
            createdAt: '2024-01-14T14:30:00Z'
          }
        ]
      });

      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to signup requests section
      await waitFor(() => {
        const requestsTab = screen.getByRole('tab', { name: /signup requests/i });
        userEvent.click(requestsTab);
      });

      await waitFor(() => {
        expect(screen.getByText('newuser@gmail.com')).toBeInTheDocument();
        expect(screen.getByText('New User')).toBeInTheDocument();
        expect(screen.getByText('anotheruser@gmail.com')).toBeInTheDocument();
        expect(screen.getByText('Another User')).toBeInTheDocument();
      });
    });

    it('should approve signup request', async () => {
      const { getUsers, getSignupRequests, approveSignupRequest, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({ data: [] });
      
      getSignupRequests.mockResolvedValue({
        data: [
          {
            id: 1,
            email: 'newuser@gmail.com',
            name: 'New User',
            status: 'pending'
          }
        ]
      });

      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      approveSignupRequest.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to signup requests section
      await waitFor(() => {
        const requestsTab = screen.getByRole('tab', { name: /signup requests/i });
        userEvent.click(requestsTab);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
      });

      const approveButton = screen.getByRole('button', { name: /approve/i });
      await userEvent.click(approveButton);

      // Confirm approval
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm approval/i })).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm approval/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(approveSignupRequest).toHaveBeenCalledWith(1);
        expect(screen.getByText(/request approved successfully/i)).toBeInTheDocument();
      });
    });

    it('should reject signup request', async () => {
      const { getUsers, getSignupRequests, rejectSignupRequest, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({ data: [] });
      
      getSignupRequests.mockResolvedValue({
        data: [
          {
            id: 1,
            email: 'newuser@gmail.com',
            name: 'New User',
            status: 'pending'
          }
        ]
      });

      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      rejectSignupRequest.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to signup requests section
      await waitFor(() => {
        const requestsTab = screen.getByRole('tab', { name: /signup requests/i });
        userEvent.click(requestsTab);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
      });

      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await userEvent.click(rejectButton);

      // Add rejection reason
      await waitFor(() => {
        expect(screen.getByLabelText(/rejection reason/i)).toBeInTheDocument();
      });

      await userEvent.type(screen.getByLabelText(/rejection reason/i), 'Does not meet requirements');

      const confirmButton = screen.getByRole('button', { name: /confirm rejection/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(rejectSignupRequest).toHaveBeenCalledWith(1, { reason: 'Does not meet requirements' });
        expect(screen.getByText(/request rejected successfully/i)).toBeInTheDocument();
      });
    });

    it('should delete signup request', async () => {
      const { getUsers, getSignupRequests, rejectSignupRequest, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({ data: [] });
      
      getSignupRequests.mockResolvedValue({
        data: [
          {
            id: 1,
            email: 'newuser@gmail.com',
            name: 'New User',
            status: 'rejected'
          }
        ]
      });

      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      rejectSignupRequest.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to signup requests section
      await waitFor(() => {
        const requestsTab = screen.getByRole('tab', { name: /signup requests/i });
        userEvent.click(requestsTab);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete request/i })).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete request/i });
      await userEvent.click(deleteButton);

      // Confirm deletion
      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to delete this request/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/request deleted successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Settings Management', () => {
    it('displays admin settings', async () => {
      const { getUsers, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({ data: [] });
      getSignupRequests.mockResolvedValue({ data: {} });

      getAdminSettings.mockResolvedValue({
        data: {
          maxLoginAttempts: 5,
          sessionTimeout: 30,
          enableEmailNotifications: true,
          allowUserRegistration: false,
          passwordMinLength: 6
        }
      });

      getSystemStats.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to settings section
      await waitFor(() => {
        const settingsTab = screen.getByRole('tab', { name: /settings/i });
        userEvent.click(settingsTab);
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('5')).toBeInTheDocument();
        expect(screen.getByDisplayValue('30')).toBeInTheDocument();
        expect(screen.getByDisplayValue('6')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /enable email notifications/i })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /allow user registration/i })).not.toBeChecked();
      });
    });

    it('should update admin settings', async () => {
      const { getUsers, getSignupRequests, updateAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({ data: [] });
      getSignupRequests.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      updateAdminSettings.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to settings section
      await waitFor(() => {
        const settingsTab = screen.getByRole('tab', { name: /settings/i });
        userEvent.click(settingsTab);
      });

      // Update settings
      await waitFor(() => {
        const maxAttemptsInput = screen.getByLabelText(/max login attempts/i);
        userEvent.clear(maxAttemptsInput);
        userEvent.type(maxAttemptsInput, '7');
      });

      const saveButton = screen.getByRole('button', { name: /save settings/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(updateAdminSettings).toHaveBeenCalledWith({
          maxLoginAttempts: 7,
          sessionTimeout: 30,
          enableEmailNotifications: true,
          allowUserRegistration: false,
          passwordMinLength: 6
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/settings updated successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should switch between sections', async () => {
      const { getUsers, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({ data: [] });
      getSignupRequests.mockResolvedValue({ data: [] });
      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Test switching between tabs
      const dashboardTab = screen.getByRole('tab', { name: /dashboard/i });
      const usersTab = screen.getByRole('tab', { name: /users/i });
      const requestsTab = screen.getByRole('tab', { name: /signup requests/i });
      const settingsTab = screen.getByRole('tab', { name: /settings/i });

      // Switch to users
      await userEvent.click(usersTab);
      await waitFor(() => {
        expect(screen.getByText(/users management/i)).toBeInTheDocument();
      });

      // Switch to signup requests
      await userEvent.click(requestsTab);
      await waitFor(() => {
        expect(screen.getByText(/signup requests/i)).toBeInTheDocument();
      });

      // Switch to settings
      await userEvent.click(settingsTab);
      await waitFor(() => {
        expect(screen.getByText(/admin settings/i)).toBeInTheDocument();
      });

      // Switch back to dashboard
      await userEvent.click(dashboardTab);
      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });
    });

    it('should navigate back to login', async () => {
      const { getUsers, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({ data: [] });
      getSignupRequests.mockResolvedValue({ data: [] });
      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      await userEvent.click(logoutButton);

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('userData');
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('Export Functionality', () => {
    it('should export user data', async () => {
      const { getUsers, exportUserData, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({
        data: [
          { id: 1, email: 'counselor@example.com', name: 'Test Counselor' }
        ]
      });
      getSignupRequests.mockResolvedValue({ data: [] });
      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      exportUserData.mockResolvedValue({
        data: { success: true, downloadUrl: '/api/downloads/users.xlsx' }
      });

      // Mock file download
      const mockLink = {
        click: jest.fn(),
        href: '',
        download: ''
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
      jest.spyOn(document.body, 'appendChild').mockImplementation();
      jest.spyOn(document.body, 'removeChild').mockImplementation();

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to users section
      await waitFor(() => {
        const usersTab = screen.getByRole('tab', { name: /users/i });
        userEvent.click(usersTab);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export users/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export users/i });
      await userEvent.click(exportButton);

      await waitFor(() => {
        expect(exportUserData).toHaveBeenCalled();
        expect(mockLink.click).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const { getUsers, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockRejectedValue({
        response: { data: { error: 'Failed to load users' } }
      });

      getSignupRequests.mockResolvedValue({ data: [] });
      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to users section
      await waitFor(() => {
        const usersTab = screen.getByRole('tab', { name: /users/i });
        userEvent.click(usersTab);
      });

      await waitFor(() => {
        expect(screen.getByText(/failed to load users/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      const { getUsers, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: [{ id: 1, email: 'counselor@example.com', name: 'Test Counselor' }]
        });

      getSignupRequests.mockResolvedValue({ data: [] });
      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      // Navigate to users section
      await waitFor(() => {
        const usersTab = screen.getByRole('tab', { name: /users/i });
        userEvent.click(usersTab);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('counselor@example.com')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const { getUsers, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({ data: [] });
      getSignupRequests.mockResolvedValue({ data: [] });
      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Admin Panel Navigation');
        expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-label', 'Admin Panel Content');
      });
    });

    it('should support keyboard navigation', async () => {
      const { getUsers, getSignupRequests, getAdminSettings, getSystemStats } = require('../../services/api');
      
      getUsers.mockResolvedValue({ data: [] });
      getSignupRequests.mockResolvedValue({ data: [] });
      getAdminSettings.mockResolvedValue({ data: {} });
      getSystemStats.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <AdminPanel />
        </TestWrapper>
      );

      await waitFor(() => {
        const dashboardTab = screen.getByRole('tab', { name: /dashboard/i });
        dashboardTab.focus();
        expect(dashboardTab).toHaveFocus();

        userEvent.tab();
        expect(screen.getByRole('tab', { name: /users/i })).toHaveFocus();
      });
    });
  });
});
