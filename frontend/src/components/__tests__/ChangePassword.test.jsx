import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ChangePassword from '../ChangePassword';
import { AuthProvider } from '../../contexts/AuthContext';
import * as api from '../../services/api';

// Mock the API
jest.mock('../../services/api');
const mockChangePassword = api.changePassword;
const mockVerifyCurrentPassword = api.verifyCurrentPassword;

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

describe('ChangePassword Component', () => {
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

  it('renders change password form correctly', () => {
    render(
      <TestWrapper>
        <ChangePassword />
      </TestWrapper>
    );

    expect(screen.getByText(/change password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <ChangePassword />
      </TestWrapper>
    );

    const changePasswordButton = screen.getByRole('button', { name: /change password/i });
    await user.click(changePasswordButton);

    expect(screen.getByText(/current password is required/i)).toBeInTheDocument();
    expect(screen.getByText(/new password is required/i)).toBeInTheDocument();
    expect(screen.getByText(/please confirm your new password/i)).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <ChangePassword />
      </TestWrapper>
    );

    const currentPasswordInput = screen.getByLabelText(/current password/i);
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);
    const changePasswordButton = screen.getByRole('button', { name: /change password/i });

    await user.type(currentPasswordInput, 'currentpass123');
    await user.type(newPasswordInput, 'newpass123!');
    await user.type(confirmPasswordInput, 'differentpass123!');
    await user.click(changePasswordButton);

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('validates new password requirements', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <ChangePassword />
      </TestWrapper>
    );

    const currentPasswordInput = screen.getByLabelText(/current password/i);
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);
    const changePasswordButton = screen.getByRole('button', { name: /change password/i });

    await user.type(currentPasswordInput, 'currentpass123');
    await user.type(newPasswordInput, 'weak');
    await user.type(confirmPasswordInput, 'weak');
    await user.click(changePasswordButton);

    expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
  });

  it('shows password strength indicator', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <ChangePassword />
      </TestWrapper>
    );

    const newPasswordInput = screen.getByLabelText(/new password/i);
    
    await user.type(newPasswordInput, 'weak');
    expect(screen.getByText(/weak/i)).toBeInTheDocument();

    await user.clear(newPasswordInput);
    await user.type(newPasswordInput, 'StrongPass123!');
    expect(screen.getByText(/strong/i)).toBeInTheDocument();
  });

  it('handles successful password change', async () => {
    const user = userEvent.setup();
    mockChangePassword.mockResolvedValue({ success: true });

    render(
      <TestWrapper>
        <ChangePassword />
      </TestWrapper>
    );

    const currentPasswordInput = screen.getByLabelText(/current password/i);
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);
    const changePasswordButton = screen.getByRole('button', { name: /change password/i });

    await user.type(currentPasswordInput, 'currentpass123');
    await user.type(newPasswordInput, 'NewPass123!');
    await user.type(confirmPasswordInput, 'NewPass123!');
    await user.click(changePasswordButton);

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: 'currentpass123',
        newPassword: 'NewPass123!'
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/password changed successfully/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    }, { timeout: 3000 });
  });

  it('handles password change error', async () => {
    const user = userEvent.setup();
    const mockError = {
      response: {
        data: {
          error: 'Current password is incorrect'
        }
      }
    };

    mockChangePassword.mockRejectedValue(mockError);

    render(
      <TestWrapper>
        <ChangePassword />
      </TestWrapper>
    );

    const currentPasswordInput = screen.getByLabelText(/current password/i);
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);
    const changePasswordButton = screen.getByRole('button', { name: /change password/i });

    await user.type(currentPasswordInput, 'wrongpass123');
    await user.type(newPasswordInput, 'NewPass123!');
    await user.type(confirmPasswordInput, 'NewPass123!');
    await user.click(changePasswordButton);

    await waitFor(() => {
      expect(screen.getByText(/current password is incorrect/i)).toBeInTheDocument();
    });
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <ChangePassword />
      </TestWrapper>
    );

    const currentPasswordInput = screen.getByLabelText(/current password/i);
    const toggleButton = screen.getByLabelText(/toggle password visibility/i);

    expect(currentPasswordInput.type).toBe('password');
    
    await user.click(toggleButton);
    expect(currentPasswordInput.type).toBe('text');
    
    await user.click(toggleButton);
    expect(currentPasswordInput.type).toBe('password');
  });

  it('shows loading state during password change', async () => {
    const user = userEvent.setup();
    mockChangePassword.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <TestWrapper>
        <ChangePassword />
      </TestWrapper>
    );

    const currentPasswordInput = screen.getByLabelText(/current password/i);
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);
    const changePasswordButton = screen.getByRole('button', { name: /change password/i });

    await user.type(currentPasswordInput, 'currentpass123');
    await user.type(newPasswordInput, 'NewPass123!');
    await user.type(confirmPasswordInput, 'NewPass123!');
    await user.click(changePasswordButton);

    expect(screen.getByText(/changing password/i)).toBeInTheDocument();
    expect(changePasswordButton).toBeDisabled();
  });

  it('validates password complexity requirements', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <ChangePassword />
      </TestWrapper>
    );

    const newPasswordInput = screen.getByLabelText(/new password/i);
    
    await user.type(newPasswordInput, 'nouppercase123!');
    expect(screen.getByText(/must contain at least one uppercase letter/i)).toBeInTheDocument();

    await user.clear(newPasswordInput);
    await user.type(newPasswordInput, 'NOLOWERCASE123!');
    expect(screen.getByText(/must contain at least one lowercase letter/i)).toBeInTheDocument();

    await user.clear(newPasswordInput);
    await user.type(newPasswordInput, 'NoNumbers!');
    expect(screen.getByText(/must contain at least one number/i)).toBeInTheDocument();

    await user.clear(newPasswordInput);
    await user.type(newPasswordInput, 'NoSpecialChars123');
    expect(screen.getByText(/must contain at least one special character/i)).toBeInTheDocument();
  });

  it('cancels password change and navigates back', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <ChangePassword />
      </TestWrapper>
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
