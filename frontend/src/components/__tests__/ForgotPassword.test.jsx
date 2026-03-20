import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ForgotPassword from '../ForgotPassword';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  requestPasswordReset: jest.fn(),
  validateEmail: jest.fn(),
  checkResetToken: jest.fn(),
  resetPassword: jest.fn(),
}));

// Mock React Router
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ token: null }),
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

describe('ForgotPassword Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.getItem.mockImplementation((key) => {
      if (key === 'authToken') return null; // Not authenticated
      if (key === 'userData') return null;
      return null;
    });
  });

  describe('Component Rendering', () => {
    it('renders forgot password form correctly', () => {
      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
      expect(screen.getByText(/reset your password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument();
    });

    it('shows instructions', () => {
      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      expect(screen.getByText(/enter your email address/i)).toBeInTheDocument();
      expect(screen.getByText(/we will send you a link to reset your password/i)).toBeInTheDocument();
    });
  });

  describe('Email Request Form', () => {
    it('should validate email field', async () => {
      const { requestPasswordReset } = require('../../services/api');
      
      requestPasswordReset.mockResolvedValue({
        data: { success: true, message: 'Password reset link sent' }
      });

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'invalid-email');

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('should send password reset link successfully', async () => {
      const { requestPasswordReset, validateEmail } = require('../../services/api');
      
      validateEmail.mockResolvedValue({
        data: { isValid: true }
      });

      requestPasswordReset.mockResolvedValue({
        data: { success: true, message: 'Password reset link sent to your email' }
      });

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      // Fill form
      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(validateEmail).toHaveBeenCalledWith('test@example.com');
        expect(requestPasswordReset).toHaveBeenCalledWith({
          email: 'test@example.com'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/password reset link sent/i)).toBeInTheDocument();
        expect(screen.getByText(/check your email for instructions/i)).toBeInTheDocument();
      });
    });

    it('should handle invalid email', async () => {
      const { requestPasswordReset, validateEmail } = require('../../services/api');
      
      validateEmail.mockResolvedValue({
        data: { isValid: false, error: 'Email not found in our system' }
      });

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      // Fill form with invalid email
      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'nonexistent@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email not found in our system/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      const { requestPasswordReset, validateEmail } = require('../../services/api');
      
      validateEmail.mockResolvedValue({
        data: { isValid: true }
      });

      requestPasswordReset.mockRejectedValue({
        response: { data: { error: 'Network error occurred' } }
      });

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      // Fill form
      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
      });
    });

    it('should show loading state during submission', async () => {
      const { requestPasswordReset, validateEmail } = require('../../services/api');
      
      validateEmail.mockResolvedValue({
        data: { isValid: true }
      });

      requestPasswordReset.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      // Fill form
      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await userEvent.click(submitButton);

      expect(screen.getByText(/sending/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Password Reset Form', () => {
    it('should render password reset form when token is provided', async () => {
      const { checkResetToken } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: true, email: 'test@example.com' }
      });

      // Mock useParams to return a token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'valid-reset-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/reset password/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
      });
    });

    it('should validate reset token', async () => {
      const { checkResetToken } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: false, error: 'Invalid or expired reset token' }
      });

      // Mock useParams to return a token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'invalid-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/invalid or expired reset token/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /request new reset link/i })).toBeInTheDocument();
      });
    });

    it('should validate password fields', async () => {
      const { checkResetToken, resetPassword } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: true, email: 'test@example.com' }
      });

      resetPassword.mockResolvedValue({
        data: { success: true, message: 'Password reset successfully' }
      });

      // Mock useParams to return a token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'valid-reset-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/new password is required/i)).toBeInTheDocument();
        expect(screen.getByText(/confirm password is required/i)).toBeInTheDocument();
      });
    });

    it('should validate password strength', async () => {
      const { checkResetToken } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: true, email: 'test@example.com' }
      });

      // Mock useParams to return a token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'valid-reset-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      const newPasswordInput = screen.getByLabelText(/new password/i);
      await userEvent.type(newPasswordInput, 'weak');

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
      });
    });

    it('should validate password confirmation', async () => {
      const { checkResetToken } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: true, email: 'test@example.com' }
      });

      // Mock useParams to return a token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'valid-reset-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      const newPasswordInput = screen.getByLabelText(/new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(newPasswordInput, 'NewPassword123');
      await userEvent.type(confirmPasswordInput, 'DifferentPassword');

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('should reset password successfully', async () => {
      const { checkResetToken, resetPassword } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: true, email: 'test@example.com' }
      });

      resetPassword.mockResolvedValue({
        data: { success: true, message: 'Password reset successfully' }
      });

      // Mock useParams to return a token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'valid-reset-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      // Fill form
      const newPasswordInput = screen.getByLabelText(/new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(newPasswordInput, 'NewPassword123');
      await userEvent.type(confirmPasswordInput, 'NewPassword123');

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(resetPassword).toHaveBeenCalledWith({
          token: 'valid-reset-token',
          newPassword: 'NewPassword123'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/password reset successfully/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /go to login/i })).toBeInTheDocument();
      });
    });

    it('should handle reset errors', async () => {
      const { checkResetToken, resetPassword } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: true, email: 'test@example.com' }
      });

      resetPassword.mockRejectedValue({
        response: { data: { error: 'Failed to reset password' } }
      });

      // Mock useParams to return a token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'valid-reset-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      // Fill form
      const newPasswordInput = screen.getByLabelText(/new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(newPasswordInput, 'NewPassword123');
      await userEvent.type(confirmPasswordInput, 'NewPassword123');

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to reset password/i)).toBeInTheDocument();
      });
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle new password visibility', async () => {
      const { checkResetToken } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: true, email: 'test@example.com' }
      });

      // Mock useParams to return a token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'valid-reset-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        const newPasswordInput = screen.getByLabelText(/new password/i);
        const toggleButton = screen.getByLabelText(/toggle new password visibility/i);

        expect(newPasswordInput).toHaveAttribute('type', 'password');

        userEvent.click(toggleButton);
        expect(newPasswordInput).toHaveAttribute('type', 'text');

        userEvent.click(toggleButton);
        expect(newPasswordInput).toHaveAttribute('type', 'password');
      });
    });

    it('should toggle confirm password visibility', async () => {
      const { checkResetToken } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: true, email: 'test@example.com' }
      });

      // Mock useParams to return a token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'valid-reset-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
        const toggleButton = screen.getByLabelText(/toggle confirm password visibility/i);

        expect(confirmPasswordInput).toHaveAttribute('type', 'password');

        userEvent.click(toggleButton);
        expect(confirmPasswordInput).toHaveAttribute('type', 'text');

        userEvent.click(toggleButton);
        expect(confirmPasswordInput).toHaveAttribute('type', 'password');
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back to login from email form', async () => {
      const { requestPasswordReset } = require('../../services/api');
      
      requestPasswordReset.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      const backButton = screen.getByRole('link', { name: /back to login/i });
      await userEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should navigate to login after successful email submission', async () => {
      const { requestPasswordReset, validateEmail } = require('../../services/api');
      
      validateEmail.mockResolvedValue({
        data: { isValid: true }
      });

      requestPasswordReset.mockResolvedValue({
        data: { success: true, message: 'Password reset link sent' }
      });

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      // Fill and submit form
      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /go to login/i })).toBeInTheDocument();
      });

      const goToLoginButton = screen.getByRole('button', { name: /go to login/i });
      await userEvent.click(goToLoginButton);

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should navigate to login after successful password reset', async () => {
      const { checkResetToken, resetPassword } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: true, email: 'test@example.com' }
      });

      resetPassword.mockResolvedValue({
        data: { success: true }
      });

      // Mock useParams to return a token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'valid-reset-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      // Fill and submit form
      const newPasswordInput = screen.getByLabelText(/new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(newPasswordInput, 'NewPassword123');
      await userEvent.type(confirmPasswordInput, 'NewPassword123');

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /go to login/i })).toBeInTheDocument();
      });

      const goToLoginButton = screen.getByRole('button', { name: /go to login/i });
      await userEvent.click(goToLoginButton);

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('Form Reset', () => {
    it('should reset email form after successful submission', async () => {
      const { requestPasswordReset, validateEmail } = require('../../services/api');
      
      validateEmail.mockResolvedValue({
        data: { isValid: true }
      });

      requestPasswordReset.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      // Fill form
      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password reset link sent/i)).toBeInTheDocument();
      });

      // Check if form is reset
      expect(emailInput).toHaveValue('');
    });

    it('should reset password form after successful reset', async () => {
      const { checkResetToken, resetPassword } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: true, email: 'test@example.com' }
      });

      resetPassword.mockResolvedValue({
        data: { success: true }
      });

      // Mock useParams to return a token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'valid-reset-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      // Fill form
      const newPasswordInput = screen.getByLabelText(/new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(newPasswordInput, 'NewPassword123');
      await userEvent.type(confirmPasswordInput, 'NewPassword123');

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password reset successfully/i)).toBeInTheDocument();
      });

      // Check if form is reset
      expect(newPasswordInput).toHaveValue('');
      expect(confirmPasswordInput).toHaveValue('');
    });
  });

  describe('Security Features', () => {
    it('should show password strength indicator', async () => {
      const { checkResetToken } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: true, email: 'test@example.com' }
      });

      // Mock useParams to return a token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'valid-reset-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      const newPasswordInput = screen.getByLabelText(/new password/i);
      
      await userEvent.type(newPasswordInput, 'weak');
      expect(screen.getByText(/weak/i)).toBeInTheDocument();

      await userEvent.clear(newPasswordInput);
      await userEvent.type(newPasswordInput, 'StrongPassword123!');
      expect(screen.getByText(/strong/i)).toBeInTheDocument();
    });

    it('should show password requirements', async () => {
      const { checkResetToken } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: true, email: 'test@example.com' }
      });

      // Mock useParams to return a token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'valid-reset-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      expect(screen.getByText(/password requirements/i)).toBeInTheDocument();
      expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/uppercase letter/i)).toBeInTheDocument();
      expect(screen.getByText(/lowercase letter/i)).toBeInTheDocument();
      expect(screen.getByText(/number/i)).toBeInTheDocument();
      expect(screen.getByText(/special character/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle expired tokens', async () => {
      const { checkResetToken } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: false, error: 'Token has expired' }
      });

      // Mock useParams to return an expired token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'expired-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/token has expired/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /request new reset link/i })).toBeInTheDocument();
      });
    });

    it('should handle invalid tokens', async () => {
      const { checkResetToken } = require('../../services/api');
      
      checkResetToken.mockResolvedValue({
        data: { isValid: false, error: 'Invalid token format' }
      });

      // Mock useParams to return an invalid token
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate,
        useParams: () => ({ token: 'invalid-token' }),
      }));

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/invalid token format/i)).toBeInTheDocument();
      });
    });

    it('should handle rate limiting', async () => {
      const { requestPasswordReset, validateEmail } = require('../../services/api');
      
      validateEmail.mockResolvedValue({
        data: { isValid: true }
      });

      requestPasswordReset.mockRejectedValue({
        response: { data: { error: 'Too many reset requests. Please try again later.' } }
      });

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      // Fill form
      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/too many reset requests/i)).toBeInTheDocument();
        expect(screen.getByText(/please try again later/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Forgot Password Form');
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email address/i);
      emailInput.focus();
      expect(emailInput).toHaveFocus();

      userEvent.tab();
      expect(screen.getByRole('button', { name: /send reset link/i })).toHaveFocus();
    });

    it('should announce success messages to screen readers', async () => {
      const { requestPasswordReset, validateEmail } = require('../../services/api');
      
      validateEmail.mockResolvedValue({
        data: { isValid: true }
      });

      requestPasswordReset.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <ForgotPassword />
        </TestWrapper>
      );

      // Fill and submit form
      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        const successMessage = screen.getByText(/password reset link sent/i);
        expect(successMessage).toHaveAttribute('role', 'status');
        expect(successMessage).toHaveAttribute('aria-live', 'polite');
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
          <ForgotPassword />
        </TestWrapper>
      );

      expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
      // Should be mobile-friendly
      expect(screen.getByRole('form')).toHaveClass('mobile-form');
    });
  });
});
