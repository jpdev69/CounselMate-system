import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import SignupRequest from '../SignupRequest';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  createSignupRequest: jest.fn(),
  validateGmailAddress: jest.fn(),
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

describe('SignupRequest Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.getItem.mockImplementation((key) => {
      if (key === 'authToken') return null; // Not authenticated
      if (key === 'userData') return null;
      return null;
    });
  });

  describe('Component Rendering', () => {
    it('renders signup request form correctly', () => {
      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      expect(screen.getByText(/request access/i)).toBeInTheDocument();
      expect(screen.getByText(/sign up for guidanceos/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/reason for access/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit request/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument();
    });

    it('shows Gmail requirement notice', () => {
      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      expect(screen.getByText(/gmail address required/i)).toBeInTheDocument();
      expect(screen.getByText(/only gmail addresses are accepted/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const { createSignupRequest } = require('../../services/api');
      
      createSignupRequest.mockResolvedValue({
        data: { success: true, message: 'Request submitted successfully' }
      });

      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /submit request/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
        expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/reason is required/i)).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'invalid-email');

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('should validate Gmail address requirement', async () => {
      const { validateGmailAddress } = require('../../services/api');
      
      validateGmailAddress.mockResolvedValue({
        data: { isValid: false, error: 'Only Gmail addresses are allowed' }
      });

      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'user@yahoo.com');

      await waitFor(() => {
        expect(screen.getByText(/only gmail addresses are allowed/i)).toBeInTheDocument();
      });
    });

    it('should validate full name format', async () => {
      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      const nameInput = screen.getByLabelText(/full name/i);
      await userEvent.type(nameInput, '123');

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid full name/i)).toBeInTheDocument();
      });
    });

    it('should validate reason length', async () => {
      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      const reasonInput = screen.getByLabelText(/reason for access/i);
      await userEvent.type(reasonInput, 'Short');

      await waitFor(() => {
        expect(screen.getByText(/reason must be at least 10 characters/i)).toBeInTheDocument();
      });
    });

    it('should validate maximum reason length', async () => {
      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      const reasonInput = screen.getByLabelText(/reason for access/i);
      const longReason = 'a'.repeat(501); // Assuming max length is 500
      
      await userEvent.type(reasonInput, longReason);

      await waitFor(() => {
        expect(screen.getByText(/reason must be less than 500 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit signup request successfully', async () => {
      const { createSignupRequest, validateGmailAddress } = require('../../services/api');
      
      validateGmailAddress.mockResolvedValue({
        data: { isValid: true }
      });

      createSignupRequest.mockResolvedValue({
        data: { success: true, message: 'Signup request submitted successfully' }
      });

      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      // Fill form
      const emailInput = screen.getByLabelText(/email address/i);
      const nameInput = screen.getByLabelText(/full name/i);
      const reasonInput = screen.getByLabelText(/reason for access/i);

      await userEvent.type(emailInput, 'newuser@gmail.com');
      await userEvent.type(nameInput, 'New User');
      await userEvent.type(reasonInput, 'I need access to the counseling system for my work as a new counselor at the university.');

      const submitButton = screen.getByRole('button', { name: /submit request/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(validateGmailAddress).toHaveBeenCalledWith('newuser@gmail.com');
        expect(createSignupRequest).toHaveBeenCalledWith({
          email: 'newuser@gmail.com',
          full_name: 'New User',
          reason: 'I need access to the counseling system for my work as a new counselor at the university.'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/signup request submitted successfully/i)).toBeInTheDocument();
        expect(screen.getByText(/we will review your request and contact you soon/i)).toBeInTheDocument();
      });
    });

    it('should handle duplicate email requests', async () => {
      const { createSignupRequest, validateGmailAddress } = require('../../services/api');
      
      validateGmailAddress.mockResolvedValue({
        data: { isValid: true }
      });

      createSignupRequest.mockRejectedValue({
        response: { data: { error: 'Email already has a pending request' } }
      });

      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      // Fill form
      const emailInput = screen.getByLabelText(/email address/i);
      const nameInput = screen.getByLabelText(/full name/i);
      const reasonInput = screen.getByLabelText(/reason for access/i);

      await userEvent.type(emailInput, 'existing@gmail.com');
      await userEvent.type(nameInput, 'Existing User');
      await userEvent.type(reasonInput, 'I need access to the system for my work.');

      const submitButton = screen.getByRole('button', { name: /submit request/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email already has a pending request/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      const { createSignupRequest, validateGmailAddress } = require('../../services/api');
      
      validateGmailAddress.mockResolvedValue({
        data: { isValid: true }
      });

      createSignupRequest.mockRejectedValue({
        response: { data: { error: 'Network error occurred' } }
      });

      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      // Fill form
      const emailInput = screen.getByLabelText(/email address/i);
      const nameInput = screen.getByLabelText(/full name/i);
      const reasonInput = screen.getByLabelText(/reason for access/i);

      await userEvent.type(emailInput, 'test@gmail.com');
      await userEvent.type(nameInput, 'Test User');
      await userEvent.type(reasonInput, 'I need access for my work as a counselor.');

      const submitButton = screen.getByRole('button', { name: /submit request/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
      });
    });

    it('should show loading state during submission', async () => {
      const { createSignupRequest, validateGmailAddress } = require('../../services/api');
      
      validateGmailAddress.mockResolvedValue({
        data: { isValid: true }
      });

      createSignupRequest.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      // Fill form
      const emailInput = screen.getByLabelText(/email address/i);
      const nameInput = screen.getByLabelText(/full name/i);
      const reasonInput = screen.getByLabelText(/reason for access/i);

      await userEvent.type(emailInput, 'test@gmail.com');
      await userEvent.type(nameInput, 'Test User');
      await userEvent.type(reasonInput, 'I need access for my work as a counselor.');

      const submitButton = screen.getByRole('button', { name: /submit request/i });
      await userEvent.click(submitButton);

      expect(screen.getByText(/submitting/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Email Validation', () => {
    it('should validate Gmail address in real-time', async () => {
      const { validateGmailAddress } = require('../../services/api');
      
      validateGmailAddress.mockResolvedValue({
        data: { isValid: true }
      });

      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'valid@gmail.com');

      await waitFor(() => {
        expect(validateGmailAddress).toHaveBeenCalledWith('valid@gmail.com');
        expect(screen.getByText(/valid gmail address/i)).toBeInTheDocument();
      });
    });

    it('should show invalid Gmail address error', async () => {
      const { validateGmailAddress } = require('../../services/api');
      
      validateGmailAddress.mockResolvedValue({
        data: { isValid: false, error: 'Invalid Gmail format' }
      });

      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'invalid@gmail');

      await waitFor(() => {
        expect(screen.getByText(/invalid gmail format/i)).toBeInTheDocument();
      });
    });

    it('should handle validation service errors', async () => {
      const { validateGmailAddress } = require('../../services/api');
      
      validateGmailAddress.mockRejectedValue({
        response: { data: { error: 'Validation service unavailable' } }
      });

      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'test@gmail.com');

      await waitFor(() => {
        expect(screen.getByText(/unable to validate email/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back to login', async () => {
      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      const backButton = screen.getByRole('link', { name: /back to login/i });
      await userEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should navigate to login after successful submission', async () => {
      const { createSignupRequest, validateGmailAddress } = require('../../services/api');
      
      validateGmailAddress.mockResolvedValue({
        data: { isValid: true }
      });

      createSignupRequest.mockResolvedValue({
        data: { success: true, message: 'Request submitted successfully' }
      });

      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      // Fill and submit form
      const emailInput = screen.getByLabelText(/email address/i);
      const nameInput = screen.getByLabelText(/full name/i);
      const reasonInput = screen.getByLabelText(/reason for access/i);

      await userEvent.type(emailInput, 'test@gmail.com');
      await userEvent.type(nameInput, 'Test User');
      await userEvent.type(reasonInput, 'I need access for my work as a counselor.');

      const submitButton = screen.getByRole('button', { name: /submit request/i });
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
    it('should reset form after successful submission', async () => {
      const { createSignupRequest, validateGmailAddress } = require('../../services/api');
      
      validateGmailAddress.mockResolvedValue({
        data: { isValid: true }
      });

      createSignupRequest.mockResolvedValue({
        data: { success: true, message: 'Request submitted successfully' }
      });

      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      // Fill form
      const emailInput = screen.getByLabelText(/email address/i);
      const nameInput = screen.getByLabelText(/full name/i);
      const reasonInput = screen.getByLabelText(/reason for access/i);

      await userEvent.type(emailInput, 'test@gmail.com');
      await userEvent.type(nameInput, 'Test User');
      await userEvent.type(reasonInput, 'I need access for my work as a counselor.');

      const submitButton = screen.getByRole('button', { name: /submit request/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/signup request submitted successfully/i)).toBeInTheDocument();
      });

      // Check if form is reset
      expect(emailInput).toHaveValue('');
      expect(nameInput).toHaveValue('');
      expect(reasonInput).toHaveValue('');
    });
  });

  describe('Character Counters', () => {
    it('should show character counter for reason field', async () => {
      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      const reasonInput = screen.getByLabelText(/reason for access/i);
      await userEvent.type(reasonInput, 'Test reason');

      await waitFor(() => {
        expect(screen.getByText(/12 \/ 500 characters/i)).toBeInTheDocument();
      });
    });

    it('should show warning when approaching character limit', async () => {
      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      const reasonInput = screen.getByLabelText(/reason for access/i);
      const longText = 'a'.repeat(450);
      
      await userEvent.type(reasonInput, longText);

      await waitFor(() => {
        expect(screen.getByText(/450 \/ 500 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/approaching character limit/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Signup Request Form');
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/reason for access/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email address/i);
      emailInput.focus();
      expect(emailInput).toHaveFocus();

      userEvent.tab();
      expect(screen.getByLabelText(/full name/i)).toHaveFocus();

      userEvent.tab();
      expect(screen.getByLabelText(/reason for access/i)).toHaveFocus();
    });

    it('should announce form errors to screen readers', async () => {
      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /submit request/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        const errorSummary = screen.getByRole('alert');
        expect(errorSummary).toBeInTheDocument();
        expect(errorSummary).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('Help Text and Instructions', () => {
    it('should show helpful instructions', async () => {
      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      expect(screen.getByText(/request access to guidanceos/i)).toBeInTheDocument();
      expect(screen.getByText(/please fill out the form below/i)).toBeInTheDocument();
      expect(screen.getByText(/we will review your request/i)).toBeInTheDocument();
    });

    it('should show field requirements', async () => {
      render(
        <TestWrapper>
          <SignupRequest />
        </TestWrapper>
      );

      expect(screen.getByText(/\* required field/i)).toBeInTheDocument();
      expect(screen.getByText(/gmail addresses only/i)).toBeInTheDocument();
      expect(screen.getByText(/minimum 10 characters/i)).toBeInTheDocument();
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
          <SignupRequest />
        </TestWrapper>
      );

      expect(screen.getByText(/request access/i)).toBeInTheDocument();
      // Should be mobile-friendly
      expect(screen.getByRole('form')).toHaveClass('mobile-form');
    });
  });
});
