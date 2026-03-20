import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

// Mock the API
jest.mock('../services/api', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  changePassword: jest.fn(),
  verifyCurrentPassword: jest.fn(),
  refreshToken: jest.fn(),
}));

// Test component that uses the auth context
const TestComponent = () => {
  const { user, login, logout, changePassword, isAuthenticated, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
      <div data-testid="user-info">
        {user ? `${user.name} (${user.email})` : 'No User'}
      </div>
      <button onClick={() => login('test@example.com', 'password')}>
        Login
      </button>
      <button onClick={logout}>Logout</button>
      <button onClick={() => changePassword('old', 'new')}>
        Change Password
      </button>
    </div>
  );
};

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

// Mock location
const mockLocation = {
  href: '',
  pathname: '/dashboard'
};
Object.defineProperty(window, 'location', { value: mockLocation });

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.getItem.mockImplementation((key) => {
      if (key === 'authToken') return null;
      if (key === 'userData') return null;
      return null;
    });
  });

  describe('Context Provider', () => {
    it('should provide auth context to children', () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('No User');
    });

    it('should initialize with loading state', () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should restore user session from sessionStorage', async () => {
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

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
        expect(screen.getByTestId('user-info')).toHaveTextContent('Test User (test@example.com)');
      });
    });
  });

  describe('Login Functionality', () => {
    it('should login user successfully', async () => {
      const { login: mockLogin } = require('../services/api');
      
      mockLogin.mockResolvedValue({
        data: {
          success: true,
          token: 'mock-jwt-token',
          user: {
            id: 1,
            email: 'test@example.com',
            name: 'Test User',
            role: 'counselor'
          }
        }
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      const loginButton = screen.getByText('Login');
      await userEvent.click(loginButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password');
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('authToken', 'mock-jwt-token');
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('userData', JSON.stringify({
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'counselor'
        }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
        expect(screen.getByTestId('user-info')).toHaveTextContent('Test User (test@example.com)');
      });
    });

    it('should handle login errors', async () => {
      const { login: mockLogin } = require('../services/api');
      
      mockLogin.mockRejectedValue({
        response: { data: { error: 'Invalid credentials' } }
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      const loginButton = screen.getByText('Login');
      await userEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
        expect(screen.getByTestId('user-info')).toHaveTextContent('No User');
      });
    });

    it('should handle network errors during login', async () => {
      const { login: mockLogin } = require('../services/api');
      
      mockLogin.mockRejectedValue(new Error('Network error'));

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      const loginButton = screen.getByText('Login');
      await userEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      });
    });
  });

  describe('Logout Functionality', () => {
    it('should logout user successfully', async () => {
      const { logout: mockLogout } = require('../services/api');
      
      mockLogout.mockResolvedValue({
        data: { success: true }
      });

      // Start with authenticated user
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

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      const logoutButton = screen.getByText('Logout');
      await userEvent.click(logoutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('authToken');
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('userData');
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
        expect(screen.getByTestId('user-info')).toHaveTextContent('No User');
      });
    });

    it('should handle logout errors gracefully', async () => {
      const { logout: mockLogout } = require('../services/api');
      
      mockLogout.mockRejectedValue(new Error('Logout failed'));

      // Start with authenticated user
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

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      const logoutButton = screen.getByText('Logout');
      await userEvent.click(logoutButton);

      await waitFor(() => {
        // Should still clear local session even if API call fails
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('authToken');
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('userData');
      });
    });
  });

  describe('Change Password Functionality', () => {
    it('should change password successfully', async () => {
      const { changePassword: mockChangePassword } = require('../services/api');
      
      mockChangePassword.mockResolvedValue({
        data: { success: true, message: 'Password changed successfully' }
      });

      // Start with authenticated user
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

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      const changePasswordButton = screen.getByText('Change Password');
      await userEvent.click(changePasswordButton);

      await waitFor(() => {
        expect(mockChangePassword).toHaveBeenCalledWith('old', 'new');
      });
    });

    it('should handle password change errors', async () => {
      const { changePassword: mockChangePassword } = require('../services/api');
      
      mockChangePassword.mockRejectedValue({
        response: { data: { error: 'Current password is incorrect' } }
      });

      // Start with authenticated user
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

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      const changePasswordButton = screen.getByText('Change Password');
      await userEvent.click(changePasswordButton);

      await waitFor(() => {
        expect(mockChangePassword).toHaveBeenCalledWith('old', 'new');
      });
    });
  });

  describe('Token Management', () => {
    it('should handle token expiration', async () => {
      const { refreshToken: mockRefreshToken } = require('../services/api');
      
      mockRefreshToken.mockResolvedValue({
        data: {
          success: true,
          token: 'new-mock-token'
        }
      });

      // Start with expired token scenario
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'authToken') return 'expired-token';
        if (key === 'userData') return JSON.stringify({
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'counselor'
        });
        return null;
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockRefreshToken).toHaveBeenCalled();
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('authToken', 'new-mock-token');
      });
    });

    it('should logout on token refresh failure', async () => {
      const { refreshToken: mockRefreshToken } = require('../services/api');
      
      mockRefreshToken.mockRejectedValue(new Error('Token refresh failed'));

      // Start with expired token scenario
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'authToken') return 'expired-token';
        if (key === 'userData') return JSON.stringify({
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'counselor'
        });
        return null;
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockRefreshToken).toHaveBeenCalled();
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('authToken');
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('userData');
      });
    });
  });

  describe('Session Management', () => {
    it('should handle session timeout', async () => {
      jest.useFakeTimers();

      // Start with authenticated user
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

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      // Simulate session timeout (30 minutes of inactivity)
      jest.advanceTimersByTime(30 * 60 * 1000);

      await waitFor(() => {
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('authToken');
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('userData');
      });

      jest.useRealTimers();
    });

    it('should reset session timeout on user activity', async () => {
      jest.useFakeTimers();

      // Start with authenticated user
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

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      // Simulate user activity before timeout
      jest.advanceTimersByTime(25 * 60 * 1000); // 25 minutes
      
      // Trigger user activity
      fireEvent.mouseMove(document);
      
      // Advance remaining time
      jest.advanceTimersByTime(10 * 60 * 1000); // 10 more minutes

      // Should not have timed out due to activity reset
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');

      jest.useRealTimers();
    });
  });

  describe('Context Hooks', () => {
    it('should throw error when useAuth is used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });

    it('should provide correct context values', async () => {
      let contextValues;

      const ContextChecker = () => {
        const auth = useAuth();
        contextValues = auth;
        return <div>Context checked</div>;
      };

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

      render(
        <BrowserRouter>
          <AuthProvider>
            <ContextChecker />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(contextValues.isAuthenticated).toBe(true);
        expect(contextValues.user).toEqual({
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'counselor'
        });
        expect(typeof contextValues.login).toBe('function');
        expect(typeof contextValues.logout).toBe('function');
        expect(typeof contextValues.changePassword).toBe('function');
        expect(typeof contextValues.verifyCurrentPassword).toBe('function');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted session data', async () => {
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'authToken') return 'mock-token';
        if (key === 'userData') return 'invalid-json'; // Corrupted data
        return null;
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('userData');
      });
    });

    it('should handle missing token with user data', async () => {
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'authToken') return null; // Missing token
        if (key === 'userData') return JSON.stringify({
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'counselor'
        });
        return null;
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('userData');
      });
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      let renderCount = 0;
      
      const TestComponentWithCounter = () => {
        renderCount++;
        return <TestComponent />;
      };

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

      const { rerender } = render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponentWithCounter />
          </AuthProvider>
        </BrowserRouter>
      );

      // Initial render
      expect(renderCount).toBe(1);

      // Re-render with same props
      rerender(
        <BrowserRouter>
          <AuthProvider>
            <TestComponentWithCounter />
          </AuthProvider>
        </BrowserRouter>
      );

      // Should not re-render children unnecessarily
      expect(renderCount).toBe(1);
    });
  });
});
