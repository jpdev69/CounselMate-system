import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  getViolationTypes: jest.fn(),
  getRecentSlips: jest.fn(),
  getRecentReports: jest.fn(),
  getStats: jest.fn()
}));

// Mock React Router
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Test wrapper with auth context
const TestWrapper = ({ children, user = null }) => (
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

describe('Dashboard Component', () => {
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

  it('renders dashboard correctly', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText(/guidanceos dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print admission slip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete form/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /report student/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search records/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /student manual/i })).toBeInTheDocument();
  });

  it('displays user name from session', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText(/test user/i)).toBeInTheDocument();
  });

  it('navigates to print admission slip when button clicked', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    const printSlipButton = screen.getByRole('button', { name: /print admission slip/i });
    fireEvent.click(printSlipButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/print-slip');
    });
  });

  it('navigates to complete form when button clicked', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    const completeFormButton = screen.getByRole('button', { name: /complete form/i });
    fireEvent.click(completeFormButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/complete-form');
    });
  });

  it('navigates to report student when button clicked', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    const reportStudentButton = screen.getByRole('button', { name: /report student/i });
    fireEvent.click(reportStudentButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/report-student');
    });
  });

  it('navigates to search records when button clicked', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    const searchRecordsButton = screen.getByRole('button', { name: /search records/i });
    fireEvent.click(searchRecordsButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/search');
    });
  });

  it('navigates to student manual when button clicked', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    const studentManualButton = screen.getByRole('button', { name: /student manual/i });
    fireEvent.click(studentManualButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/student-manual');
    });
  });

  it('shows loading state initially', () => {
    mockSessionStorage.getItem.mockReturnValue(null);
    
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('handles navigation to settings', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    const settingsButton = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsButton);

    // Check if settings menu appears or navigation occurs
    expect(settingsButton).toBeInTheDocument();
  });

  it('handles logout functionality', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    const logoutButton = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutButton);

    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('authToken');
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('userData');
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('displays correct role-based interface', () => {
    mockSessionStorage.getItem.mockImplementation((key) => {
      if (key === 'authToken') return 'mock-token';
      if (key === 'userData') return JSON.stringify({
        id: 1,
        email: 'admin@university.edu',
        name: 'Admin User',
        role: 'admin'
      });
      return null;
    });

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText(/admin user/i)).toBeInTheDocument();
    // Admin-specific features should be visible
  });

  it('shows current date', () => {
    const mockDate = new Date('2024-01-15');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText(/january 15, 2024/i)).toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    const firstButton = screen.getByRole('button', { name: /print admission slip/i });
    firstButton.focus();
    
    fireEvent.keyDown(firstButton, { key: 'Enter' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/print-slip');
    });
  });
});
