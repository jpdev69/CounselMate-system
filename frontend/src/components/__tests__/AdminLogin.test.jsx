import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AdminLogin from '../AdminLogin';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  adminLogin: jest.fn(),
  validateAdminCredentials: jest.fn(),
  getSystemStatus: jest.fn(),
}));

// Mock React Router
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
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

describe('AdminLogin Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.getItem.mockImplementation((key) => {
      if (key === 'authToken') return null; // Not authenticated
      if (key === 'userData') return null;
      return null;
    });
  });

  describe('Component Rendering', () => {
    it('renders admin login form correctly', () => {
      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      expect(screen.getByText(/admin login/i)).toBeInTheDocument();
      expect(screen.getByText(/administrator access/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/admin email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/admin password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in as admin/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument();
    });

    it('shows admin-specific branding', () => {
      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      expect(screen.getByText(/isabela state university/i)).toBeInTheDocument();
      expect(screen.getByText(/guidanceos admin portal/i)).toBeInTheDocument();
      expect(screen.getByAltText(/admin logo/i)).toBeInTheDocument();
    });

    it('displays system status', async () => {
      const { getSystemStatus } = require('../../services/api');
      
      getSystemStatus.mockResolvedValue({
        data: {
          status: 'operational',
          message: 'All systems operational'
        }
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/system status/i)).toBeInTheDocument();
        expect(screen.getByText('operational')).toBeInTheDocument();
        expect(screen.getByText('All systems operational')).toBeInTheDocument();
      });
    });

    it('shows system warning', async () => {
      const { getSystemStatus } = require('../../services/api');
      
      getSystemStatus.mockResolvedValue({
        data: {
          status: 'warning',
          message: 'Some services degraded'
        }
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('warning')).toBeInTheDocument();
        expect(screen.getByText('Some services degraded')).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const { adminLogin } = require('../../services/api');
      
      adminLogin.mockResolvedValue({
        data: { success: true, token: 'admin-token', user: { id: 1, role: 'admin' } }
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /sign in as admin/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/admin email is required/i)).toBeInTheDocument();
        expect(screen.getByText(/admin password is required/i)).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/admin email/i);
      await userEvent.type(emailInput, 'invalid-email');

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('should validate admin email domain', async () => {
      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/admin email/i);
      await userEvent.type(emailInput, 'admin@gmail.com');

      await waitFor(() => {
        expect(screen.getByText(/admin email must use university domain/i)).toBeInTheDocument();
      });
    });

    it('should validate password strength', async () => {
      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/admin password/i);
      await userEvent.type(passwordInput, 'weak');

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
      });
    });

    it('should show password strength indicator', async () => {
      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/admin password/i);
      
      await userEvent.type(passwordInput, 'weak');
      expect(screen.getByText(/weak/i)).toBeInTheDocument();

      await userEvent.clear(passwordInput);
      await userEvent.type(passwordInput, 'StrongAdmin123!');
      expect(screen.getByText(/strong/i)).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should login successfully with valid credentials', async () => {
      const { adminLogin, validateAdminCredentials } = require('../../services/api');
      
      validateAdminCredentials.mockResolvedValue({
        data: { isValid: true }
      });

      adminLogin.mockResolvedValue({
        data: {
          success: true,
          token: 'admin-jwt-token',
          user: {
            id: 1,
            email: 'admin@university.edu',
            name: 'Admin User',
            role: 'admin'
          }
        }
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      // Fill form
      const emailInput = screen.getByLabelText(/admin email/i);
      const passwordInput = screen.getByLabelText(/admin password/i);

      await userEvent.type(emailInput, 'admin@university.edu');
      await userEvent.type(passwordInput, 'admin123');

      const submitButton = screen.getByRole('button', { name: /sign in as admin/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(validateAdminCredentials).toHaveBeenCalledWith('admin@university.edu', 'admin123');
        expect(adminLogin).toHaveBeenCalledWith({
          email: 'admin@university.edu',
          password: 'admin123'
        });
      });

      await waitFor(() => {
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('authToken', 'admin-jwt-token');
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('userData', JSON.stringify({
          id: 1,
          email: 'admin@university.edu',
          name: 'Admin User',
          role: 'admin'
        }));
        expect(mockNavigate).toHaveBeenCalledWith('/admin');
      });
    });

    it('should handle invalid credentials', async () => {
      const { adminLogin, validateAdminCredentials } = require('../../services/api');
      
      validateAdminCredentials.mockResolvedValue({
        data: { isValid: false, error: 'Invalid admin credentials' }
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      // Fill form with invalid credentials
      const emailInput = screen.getByLabelText(/admin email/i);
      const passwordInput = screen.getByLabelText(/admin password/i);

      await userEvent.type(emailInput, 'admin@university.edu');
      await userEvent.type(passwordInput, 'wrongpassword');

      const submitButton = screen.getByRole('button', { name: /sign in as admin/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid admin credentials/i)).toBeInTheDocument();
      });
    });

    it('should handle non-admin users', async () => {
      const { adminLogin, validateAdminCredentials } = require('../../services/api');
      
      validateAdminCredentials.mockResolvedValue({
        data: { isValid: false, error: 'User is not an administrator' }
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      // Fill form with non-admin credentials
      const emailInput = screen.getByLabelText(/admin email/i);
      const passwordInput = screen.getByLabelText(/admin password/i);

      await userEvent.type(emailInput, 'counselor@university.edu');
      await userEvent.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign in as admin/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/user is not an administrator/i)).toBeInTheDocument();
        expect(screen.getByText(/please use regular login for counselor access/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      const { adminLogin, validateAdminCredentials } = require('../../services/api');
      
      validateAdminCredentials.mockResolvedValue({
        data: { isValid: true }
      });

      adminLogin.mockRejectedValue({
        response: { data: { error: 'Network error occurred' } }
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      // Fill form
      const emailInput = screen.getByLabelText(/admin email/i);
      const passwordInput = screen.getByLabelText(/admin password/i);

      await userEvent.type(emailInput, 'admin@university.edu');
      await userEvent.type(passwordInput, 'admin123');

      const submitButton = screen.getByRole('button', { name: /sign in as admin/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
      });
    });

    it('should show loading state during login', async () => {
      const { adminLogin, validateAdminCredentials } = require('../../services/api');
      
      validateAdminCredentials.mockResolvedValue({
        data: { isValid: true }
      });

      adminLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      // Fill form
      const emailInput = screen.getByLabelText(/admin email/i);
      const passwordInput = screen.getByLabelText(/admin password/i);

      await userEvent.type(emailInput, 'admin@university.edu');
      await userEvent.type(passwordInput, 'admin123');

      const submitButton = screen.getByRole('button', { name: /sign in as admin/i });
      await userEvent.click(submitButton);

      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Security Features', () => {
    it('should mask password input', async () => {
      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/admin password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should toggle password visibility', async () => {
      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/admin password/i);
      const toggleButton = screen.getByLabelText(/toggle password visibility/i);

      expect(passwordInput).toHaveAttribute('type', 'password');

      await userEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');

      await userEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should implement rate limiting', async () => {
      const { validateAdminCredentials } = require('../../services/api');
      
      validateAdminCredentials.mockResolvedValue({
        data: { isValid: false, error: 'Too many login attempts' }
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      // Make multiple failed attempts
      for (let i = 0; i < 5; i++) {
        const emailInput = screen.getByLabelText(/admin email/i);
        const passwordInput = screen.getByLabelText(/admin password/i);
        const submitButton = screen.getByRole('button', { name: /sign in as admin/i });

        await userEvent.clear(emailInput);
        await userEvent.clear(passwordInput);
        await userEvent.type(emailInput, 'admin@university.edu');
        await userEvent.type(passwordInput, 'wrong');
        await userEvent.click(submitButton);
      }

      await waitFor(() => {
        expect(screen.getByText(/too many login attempts/i)).toBeInTheDocument();
        expect(screen.getByText(/please try again later/i)).toBeInTheDocument();
      });
    });

    it('should show session timeout warning', async () => {
      const { getSystemStatus } = require('../../services/api');
      
      getSystemStatus.mockResolvedValue({
        data: {
          status: 'warning',
          message: 'Session timeout in 5 minutes'
        }
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/session timeout in 5 minutes/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back to regular login', async () => {
      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      const backButton = screen.getByRole('link', { name: /back to login/i });
      await userEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should navigate to forgot password', async () => {
      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      const forgotPasswordLink = screen.getByRole('link', { name: /forgot password/i });
      await userEvent.click(forgotPasswordLink);

      expect(mockNavigate).toHaveBeenCalledWith('/forgot-password');
    });

    it('should navigate to help page', async () => {
      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      const helpLink = screen.getByRole('link', { name: /help/i });
      await userEvent.click(helpLink);

      expect(mockNavigate).toHaveBeenCalledWith('/help');
    });
  });

  describe('Remember Me Feature', () => {
    it('should remember admin credentials', async () => {
      const { adminLogin, validateAdminCredentials } = require('../../services/api');
      
      validateAdminCredentials.mockResolvedValue({
        data: { isValid: true }
      });

      adminLogin.mockResolvedValue({
        data: { success: true, token: 'admin-token', user: { id: 1, role: 'admin' } }
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      // Check remember me checkbox
      const rememberMeCheckbox = screen.getByLabelText(/remember me/i);
      await userEvent.click(rememberMeCheckbox);

      // Fill and submit form
      const emailInput = screen.getByLabelText(/admin email/i);
      const passwordInput = screen.getByLabelText(/admin password/i);

      await userEvent.type(emailInput, 'admin@university.edu');
      await userEvent.type(passwordInput, 'admin123');

      const submitButton = screen.getByRole('button', { name: /sign in as admin/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('rememberAdmin', 'true');
      });
    });

    it('should auto-fill remembered credentials', async () => {
      // Mock remembered credentials
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'rememberAdmin') return 'true';
        if (key === 'rememberedAdminEmail') return 'admin@university.edu';
        if (key === 'rememberedAdminPassword') return 'admin123';
        return null;
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('admin@university.edu')).toBeInTheDocument();
        expect(screen.getByDisplayValue('admin123')).toBeInTheDocument();
        expect(screen.getByLabelText(/remember me/i)).toBeChecked();
      });
    });
  });

  describe('Two-Factor Authentication', () => {
    it('should show 2FA prompt for admin accounts', async () => {
      const { adminLogin, validateAdminCredentials } = require('../../services/api');
      
      validateAdminCredentials.mockResolvedValue({
        data: { isValid: true, requires2FA: true }
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      // Fill form
      const emailInput = screen.getByLabelText(/admin email/i);
      const passwordInput = screen.getByLabelText(/admin password/i);

      await userEvent.type(emailInput, 'admin@university.edu');
      await userEvent.type(passwordInput, 'admin123');

      const submitButton = screen.getByRole('button', { name: /sign in as admin/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/two-factor authentication/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/enter verification code/i)).toBeInTheDocument();
      });
    });

    it('should handle 2FA verification', async () => {
      const { adminLogin, validateAdminCredentials } = require('../../services/api');
      
      validateAdminCredentials.mockResolvedValue({
        data: { isValid: true, requires2FA: true }
      });

      adminLogin.mockResolvedValue({
        data: { success: true, token: 'admin-token', user: { id: 1, role: 'admin' } }
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      // Fill initial form
      const emailInput = screen.getByLabelText(/admin email/i);
      const passwordInput = screen.getByLabelText(/admin password/i);

      await userEvent.type(emailInput, 'admin@university.edu');
      await userEvent.type(passwordInput, 'admin123');

      const submitButton = screen.getByRole('button', { name: /sign in as admin/i });
      await userEvent.click(submitButton);

      // Fill 2FA code
      await waitFor(() => {
        expect(screen.getByLabelText(/enter verification code/i)).toBeInTheDocument();
      });

      const codeInput = screen.getByLabelText(/enter verification code/i);
      await userEvent.type(codeInput, '123456');

      const verifyButton = screen.getByRole('button', { name: /verify/i });
      await userEvent.click(verifyButton);

      await waitFor(() => {
        expect(adminLogin).toHaveBeenCalledWith({
          email: 'admin@university.edu',
          password: 'admin123',
          twoFactorCode: '123456'
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle server maintenance', async () => {
      const { getSystemStatus } = require('../../services/api');
      
      getSystemStatus.mockResolvedValue({
        data: {
          status: 'maintenance',
          message: 'System under maintenance'
        }
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/system under maintenance/i)).toBeInTheDocument();
        expect(screen.getByText(/please try again later/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign in as admin/i })).toBeDisabled();
      });
    });

    it('should handle account lockout', async () => {
      const { validateAdminCredentials } = require('../../services/api');
      
      validateAdminCredentials.mockResolvedValue({
        data: { isValid: false, error: 'Account locked due to too many failed attempts' }
      });

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/admin email/i);
      const passwordInput = screen.getByLabelText(/admin password/i);
      const submitButton = screen.getByRole('button', { name: /sign in as admin/i });

      await userEvent.type(emailInput, 'admin@university.edu');
      await userEvent.type(passwordInput, 'wrongpassword');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/account locked/i)).toBeInTheDocument();
        expect(screen.getByText(/contact system administrator/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Admin Login Form');
      expect(screen.getByLabelText(/admin email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/admin password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/admin email/i);
      emailInput.focus();
      expect(emailInput).toHaveFocus();

      userEvent.tab();
      expect(screen.getByLabelText(/admin password/i)).toHaveFocus();

      userEvent.tab();
      expect(screen.getByLabelText(/remember me/i)).toHaveFocus();

      userEvent.tab();
      expect(screen.getByRole('button', { name: /sign in as admin/i })).toHaveFocus();
    });

    it('should announce errors to screen readers', async () => {
      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /sign in as admin/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        const errorSummary = screen.getByRole('alert');
        expect(errorSummary).toBeInTheDocument();
        expect(errorSummary).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      // Set mobile viewport
      window.innerWidth = 375;
      window.innerHeight = 667;
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      expect(screen.getByText(/admin login/i)).toBeInTheDocument();
      // Should be mobile-friendly
      expect(screen.getByRole('form')).toHaveClass('mobile-form');
    });

    it('should adapt to tablet viewport', async () => {
      // Set tablet viewport
      window.innerWidth = 768;
      window.innerHeight = 1024;
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <AdminLogin />
        </TestWrapper>
      );

      expect(screen.getByText(/admin login/i)).toBeInTheDocument();
      expect(screen.getByRole('form')).toHaveClass('tablet-form');
    });
  });
});
