import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import TermSelector from '../TermSelector';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  getAcademicTerms: jest.fn(),
  getCurrentTerm: jest.fn(),
  validateTerm: jest.fn(),
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

describe('TermSelector Component', () => {
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
      if (key === 'selectedTerm') return JSON.stringify({ id: 1, name: '1st Semester 2024-2025' });
      return null;
    });
  });

  describe('Component Rendering', () => {
    it('renders term selector correctly', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025', startDate: '2024-08-01', endDate: '2024-12-31', isActive: true },
          { id: 2, name: '2nd Semester 2024-2025', startDate: '2025-01-01', endDate: '2025-05-31', isActive: false },
          { id: 3, name: 'Summer 2025', startDate: '2025-06-01', endDate: '2025-07-31', isActive: false }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/academic term/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue('1st Semester 2024-2025')).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      expect(screen.getByText(/loading terms/i)).toBeInTheDocument();
    });

    it('displays error message when terms loading fails', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockRejectedValue(new Error('Failed to load academic terms'));

      render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load academic terms/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('displays empty state when no terms available', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/no academic terms available/i)).toBeInTheDocument();
        expect(screen.getByText(/contact administrator to add terms/i)).toBeInTheDocument();
      });
    });
  });

  describe('Term Selection', () => {
    it('should allow selecting different terms', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025', isActive: true },
          { id: 2, name: '2nd Semester 2024-2025', isActive: false },
          { id: 3, name: 'Summer 2025', isActive: false }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /academic term/i })).toBeInTheDocument();
      });

      const termSelector = screen.getByRole('combobox', { name: /academic term/i });
      await userEvent.click(termSelector);

      await waitFor(() => {
        expect(screen.getByText('1st Semester 2024-2025')).toBeInTheDocument();
        expect(screen.getByText('2nd Semester 2024-2025')).toBeInTheDocument();
        expect(screen.getByText('Summer 2025')).toBeInTheDocument();
      });

      // Select a different term
      const secondSemesterOption = screen.getByText('2nd Semester 2024-2025');
      await userEvent.click(secondSemesterOption);

      await waitFor(() => {
        expect(screen.getByDisplayValue('2nd Semester 2024-2025')).toBeInTheDocument();
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('selectedTerm', JSON.stringify({
          id: 2,
          name: '2nd Semester 2024-2025'
        }));
      });
    });

    it('should call onTermChange callback when term is selected', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025', isActive: true },
          { id: 2, name: '2nd Semester 2024-2025', isActive: false }
        ]
      });

      const mockOnTermChange = jest.fn();

      render(
        <TestWrapper>
          <TermSelector onTermChange={mockOnTermChange} />
        </TestWrapper>
      );

      await waitFor(() => {
        const termSelector = screen.getByRole('combobox', { name: /academic term/i });
        userEvent.click(termSelector);
      });

      await waitFor(() => {
        const secondSemesterOption = screen.getByText('2nd Semester 2024-2025');
        userEvent.click(secondSemesterOption);
      });

      await waitFor(() => {
        expect(mockOnTermChange).toHaveBeenCalledWith({
          id: 2,
          name: '2nd Semester 2024-2025'
        });
      });
    });

    it('should persist selected term in sessionStorage', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025', isActive: true },
          { id: 2, name: '2nd Semester 2024-2025', isActive: false }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        const termSelector = screen.getByRole('combobox', { name: /academic term/i });
        userEvent.click(termSelector);
      });

      await waitFor(() => {
        const secondSemesterOption = screen.getByText('2nd Semester 2024-2025');
        userEvent.click(secondSemesterOption);
      });

      await waitFor(() => {
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('selectedTerm', JSON.stringify({
          id: 2,
          name: '2nd Semester 2024-2025'
        }));
      });
    });
  });

  describe('Current Term Detection', () => {
    it('should automatically select current term', async () => {
      const { getAcademicTerms, getCurrentTerm } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025', startDate: '2024-08-01', endDate: '2024-12-31', isActive: true },
          { id: 2, name: '2nd Semester 2024-2025', startDate: '2025-01-01', endDate: '2025-05-31', isActive: false }
        ]
      });

      getCurrentTerm.mockResolvedValue({
        data: { id: 1, name: '1st Semester 2024-2025' }
      });

      render(
        <TestWrapper>
          <TermSelector autoSelectCurrent={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getCurrentTerm).toHaveBeenCalled();
        expect(screen.getByDisplayValue('1st Semester 2024-2025')).toBeInTheDocument();
      });
    });

    it('should show current term indicator', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025', startDate: '2024-08-01', endDate: '2024-12-31', isActive: true },
          { id: 2, name: '2nd Semester 2024-2025', startDate: '2025-01-01', endDate: '2025-05-31', isActive: false }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector showCurrentIndicator={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/current/i)).toBeInTheDocument();
        expect(screen.getByRole('badge', { name: /current term/i })).toBeInTheDocument();
      });
    });

    it('should handle no current term gracefully', async () => {
      const { getCurrentTerm } = require('../../services/api');
      
      getCurrentTerm.mockResolvedValue({
        data: null
      });

      render(
        <TestWrapper>
          <TermSelector autoSelectCurrent={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/no current term/i)).toBeInTheDocument();
        expect(screen.getByText(/please select a term/i)).toBeInTheDocument();
      });
    });
  });

  describe('Term Information Display', () => {
    it('should show term details when expanded', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { 
            id: 1, 
            name: '1st Semester 2024-2025', 
            startDate: '2024-08-01', 
            endDate: '2024-12-31', 
            isActive: true,
            description: 'First semester of academic year 2024-2025'
          }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector showDetails={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/term details/i)).toBeInTheDocument();
        expect(screen.getByText('August 1, 2024 - December 31, 2024')).toBeInTheDocument();
        expect(screen.getByText('First semester of academic year 2024-2025')).toBeInTheDocument();
      });
    });

    it('should show term duration', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { 
            id: 1, 
            name: '1st Semester 2024-2025', 
            startDate: '2024-08-01', 
            endDate: '2024-12-31', 
            isActive: true
          }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector showDuration={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/duration/i)).toBeInTheDocument();
        expect(screen.getByText(/153 days/i)).toBeInTheDocument(); // Aug 1 to Dec 31, 2024
      });
    });

    it('should show term status', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { 
            id: 1, 
            name: '1st Semester 2024-2025', 
            startDate: '2024-08-01', 
            endDate: '2024-12-31', 
            isActive: true
          },
          { 
            id: 2, 
            name: '2nd Semester 2024-2025', 
            startDate: '2025-01-01', 
            endDate: '2025-05-31', 
            isActive: false
          }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector showStatus={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/active/i)).toBeInTheDocument();
        expect(screen.getByText(/upcoming/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Search', () => {
    it('should allow filtering terms by year', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2023-2024', year: 2023 },
          { id: 2, name: '2nd Semester 2023-2024', year: 2023 },
          { id: 3, name: '1st Semester 2024-2025', year: 2024 },
          { id: 4, name: '2nd Semester 2024-2025', year: 2024 }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector enableFiltering={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/filter by year/i)).toBeInTheDocument();
      });

      const yearFilter = screen.getByLabelText(/filter by year/i);
      await userEvent.selectOptions(yearFilter, '2024');

      await waitFor(() => {
        expect(screen.getByText('1st Semester 2024-2025')).toBeInTheDocument();
        expect(screen.getByText('2nd Semester 2024-2025')).toBeInTheDocument();
        expect(screen.queryByText('1st Semester 2023-2024')).not.toBeInTheDocument();
      });
    });

    it('should allow searching terms by name', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025' },
          { id: 2, name: '2nd Semester 2024-2025' },
          { id: 3, name: 'Summer 2025' }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector enableSearch={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/search terms/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/search terms/i);
      await userEvent.type(searchInput, 'Summer');

      await waitFor(() => {
        expect(screen.getByText('Summer 2025')).toBeInTheDocument();
        expect(screen.queryByText('1st Semester 2024-2025')).not.toBeInTheDocument();
      });
    });

    it('should show no results message for empty search', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector enableSearch={true} />
        </TestWrapper>
      );

      const searchInput = screen.getByLabelText(/search terms/i);
      await userEvent.type(searchInput, 'Nonexistent');

      await waitFor(() => {
        expect(screen.getByText(/no terms found/i)).toBeInTheDocument();
        expect(screen.getByText(/try adjusting your search criteria/i)).toBeInTheDocument();
      });
    });
  });

  describe('Term Creation', () => {
    it('should allow creating new terms when enabled', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector allowCreate={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add new term/i })).toBeInTheDocument();
      });

      const addTermButton = screen.getByRole('button', { name: /add new term/i });
      await userEvent.click(addTermButton);

      await waitFor(() => {
        expect(screen.getByText(/create new academic term/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/term name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
      });
    });

    it('should validate term creation form', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <TermSelector allowCreate={true} />
        </TestWrapper>
      );

      // Open create form
      const addTermButton = screen.getByRole('button', { name: /add new term/i });
      await userEvent.click(addTermButton);

      // Try to submit empty form
      const createButton = screen.getByRole('button', { name: /create term/i });
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/term name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/start date is required/i)).toBeInTheDocument();
        expect(screen.getByText(/end date is required/i)).toBeInTheDocument();
      });
    });

    it('should validate date range', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <TermSelector allowCreate={true} />
        </TestWrapper>
      );

      // Open create form
      const addTermButton = screen.getByRole('button', { name: /add new term/i });
      await userEvent.click(addTermButton);

      // Fill form with invalid date range
      await userEvent.type(screen.getByLabelText(/term name/i), 'Test Term');
      await userEvent.type(screen.getByLabelText(/start date/i), '2024-12-31');
      await userEvent.type(screen.getByLabelText(/end date/i), '2024-01-01'); // End before start

      const createButton = screen.getByRole('button', { name: /create term/i });
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/end date must be after start date/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /academic term/i })).toBeInTheDocument();
        expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', 'Academic Terms');
      });
    });

    it('should support keyboard navigation', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025' },
          { id: 2, name: '2nd Semester 2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        const termSelector = screen.getByRole('combobox', { name: /academic term/i });
        termSelector.focus();
        expect(termSelector).toHaveFocus();

        userEvent.tab();
        expect(screen.getByRole('button', { name: /refresh terms/i })).toHaveFocus();
      });
    });

    it('should announce term selection to screen readers', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025' },
          { id: 2, name: '2nd Semester 2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        const termSelector = screen.getByRole('combobox', { name: /academic term/i });
        userEvent.click(termSelector);
      });

      await waitFor(() => {
        const secondSemesterOption = screen.getByText('2nd Semester 2024-2025');
        userEvent.click(secondSemesterOption);
      });

      await waitFor(() => {
        const statusRegion = screen.getByRole('status');
        expect(statusRegion).toHaveAttribute('aria-live', 'polite');
        expect(statusRegion).toHaveTextContent(/selected term: 2nd Semester 2024-2025/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockRejectedValue({
        response: { data: { error: 'Network error occurred' } }
      });

      render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce({
          data: [
            { id: 1, name: '1st Semester 2024-2025' }
          ]
        });

      render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue('1st Semester 2024-2025')).toBeInTheDocument();
      });
    });

    it('should handle invalid stored term', async () => {
      // Mock invalid stored term
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'selectedTerm') return JSON.stringify({ id: 999, name: 'Invalid Term' });
        return null;
      });

      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/invalid stored term/i)).toBeInTheDocument();
        expect(screen.getByText(/selecting default term/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      // Set mobile viewport
      window.innerWidth = 375;
      window.innerHeight = 667;
      window.dispatchEvent(new Event('resize'));

      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /academic term/i })).toBeInTheDocument();
        // Should be mobile-friendly
        expect(screen.getByRole('combobox', { name: /academic term/i })).toHaveClass('mobile-select');
      });
    });

    it('should show simplified view on small screens', async () => {
      // Set small viewport
      window.innerWidth = 320;
      window.dispatchEvent(new Event('resize'));

      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector showDetails={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should hide details on small screens
        expect(screen.queryByText(/term details/i)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /show details/i })).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should debounce search input', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025' },
          { id: 2, name: '2nd Semester 2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <TermSelector enableSearch={true} />
        </TestWrapper>
      );

      const searchInput = screen.getByLabelText(/search terms/i);
      
      // Rapidly type search terms
      await userEvent.type(searchInput, '1st');
      await userEvent.type(searchInput, ' 2nd');
      await userEvent.type(searchInput, ' Summer');

      // Should only trigger one search due to debouncing
      await waitFor(() => {
        expect(screen.getByText(/no terms found/i)).toBeInTheDocument();
      });
    });

    it('should cache term data', async () => {
      const { getAcademicTerms } = require('../../services/api');
      
      getAcademicTerms.mockResolvedValue({
        data: [
          { id: 1, name: '1st Semester 2024-2025' }
        ]
      });

      const { unmount } = render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getAcademicTerms).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Re-render component
      render(
        <TestWrapper>
          <TermSelector />
        </TestWrapper>
      );

      // Should use cached data
      expect(getAcademicTerms).toHaveBeenCalledTimes(1);
    });
  });
});
