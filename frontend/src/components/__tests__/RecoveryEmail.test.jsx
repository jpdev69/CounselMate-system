import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import RecoveryEmail from '../RecoveryEmail';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  updateRecoveryEmail: jest.fn(),
  verifyCurrentPassword: jest.fn(),
  getGmailSettings: jest.fn(),
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

describe('RecoveryEmail Component', () => {
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
    it('renders recovery email form correctly', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null,
          usingEnvFallback: false
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/recovery email/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/set up recovery email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/recovery email/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /update recovery email/i })).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      expect(screen.getByText(/loading settings/i)).toBeInTheDocument();
    });

    it('displays current recovery email if set', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: 'recovery@example.com',
          usingEnvFallback: false
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('recovery@example.com')).toBeInTheDocument();
        expect(screen.getByText(/update recovery email/i)).toBeInTheDocument();
      });
    });

    it('shows Gmail setup status', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: false,
          recoveryEmail: null,
          gmailUser: null,
          usingEnvFallback: true
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/gmail is not configured/i)).toBeInTheDocument();
        expect(screen.getByText(/contact administrator/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /update recovery email/i })).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /update recovery email/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/current password is required/i)).toBeInTheDocument();
        expect(screen.getByText(/recovery email is required/i)).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/recovery email/i);
      await userEvent.type(emailInput, 'invalid-email');

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('should prevent using current email as recovery email', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/recovery email/i);
      await userEvent.type(emailInput, 'test@example.com'); // Same as current email

      await waitFor(() => {
        expect(screen.getByText(/recovery email must be different from current email/i)).toBeInTheDocument();
      });
    });

    it('should validate password strength', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/current password/i);
      const emailInput = screen.getByLabelText(/recovery email/i);
      
      await userEvent.type(passwordInput, 'weak');
      await userEvent.type(emailInput, 'recovery@example.com');

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Password Verification', () => {
    it('should verify current password before updating email', async () => {
      const { verifyCurrentPassword, updateRecoveryEmail, getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      verifyCurrentPassword.mockResolvedValue({
        data: { success: true }
      });

      updateRecoveryEmail.mockResolvedValue({
        data: { success: true, message: 'Recovery email updated successfully' }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/current password/i);
      const emailInput = screen.getByLabelText(/recovery email/i);
      const submitButton = screen.getByRole('button', { name: /update recovery email/i });

      await userEvent.type(passwordInput, 'currentpassword123');
      await userEvent.type(emailInput, 'recovery@example.com');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(verifyCurrentPassword).toHaveBeenCalledWith('currentpassword123');
      });

      await waitFor(() => {
        expect(updateRecoveryEmail).toHaveBeenCalledWith('recovery@example.com');
      });
    });

    it('should handle incorrect current password', async () => {
      const { verifyCurrentPassword, getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      verifyCurrentPassword.mockRejectedValue({
        response: { data: { error: 'Invalid password' } }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/current password/i);
      const emailInput = screen.getByLabelText(/recovery email/i);
      const submitButton = screen.getByRole('button', { name: /update recovery email/i });

      await userEvent.type(passwordInput, 'wrongpassword');
      await userEvent.type(emailInput, 'recovery@example.com');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid password/i)).toBeInTheDocument();
      });

      expect(verifyCurrentPassword).toHaveBeenCalledWith('wrongpassword');
    });

    it('should handle password verification errors', async () => {
      const { verifyCurrentPassword, getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      verifyCurrentPassword.mockRejectedValue({
        response: { data: { error: 'Too many attempts' } }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/current password/i);
      const submitButton = screen.getByRole('button', { name: /update recovery email/i });

      await userEvent.type(passwordInput, 'password123');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
      });
    });
  });

  describe('Email Update', () => {
    it('should update recovery email successfully', async () => {
      const { verifyCurrentPassword, updateRecoveryEmail, getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      verifyCurrentPassword.mockResolvedValue({
        data: { success: true }
      });

      updateRecoveryEmail.mockResolvedValue({
        data: { success: true, message: 'Recovery email updated successfully' }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/current password/i);
      const emailInput = screen.getByLabelText(/recovery email/i);
      const submitButton = screen.getByRole('button', { name: /update recovery email/i });

      await userEvent.type(passwordInput, 'currentpassword123');
      await userEvent.type(emailInput, 'recovery@example.com');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/recovery email updated successfully/i)).toBeInTheDocument();
      });

      expect(updateRecoveryEmail).toHaveBeenCalledWith('recovery@example.com');
    });

    it('should handle email update errors', async () => {
      const { verifyCurrentPassword, updateRecoveryEmail, getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      verifyCurrentPassword.mockResolvedValue({
        data: { success: true }
      });

      updateRecoveryEmail.mockRejectedValue({
        response: { data: { error: 'Failed to update recovery email' } }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/current password/i);
      const emailInput = screen.getByLabelText(/recovery email/i);
      const submitButton = screen.getByRole('button', { name: /update recovery email/i });

      await userEvent.type(passwordInput, 'currentpassword123');
      await userEvent.type(emailInput, 'recovery@example.com');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to update recovery email/i)).toBeInTheDocument();
      });
    });

    it('should show loading state during update', async () => {
      const { verifyCurrentPassword, updateRecoveryEmail, getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      verifyCurrentPassword.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      updateRecoveryEmail.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/current password/i);
      const emailInput = screen.getByLabelText(/recovery email/i);
      const submitButton = screen.getByRole('button', { name: /update recovery email/i });

      await userEvent.type(passwordInput, 'currentpassword123');
      await userEvent.type(emailInput, 'recovery@example.com');
      await userEvent.click(submitButton);

      expect(screen.getByText(/updating/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Gmail Configuration Status', () => {
    it('should show warning when Gmail is not configured', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: false,
          gmailUser: null,
          usingEnvFallback: true
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/gmail is not configured/i)).toBeInTheDocument();
        expect(screen.getByText(/recovery email features will be limited/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /update recovery email/i })).toBeDisabled();
      });
    });

    it('should show Gmail user when configured', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          gmailUser: 'guidanceos@gmail.com',
          recoveryEmail: null
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/configured: guidanceos@gmail.com/i)).toBeInTheDocument();
      });
    });

    it('should show when using environment fallback', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          gmailUser: null,
          recoveryEmail: 'fallback@example.com',
          usingEnvFallback: true
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/using environment configuration/i)).toBeInTheDocument();
      });
    });
  });

  describe('Security Features', () => {
    it('should mask password input', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        const passwordInput = screen.getByLabelText(/current password/i);
        expect(passwordInput).toHaveAttribute('type', 'password');
      });
    });

    it('should toggle password visibility', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        const passwordInput = screen.getByLabelText(/current password/i);
        const toggleButton = screen.getByLabelText(/toggle password visibility/i);

        expect(passwordInput).toHaveAttribute('type', 'password');

        userEvent.click(toggleButton);
        expect(passwordInput).toHaveAttribute('type', 'text');

        userEvent.click(toggleButton);
        expect(passwordInput).toHaveAttribute('type', 'password');
      });
    });

    it('should show password strength indicator', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/current password/i);
      
      await userEvent.type(passwordInput, 'weak');
      expect(screen.getByText(/weak/i)).toBeInTheDocument();

      await userEvent.clear(passwordInput);
      await userEvent.type(passwordInput, 'StrongPassword123!');
      expect(screen.getByText(/strong/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate back to dashboard', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      await userEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should navigate to change password', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /change password/i })).toBeInTheDocument();
      });

      const changePasswordLink = screen.getByRole('link', { name: /change password/i });
      await userEvent.click(changePasswordLink);

      expect(mockNavigate).toHaveBeenCalledWith('/change-password');
    });
  });

  describe('Form Reset', () => {
    it('should clear form after successful update', async () => {
      const { verifyCurrentPassword, updateRecoveryEmail, getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      verifyCurrentPassword.mockResolvedValue({
        data: { success: true }
      });

      updateRecoveryEmail.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/current password/i);
      const emailInput = screen.getByLabelText(/recovery email/i);
      const submitButton = screen.getByRole('button', { name: /update recovery email/i });

      await userEvent.type(passwordInput, 'currentpassword123');
      await userEvent.type(emailInput, 'recovery@example.com');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/recovery email updated successfully/i)).toBeInTheDocument();
      });

      // Check if form is cleared
      expect(passwordInput).toHaveValue('');
      expect(emailInput).toHaveValue('');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load settings/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: {
            gmailReady: true,
            recoveryEmail: null
          }
        });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/recovery email/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Recovery Email Form');
      });

      // Check form fields have proper labels
      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/recovery email/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const { getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /update recovery email/i })).toBeInTheDocument();
      });

      // Tab through form fields
      screen.getByLabelText(/current password/i).focus();
      expect(screen.getByLabelText(/current password/i)).toHaveFocus();

      userEvent.tab();
      expect(screen.getByLabelText(/recovery email/i)).toHaveFocus();
    });

    it('should announce success/error messages to screen readers', async () => {
      const { verifyCurrentPassword, updateRecoveryEmail, getGmailSettings } = require('../../services/api');
      
      getGmailSettings.mockResolvedValue({
        data: {
          gmailReady: true,
          recoveryEmail: null
        }
      });

      verifyCurrentPassword.mockResolvedValue({
        data: { success: true }
      });

      updateRecoveryEmail.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <RecoveryEmail />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/current password/i);
      const emailInput = screen.getByLabelText(/recovery email/i);
      const submitButton = screen.getByRole('button', { name: /update recovery email/i });

      await userEvent.type(passwordInput, 'currentpassword123');
      await userEvent.type(emailInput, 'recovery@example.com');
      await userEvent.click(submitButton);

      await waitFor(() => {
        const successMessage = screen.getByText(/recovery email updated successfully/i);
        expect(successMessage).toHaveAttribute('role', 'alert');
      });
    });
  });
});
