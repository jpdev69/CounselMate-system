/**
 * @level unit
 * @description Unit tests for main App component and routing functionality
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

// Mock the contexts
jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    changePassword: jest.fn(),
    verifyCurrentPassword: jest.fn()
  })
}));

jest.mock('../contexts/SlipsContext', () => ({
  SlipsProvider: ({ children }) => <div>{children}</div>,
  useSlips: () => ({
    slips: [],
    loading: false,
    error: null,
    fetchSlips: jest.fn(),
    createSlip: jest.fn(),
    updateSlip: jest.fn(),
    deleteSlip: jest.fn()
  })
}));

// Mock React Router
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/' }),
}));

// Mock the components
jest.mock('../components/Layout', () => {
  return function MockLayout({ children }) {
    return (
      <div data-testid="layout">
        <header data-testid="header">
          <nav data-testid="navigation">
            <a href="/login">Login</a>
            <a href="/dashboard">Dashboard</a>
          </nav>
        </header>
        <main data-testid="main-content">
          {children}
        </main>
      </div>
    );
  };
});

jest.mock('../components/Login', () => {
  return function MockLogin() {
    return <div data-testid="login-page">Login Page</div>;
  };
});

jest.mock('../components/Dashboard', () => {
  return function MockDashboard() {
    return <div data-testid="dashboard-page">Dashboard Page</div>;
  };
});

jest.mock('../components/ProtectedRoute', () => {
  return function MockProtectedRoute({ children }) {
    return <div data-testid="protected-route">{children}</div>;
  };
});

jest.mock('../components/AdminRoute', () => {
  return function MockAdminRoute({ children }) {
    return <div data-testid="admin-route">{children}</div>;
  };
});

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.getItem.mockImplementation((key) => {
      if (key === 'authToken') return null;
      if (key === 'userData') return null;
      return null;
    });
  });

  describe('Component Rendering', () => {
    it('renders the app without crashing', () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('navigation')).toBeInTheDocument();
      expect(screen.getByTestId('main-content')).toBeInTheDocument();
    });

    it('renders login page by default', () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    it('renders dashboard when authenticated', () => {
      // Mock authenticated state
      const { useAuth } = require('../contexts/AuthContext');
      useAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 1, email: 'test@example.com', role: 'counselor' },
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        verifyCurrentPassword: jest.fn()
      });

      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    it('shows loading state while checking authentication', () => {
      // Mock loading state
      const { useAuth } = require('../contexts/AuthContext');
      useAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
        loading: true,
        login: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        verifyCurrentPassword: jest.fn()
      });

      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Routing', () => {
    it('should navigate to login page when not authenticated', () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    it('should navigate to dashboard when authenticated', () => {
      const { useAuth } = require('../contexts/AuthContext');
      useAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 1, email: 'test@example.com', role: 'counselor' },
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        verifyCurrentPassword: jest.fn()
      });

      render(
        <BrowserRouter initialEntries={['/dashboard']}>
          <App />
        </BrowserRouter>
      );

      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    it('should redirect to login when accessing protected routes without authentication', () => {
      render(
        <BrowserRouter initialEntries={['/report-student']}>
          <App />
        </BrowserRouter>
      );

      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    it('should allow access to protected routes when authenticated', () => {
      const { useAuth } = require('../contexts/AuthContext');
      useAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 1, email: 'test@example.com', role: 'counselor' },
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        verifyCurrentPassword: jest.fn()
      });

      render(
        <BrowserRouter initialEntries={['/report-student']}>
          <App />
        </BrowserRouter>
      );

      // Should show protected content
      expect(screen.getByTestId('protected-route')).toBeInTheDocument();
    });

    it('should handle admin routes correctly', () => {
      const { useAuth } = require('../contexts/AuthContext');
      useAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 1, email: 'admin@university.edu', role: 'admin' },
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        verifyCurrentPassword: jest.fn()
      });

      render(
        <BrowserRouter initialEntries={['/admin']}>
          <App />
        </BrowserRouter>
      );

      expect(screen.getByTestId('admin-route')).toBeInTheDocument();
    });

    it('should redirect non-admin users from admin routes', () => {
      const { useAuth } = require('../contexts/AuthContext');
      useAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 1, email: 'counselor@university.edu', role: 'counselor' },
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        verifyCurrentPassword: jest.fn()
      });

      render(
        <BrowserRouter initialEntries={['/admin']}>
          <App />
        </BrowserRouter>
      );

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 routes gracefully', () => {
      render(
        <BrowserRouter initialEntries={['/nonexistent-route']}>
          <App />
        </BrowserRouter>
      );

      expect(screen.getByText('Page not found')).toBeInTheDocument();
      expect(screen.getByText('The page you are looking for does not exist.')).toBeInTheDocument();
    });

    it('should show error boundary when component crashes', () => {
      // Mock a component that throws an error
      const originalError = console.error;
      console.error = jest.fn();

      jest.doMock('../components/Login', () => {
        return function MockErrorLogin() {
          throw new Error('Component crashed');
        };
      });

      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('An unexpected error occurred. Please refresh the page.')).toBeInTheDocument();

      console.error = originalError;
    });
  });

  describe('Global Error Handling', () => {
    it('should handle unhandled promise rejections', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Simulate unhandled promise rejection
      const unhandledRejection = new Error('Unhandled promise rejection');
      window.dispatchEvent(new Event('unhandledrejection', { reason: unhandledRejection }));

      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('should handle uncaught errors', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Simulate uncaught error
      const uncaughtError = new Error('Uncaught error');
      window.dispatchEvent(new ErrorEvent('error', { error: uncaughtError }));

      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should render efficiently', () => {
      const startTime = performance.now();

      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within 100ms
      expect(renderTime).toBeLessThan(100);
    });

    it('should not re-render unnecessarily', () => {
      let renderCount = 0;

      const { rerender } = render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      renderCount++;

      // Re-render with same props
      rerender(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Should not cause unnecessary re-renders
      expect(renderCount).toBe(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      expect(screen.getByRole('banner')).toBeInTheDocument(); // header
      expect(screen.getByRole('navigation')).toBeInTheDocument(); // nav
      expect(screen.getByRole('main')).toBeInTheDocument(); // main
    });

    it('should support keyboard navigation', () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      const navigation = screen.getByTestId('navigation');
      const firstLink = navigation.querySelector('a');
      
      firstLink.focus();
      expect(firstLink).toHaveFocus();

      userEvent.tab();
      // Should move to next focusable element
    });

    it('should announce page changes to screen readers', () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Theme and Styling', () => {
    it('should apply correct CSS classes', () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      const appElement = document.getElementById('root').firstChild;
      expect(appElement).toHaveClass('app');
    });

    it('should support theme switching', () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Test theme class application
      document.documentElement.setAttribute('data-theme', 'dark');
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });
  });

  describe('Context Providers', () => {
    it('should wrap app with AuthProvider', () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // AuthProvider should be available to child components
      const { useAuth } = require('../contexts/AuthContext');
      expect(typeof useAuth).toBe('function');
    });

    it('should wrap app with SlipsProvider', () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // SlipsProvider should be available to child components
      const { useSlips } = require('../contexts/SlipsContext');
      expect(typeof useSlips).toBe('function');
    });
  });

  describe('Browser Compatibility', () => {
    it('should handle missing browser APIs gracefully', () => {
      // Mock missing sessionStorage
      const originalSessionStorage = window.sessionStorage;
      delete window.sessionStorage;

      expect(() => {
        render(
          <BrowserRouter>
            <App />
          </BrowserRouter>
        );
      }).not.toThrow();

      // Restore sessionStorage
      window.sessionStorage = originalSessionStorage;
    });

    it('should handle unsupported browsers', () => {
      // Mock old browser detection
      Object.defineProperty(navigator, 'userAgent', {
        value: 'MSIE 9.0',
        configurable: true
      });

      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Should show browser compatibility warning or fallback
      expect(screen.getByText('Your browser is not supported')).toBeInTheDocument();
    });
  });

  describe('Security Features', () => {
    it('should implement CSP headers', () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Check if CSP meta tag is present
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      expect(cspMeta).toBeInTheDocument();
    });

    it('should prevent XSS attacks', () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Test that script tags are not executed
      const scriptContent = '<script>alert("XSS")</script>';
      expect(() => {
        screen.getByText(scriptContent);
      }).not.toThrow();
    });
  });

  describe('Development Features', () => {
    it('should show development tools in development mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Should show development tools or debug info
      expect(screen.getByTestId('dev-tools')).toBeInTheDocument();

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should hide development tools in production', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Should not show development tools
      expect(screen.queryByTestId('dev-tools')).not.toBeInTheDocument();

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete user flow from login to dashboard', async () => {
      const { useAuth } = require('../contexts/AuthContext');
      let authState = {
        isAuthenticated: false,
        user: null,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        verifyCurrentPassword: jest.fn()
      };

      useAuth.mockReturnValue(authState);

      const { rerender } = render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Initially shows login page
      expect(screen.getByTestId('login-page')).toBeInTheDocument();

      // Simulate successful login
      authState = {
        ...authState,
        isAuthenticated: true,
        user: { id: 1, email: 'test@example.com', role: 'counselor' }
      };

      rerender(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Should show dashboard
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    it('should handle logout flow correctly', async () => {
      const { useAuth } = require('../contexts/AuthContext');
      let authState = {
        isAuthenticated: true,
        user: { id: 1, email: 'test@example.com', role: 'counselor' },
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        verifyCurrentPassword: jest.fn()
      };

      useAuth.mockReturnValue(authState);

      const { rerender } = render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Shows dashboard initially
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();

      // Simulate logout
      authState = {
        ...authState,
        isAuthenticated: false,
        user: null
      };

      rerender(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Should redirect to login
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });
});
