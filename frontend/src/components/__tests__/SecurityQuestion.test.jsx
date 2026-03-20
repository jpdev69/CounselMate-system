import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import SecurityQuestion from '../SecurityQuestion';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  getSecurityQuestions: jest.fn(),
  validateSecurityQuestion: jest.fn(),
  setSecurityQuestion: jest.fn(),
  verifySecurityAnswer: jest.fn(),
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

describe('SecurityQuestion Component', () => {
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
    it('renders security question setup form correctly', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' },
          { id: 2, question: 'What elementary school did you attend?' },
          { id: 3, question: 'What is your mother\'s maiden name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/security question setup/i)).toBeInTheDocument();
        expect(screen.getByText(/choose a security question and answer/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/select security question/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/your answer/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/confirm answer/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save security question/i })).toBeInTheDocument();
      });
    });

    it('renders security question verification form correctly', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="verify" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/security question verification/i)).toBeInTheDocument();
        expect(screen.getByText(/answer your security question/i)).toBeInTheDocument();
        expect(screen.getByText(/What was your first pet\'s name\?/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/your answer/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /verify answer/i })).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      expect(screen.getByText(/loading security questions/i)).toBeInTheDocument();
    });

    it('displays error message when questions loading fails', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockRejectedValue(new Error('Failed to load security questions'));

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load security questions/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Security Question Setup', () => {
    it('should validate required fields', async () => {
      const { getSecurityQuestions, setSecurityQuestion } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      setSecurityQuestion.mockResolvedValue({
        data: { success: true, message: 'Security question set successfully' }
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /save security question/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/security question is required/i)).toBeInTheDocument();
        expect(screen.getByText(/answer is required/i)).toBeInTheDocument();
        expect(screen.getByText(/confirm answer is required/i)).toBeInTheDocument();
      });
    });

    it('should validate answer confirmation', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      // Select question and fill answers
      await userEvent.selectOptions(screen.getByLabelText(/select security question/i), '1');
      await userEvent.type(screen.getByLabelText(/your answer/i), 'Fluffy');
      await userEvent.type(screen.getByLabelText(/confirm answer/i), 'Fido'); // Different answer

      const submitButton = screen.getByRole('button', { name: /save security question/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/answers do not match/i)).toBeInTheDocument();
      });
    });

    it('should validate answer strength', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      // Select question and fill with weak answer
      await userEvent.selectOptions(screen.getByLabelText(/select security question/i), '1');
      await userEvent.type(screen.getByLabelText(/your answer/i), 'abc'); // Too short

      await waitFor(() => {
        expect(screen.getByText(/answer must be at least 3 characters/i)).toBeInTheDocument();
      });
    });

    it('should set security question successfully', async () => {
      const { getSecurityQuestions, setSecurityQuestion } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      setSecurityQuestion.mockResolvedValue({
        data: { success: true, message: 'Security question set successfully' }
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      // Fill form
      await userEvent.selectOptions(screen.getByLabelText(/select security question/i), '1');
      await userEvent.type(screen.getByLabelText(/your answer/i), 'Fluffy');
      await userEvent.type(screen.getByLabelText(/confirm answer/i), 'Fluffy');

      const submitButton = screen.getByRole('button', { name: /save security question/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(setSecurityQuestion).toHaveBeenCalledWith({
          questionId: 1,
          answer: 'Fluffy'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/security question set successfully/i)).toBeInTheDocument();
        expect(screen.getByText(/you can use this to recover your account/i)).toBeInTheDocument();
      });
    });

    it('should handle setup errors', async () => {
      const { getSecurityQuestions, setSecurityQuestion } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      setSecurityQuestion.mockRejectedValue({
        response: { data: { error: 'Failed to set security question' } }
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      // Fill form
      await userEvent.selectOptions(screen.getByLabelText(/select security question/i), '1');
      await userEvent.type(screen.getByLabelText(/your answer/i), 'Fluffy');
      await userEvent.type(screen.getByLabelText(/confirm answer/i), 'Fluffy');

      const submitButton = screen.getByRole('button', { name: /save security question/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to set security question/i)).toBeInTheDocument();
      });
    });
  });

  describe('Security Question Verification', () => {
    it('should validate answer field', async () => {
      const { getSecurityQuestions, verifySecurityAnswer } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      verifySecurityAnswer.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="verify" />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /verify answer/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/answer is required/i)).toBeInTheDocument();
      });
    });

    it('should verify security answer successfully', async () => {
      const { getSecurityQuestions, verifySecurityAnswer } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      verifySecurityAnswer.mockResolvedValue({
        data: { success: true, message: 'Answer verified successfully' }
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="verify" />
        </TestWrapper>
      );

      // Fill answer
      await userEvent.type(screen.getByLabelText(/your answer/i), 'Fluffy');

      const submitButton = screen.getByRole('button', { name: /verify answer/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(verifySecurityAnswer).toHaveBeenCalledWith({
          answer: 'Fluffy'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/answer verified successfully/i)).toBeInTheDocument();
      });
    });

    it('should handle incorrect answer', async () => {
      const { getSecurityQuestions, verifySecurityAnswer } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      verifySecurityAnswer.mockResolvedValue({
        data: { success: false, error: 'Incorrect answer' }
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="verify" />
        </TestWrapper>
      );

      // Fill with incorrect answer
      await userEvent.type(screen.getByLabelText(/your answer/i), 'WrongAnswer');

      const submitButton = screen.getByRole('button', { name: /verify answer/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/incorrect answer/i)).toBeInTheDocument();
        expect(screen.getByText(/please try again/i)).toBeInTheDocument();
      });
    });

    it('should handle too many failed attempts', async () => {
      const { getSecurityQuestions, verifySecurityAnswer } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      verifySecurityAnswer.mockResolvedValue({
        data: { success: false, error: 'Too many failed attempts', attemptsRemaining: 0 }
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="verify" />
        </TestWrapper>
      );

      // Fill answer
      await userEvent.type(screen.getByLabelText(/your answer/i), 'WrongAnswer');

      const submitButton = screen.getByRole('button', { name: /verify answer/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/too many failed attempts/i)).toBeInTheDocument();
        expect(screen.getByText(/account temporarily locked/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /contact support/i })).toBeInTheDocument();
      });
    });

    it('should show remaining attempts', async () => {
      const { getSecurityQuestions, verifySecurityAnswer } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      verifySecurityAnswer.mockResolvedValue({
        data: { success: false, error: 'Incorrect answer', attemptsRemaining: 2 }
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="verify" />
        </TestWrapper>
      );

      // Fill with incorrect answer
      await userEvent.type(screen.getByLabelText(/your answer/i), 'WrongAnswer');

      const submitButton = screen.getByRole('button', { name: /verify answer/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/2 attempts remaining/i)).toBeInTheDocument();
      });
    });
  });

  describe('Question Selection', () => {
    it('should load available security questions', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' },
          { id: 2, question: 'What elementary school did you attend?' },
          { id: 3, question: 'What is your mother\'s maiden name?' },
          { id: 4, question: 'In what city were you born?' },
          { id: 5, question: 'What is your favorite book?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('What was your first pet\'s name?')).toBeInTheDocument();
        expect(screen.getByText('What elementary school did you attend?')).toBeInTheDocument();
        expect(screen.getByText('What is your mother\'s maiden name?')).toBeInTheDocument();
        expect(screen.getByText('In what city were you born?')).toBeInTheDocument();
        expect(screen.getByText('What is your favorite book?')).toBeInTheDocument();
      });
    });

    it('should allow custom security question', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" allowCustom={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /use predefined question/i })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /create custom question/i })).toBeInTheDocument();
      });

      // Select custom question
      const customQuestionRadio = screen.getByRole('radio', { name: /create custom question/i });
      await userEvent.click(customQuestionRadio);

      await waitFor(() => {
        expect(screen.getByLabelText(/your security question/i)).toBeInTheDocument();
      });

      // Fill custom question
      await userEvent.type(screen.getByLabelText(/your security question/i), 'What is your favorite color?');
      await userEvent.type(screen.getByLabelText(/your answer/i), 'Blue');
      await userEvent.type(screen.getByLabelText(/confirm answer/i), 'Blue');

      const submitButton = screen.getByRole('button', { name: /save security question/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
      });
    });
  });

  describe('Security Features', () => {
    it('should mask answer input', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      const answerInput = screen.getByLabelText(/your answer/i);
      expect(answerInput).toHaveAttribute('type', 'password');
    });

    it('should toggle answer visibility', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      const answerInput = screen.getByLabelText(/your answer/i);
      const toggleButton = screen.getByLabelText(/toggle answer visibility/i);

      expect(answerInput).toHaveAttribute('type', 'password');

      await userEvent.click(toggleButton);
      expect(answerInput).toHaveAttribute('type', 'text');

      await userEvent.click(toggleButton);
      expect(answerInput).toHaveAttribute('type', 'password');
    });

    it('should show password strength indicator', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      const answerInput = screen.getByLabelText(/your answer/i);
      
      await userEvent.type(answerInput, 'abc');
      expect(screen.getByText(/weak/i)).toBeInTheDocument();

      await userEvent.clear(answerInput);
      await userEvent.type(answerInput, 'StrongAnswer123!');
      expect(screen.getByText(/strong/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate back when cancel button is clicked', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('should navigate to next step after successful setup', async () => {
      const { getSecurityQuestions, setSecurityQuestion } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      setSecurityQuestion.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      // Fill and submit form
      await userEvent.selectOptions(screen.getByLabelText(/select security question/i), '1');
      await userEvent.type(screen.getByLabelText(/your answer/i), 'Fluffy');
      await userEvent.type(screen.getByLabelText(/confirm answer/i), 'Fluffy');

      const submitButton = screen.getByRole('button', { name: /save security question/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await userEvent.click(continueButton);

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('should navigate to login after successful verification', async () => {
      const { getSecurityQuestions, verifySecurityAnswer } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      verifySecurityAnswer.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="verify" />
        </TestWrapper>
      );

      // Fill and submit answer
      await userEvent.type(screen.getByLabelText(/your answer/i), 'Fluffy');

      const submitButton = screen.getByRole('button', { name: /verify answer/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue to login/i })).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: /continue to login/i });
      await userEvent.click(continueButton);

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('Help and Instructions', () => {
    it('should show help text and instructions', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      expect(screen.getByText(/security questions help protect your account/i)).toBeInTheDocument();
      expect(screen.getByText(/choose a question you can easily remember/i)).toBeInTheDocument();
      expect(screen.getByText(/your answer should be something only you know/i)).toBeInTheDocument();
    });

    it('should show tips for choosing good security questions', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      expect(screen.getByText(/tips for choosing a good security question/i)).toBeInTheDocument();
      expect(screen.getByText(/choose a question with a specific answer/i)).toBeInTheDocument();
      expect(screen.getByText(/avoid questions with easily discoverable answers/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Security Question Setup Form');
      expect(screen.getByLabelText(/select security question/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/your answer/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm answer/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      const questionSelect = screen.getByLabelText(/select security question/i);
      questionSelect.focus();
      expect(questionSelect).toHaveFocus();

      userEvent.tab();
      expect(screen.getByLabelText(/your answer/i)).toHaveFocus();

      userEvent.tab();
      expect(screen.getByLabelText(/confirm answer/i)).toHaveFocus();
    });

    it('should announce errors to screen readers', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /save security question/i });
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

      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      expect(screen.getByText(/security question setup/i)).toBeInTheDocument();
      // Should be mobile-friendly
      expect(screen.getByRole('form')).toHaveClass('mobile-form');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockRejectedValue({
        response: { data: { error: 'Network error occurred' } }
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce({
          data: [
            { id: 1, question: 'What was your first pet\'s name?' }
          ]
        });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('What was your first pet\'s name?')).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should debounce answer validation', async () => {
      const { getSecurityQuestions } = require('../../services/api');
      
      getSecurityQuestions.mockResolvedValue({
        data: [
          { id: 1, question: 'What was your first pet\'s name?' }
        ]
      });

      render(
        <TestWrapper>
          <SecurityQuestion mode="setup" />
        </TestWrapper>
      );

      const answerInput = screen.getByLabelText(/your answer/i);
      
      // Rapidly type answer
      await userEvent.type(answerInput, 'Fluffy');
      await userEvent.clear(answerInput);
      await userEvent.type(answerInput, 'Fido');

      // Should only validate final answer due to debouncing
      await waitFor(() => {
        expect(screen.queryByText(/answer must be at least 3 characters/i)).not.toBeInTheDocument();
      });
    });
  });
});
