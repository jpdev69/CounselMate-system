import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import SchoolYearSelector from '../SchoolYearSelector';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  getSchoolYears: jest.fn(),
  getCurrentSchoolYear: jest.fn(),
  validateSchoolYear: jest.fn(),
  createSchoolYear: jest.fn(),
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

describe('SchoolYearSelector Component', () => {
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
      if (key === 'selectedSchoolYear') return JSON.stringify({ id: 1, name: '2024-2025' });
      return null;
    });
  });

  describe('Component Rendering', () => {
    it('renders school year selector correctly', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025', startDate: '2024-06-01', endDate: '2025-05-31', isActive: true },
          { id: 2, name: '2023-2024', startDate: '2023-06-01', endDate: '2024-05-31', isActive: false },
          { id: 3, name: '2025-2026', startDate: '2025-06-01', endDate: '2026-05-31', isActive: false }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/school year/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue('2024-2025')).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      expect(screen.getByText(/loading school years/i)).toBeInTheDocument();
    });

    it('displays error message when school years loading fails', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockRejectedValue(new Error('Failed to load school years'));

      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load school years/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('displays empty state when no school years available', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/no school years available/i)).toBeInTheDocument();
        expect(screen.getByText(/contact administrator to add school years/i)).toBeInTheDocument();
      });
    });
  });

  describe('School Year Selection', () => {
    it('should allow selecting different school years', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025', isActive: true },
          { id: 2, name: '2023-2024', isActive: false },
          { id: 3, name: '2025-2026', isActive: false }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /school year/i })).toBeInTheDocument();
      });

      const schoolYearSelector = screen.getByRole('combobox', { name: /school year/i });
      await userEvent.click(schoolYearSelector);

      await waitFor(() => {
        expect(screen.getByText('2024-2025')).toBeInTheDocument();
        expect(screen.getByText('2023-2024')).toBeInTheDocument();
        expect(screen.getByText('2025-2026')).toBeInTheDocument();
      });

      // Select a different school year
      const previousYearOption = screen.getByText('2023-2024');
      await userEvent.click(previousYearOption);

      await waitFor(() => {
        expect(screen.getByDisplayValue('2023-2024')).toBeInTheDocument();
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('selectedSchoolYear', JSON.stringify({
          id: 2,
          name: '2023-2024'
        }));
      });
    });

    it('should call onSchoolYearChange callback when school year is selected', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025', isActive: true },
          { id: 2, name: '2023-2024', isActive: false }
        ]
      });

      const mockOnSchoolYearChange = jest.fn();

      render(
        <TestWrapper>
          <SchoolYearSelector onSchoolYearChange={mockOnSchoolYearChange} />
        </TestWrapper>
      );

      await waitFor(() => {
        const schoolYearSelector = screen.getByRole('combobox', { name: /school year/i });
        userEvent.click(schoolYearSelector);
      });

      await waitFor(() => {
        const previousYearOption = screen.getByText('2023-2024');
        userEvent.click(previousYearOption);
      });

      await waitFor(() => {
        expect(mockOnSchoolYearChange).toHaveBeenCalledWith({
          id: 2,
          name: '2023-2024'
        });
      });
    });

    it('should persist selected school year in sessionStorage', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025', isActive: true },
          { id: 2, name: '2023-2024', isActive: false }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        const schoolYearSelector = screen.getByRole('combobox', { name: /school year/i });
        userEvent.click(schoolYearSelector);
      });

      await waitFor(() => {
        const previousYearOption = screen.getByText('2023-2024');
        userEvent.click(previousYearOption);
      });

      await waitFor(() => {
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('selectedSchoolYear', JSON.stringify({
          id: 2,
          name: '2023-2024'
        }));
      });
    });
  });

  describe('Current School Year Detection', () => {
    it('should automatically select current school year', async () => {
      const { getSchoolYears, getCurrentSchoolYear } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025', startDate: '2024-06-01', endDate: '2025-05-31', isActive: true },
          { id: 2, name: '2023-2024', startDate: '2023-06-01', endDate: '2024-05-31', isActive: false }
        ]
      });

      getCurrentSchoolYear.mockResolvedValue({
        data: { id: 1, name: '2024-2025' }
      });

      render(
        <TestWrapper>
          <SchoolYearSelector autoSelectCurrent={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getCurrentSchoolYear).toHaveBeenCalled();
        expect(screen.getByDisplayValue('2024-2025')).toBeInTheDocument();
      });
    });

    it('should show current school year indicator', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025', startDate: '2024-06-01', endDate: '2025-05-31', isActive: true },
          { id: 2, name: '2023-2024', startDate: '2023-06-01', endDate: '2024-05-31', isActive: false }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector showCurrentIndicator={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/current/i)).toBeInTheDocument();
        expect(screen.getByRole('badge', { name: /current school year/i })).toBeInTheDocument();
      });
    });

    it('should handle no current school year gracefully', async () => {
      const { getCurrentSchoolYear } = require('../../services/api');
      
      getCurrentSchoolYear.mockResolvedValue({
        data: null
      });

      render(
        <TestWrapper>
          <SchoolYearSelector autoSelectCurrent={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/no current school year/i)).toBeInTheDocument();
        expect(screen.getByText(/please select a school year/i)).toBeInTheDocument();
      });
    });
  });

  describe('School Year Information Display', () => {
    it('should show school year details when expanded', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { 
            id: 1, 
            name: '2024-2025', 
            startDate: '2024-06-01', 
            endDate: '2025-05-31', 
            isActive: true,
            description: 'Academic year 2024-2025',
            totalStudents: 1500,
            totalViolations: 125
          }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector showDetails={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/school year details/i)).toBeInTheDocument();
        expect(screen.getByText('June 1, 2024 - May 31, 2025')).toBeInTheDocument();
        expect(screen.getByText('Academic year 2024-2025')).toBeInTheDocument();
        expect(screen.getByText('Total Students: 1,500')).toBeInTheDocument();
        expect(screen.getByText('Total Violations: 125')).toBeInTheDocument();
      });
    });

    it('should show school year duration', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { 
            id: 1, 
            name: '2024-2025', 
            startDate: '2024-06-01', 
            endDate: '2025-05-31', 
            isActive: true
          }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector showDuration={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/duration/i)).toBeInTheDocument();
        expect(screen.getByText(/365 days/i)).toBeInTheDocument(); // June 1, 2024 to May 31, 2025
      });
    });

    it('should show school year status', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { 
            id: 1, 
            name: '2024-2025', 
            startDate: '2024-06-01', 
            endDate: '2025-05-31', 
            isActive: true
          },
          { 
            id: 2, 
            name: '2023-2024', 
            startDate: '2023-06-01', 
            endDate: '2024-05-31', 
            isActive: false
          },
          { 
            id: 3, 
            name: '2025-2026', 
            startDate: '2025-06-01', 
            endDate: '2026-05-31', 
            isActive: false
          }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector showStatus={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/active/i)).toBeInTheDocument();
        expect(screen.getByText(/completed/i)).toBeInTheDocument();
        expect(screen.getByText(/upcoming/i)).toBeInTheDocument();
      });
    });

    it('should show progress through the school year', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { 
            id: 1, 
            name: '2024-2025', 
            startDate: '2024-06-01', 
            endDate: '2025-05-31', 
            isActive: true,
            progressPercentage: 65
          }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector showProgress={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/progress/i)).toBeInTheDocument();
        expect(screen.getByText('65% complete')).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Search', () => {
    it('should allow filtering by status', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025', status: 'active' },
          { id: 2, name: '2023-2024', status: 'completed' },
          { id: 3, name: '2025-2026', status: 'upcoming' }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector enableFiltering={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
      });

      const statusFilter = screen.getByLabelText(/filter by status/i);
      await userEvent.selectOptions(statusFilter, 'active');

      await waitFor(() => {
        expect(screen.getByText('2024-2025')).toBeInTheDocument();
        expect(screen.queryByText('2023-2024')).not.toBeInTheDocument();
        expect(screen.queryByText('2025-2026')).not.toBeInTheDocument();
      });
    });

    it('should allow searching school years by name', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025' },
          { id: 2, name: '2023-2024' },
          { id: 3, name: '2025-2026' }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector enableSearch={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/search school years/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/search school years/i);
      await userEvent.type(searchInput, '2025');

      await waitFor(() => {
        expect(screen.getByText('2025-2026')).toBeInTheDocument();
        expect(screen.queryByText('2024-2025')).not.toBeInTheDocument();
        expect(screen.queryByText('2023-2024')).not.toBeInTheDocument();
      });
    });

    it('should show no results message for empty search', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector enableSearch={true} />
        </TestWrapper>
      );

      const searchInput = screen.getByLabelText(/search school years/i);
      await userEvent.type(searchInput, 'Nonexistent');

      await waitFor(() => {
        expect(screen.getByText(/no school years found/i)).toBeInTheDocument();
        expect(screen.getByText(/try adjusting your search criteria/i)).toBeInTheDocument();
      });
    });
  });

  describe('School Year Creation', () => {
    it('should allow creating new school years when enabled', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector allowCreate={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add new school year/i })).toBeInTheDocument();
      });

      const addSchoolYearButton = screen.getByRole('button', { name: /add new school year/i });
      await userEvent.click(addSchoolYearButton);

      await waitFor(() => {
        expect(screen.getByText(/create new school year/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/school year name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      });
    });

    it('should validate school year creation form', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <SchoolYearSelector allowCreate={true} />
        </TestWrapper>
      );

      // Open create form
      const addSchoolYearButton = screen.getByRole('button', { name: /add new school year/i });
      await userEvent.click(addSchoolYearButton);

      // Try to submit empty form
      const createButton = screen.getByRole('button', { name: /create school year/i });
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/school year name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/start date is required/i)).toBeInTheDocument();
        expect(screen.getByText(/end date is required/i)).toBeInTheDocument();
      });
    });

    it('should validate school year format', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <SchoolYearSelector allowCreate={true} />
        </TestWrapper>
      );

      // Open create form
      const addSchoolYearButton = screen.getByRole('button', { name: /add new school year/i });
      await userEvent.click(addSchoolYearButton);

      // Fill form with invalid format
      await userEvent.type(screen.getByLabelText(/school year name/i), 'Invalid Format');
      await userEvent.type(screen.getByLabelText(/start date/i), '2024-06-01');
      await userEvent.type(screen.getByLabelText(/end date/i), '2025-05-31');

      const createButton = screen.getByRole('button', { name: /create school year/i });
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/school year name must be in format YYYY-YYYY/i)).toBeInTheDocument();
      });
    });

    it('should validate date range', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <SchoolYearSelector allowCreate={true} />
        </TestWrapper>
      );

      // Open create form
      const addSchoolYearButton = screen.getByRole('button', { name: /add new school year/i });
      await userEvent.click(addSchoolYearButton);

      // Fill form with invalid date range
      await userEvent.type(screen.getByLabelText(/school year name/i), '2025-2026');
      await userEvent.type(screen.getByLabelText(/start date/i), '2025-06-01');
      await userEvent.type(screen.getByLabelText(/end date/i), '2025-05-31'); // End before start

      const createButton = screen.getByRole('button', { name: /create school year/i });
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/end date must be after start date/i)).toBeInTheDocument();
      });
    });

    it('should check for overlapping school years', async () => {
      const { getSchoolYears, createSchoolYear } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025', startDate: '2024-06-01', endDate: '2025-05-31' }
        ]
      });

      createSchoolYear.mockRejectedValue({
        response: { data: { error: 'School year overlaps with existing year' } }
      });

      render(
        <TestWrapper>
          <SchoolYearSelector allowCreate={true} />
        </TestWrapper>
      );

      // Open create form
      const addSchoolYearButton = screen.getByRole('button', { name: /add new school year/i });
      await userEvent.click(addSchoolYearButton);

      // Fill form with overlapping dates
      await userEvent.type(screen.getByLabelText(/school year name/i), '2024-2025');
      await userEvent.type(screen.getByLabelText(/start date/i), '2024-06-01');
      await userEvent.type(screen.getByLabelText(/end date/i), '2025-05-31');

      const createButton = screen.getByRole('button', { name: /create school year/i });
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/school year overlaps with existing year/i)).toBeInTheDocument();
      });
    });
  });

  describe('Statistics Display', () => {
    it('should show school year statistics', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { 
            id: 1, 
            name: '2024-2025', 
            isActive: true,
            statistics: {
              totalStudents: 1500,
              totalViolations: 125,
              totalAdmissionSlips: 200,
              totalReports: 85,
              averageViolationsPerStudent: 0.083,
              mostCommonViolationType: 'IMPROPER_UNIFORM'
            }
          }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector showStatistics={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/statistics/i)).toBeInTheDocument();
        expect(screen.getByText('1,500')).toBeInTheDocument();
        expect(screen.getByText('125')).toBeInTheDocument();
        expect(screen.getByText('200')).toBeInTheDocument();
        expect(screen.getByText('85')).toBeInTheDocument();
        expect(screen.getByText('0.083')).toBeInTheDocument();
        expect(screen.getByText('IMPROPER_UNIFORM')).toBeInTheDocument();
      });
    });

    it('should show comparison with previous year', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { 
            id: 1, 
            name: '2024-2025', 
            isActive: true,
            comparison: {
              previousYearName: '2023-2024',
              violationsChange: '+15%',
              studentsChange: '+5%',
              admissionSlipsChange: '+8%',
              reportsChange: '-3%'
            }
          }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector showComparison={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/comparison with 2023-2024/i)).toBeInTheDocument();
        expect(screen.getByText('+15%')).toBeInTheDocument();
        expect(screen.getByText('+5%')).toBeInTheDocument();
        expect(screen.getByText('+8%')).toBeInTheDocument();
        expect(screen.getByText('-3%')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation and Actions', () => {
    it('should provide navigation to school year details', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector showActions={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /export data/i })).toBeInTheDocument();
      });
    });

    it('should refresh school year data', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await userEvent.click(refreshButton);

      await waitFor(() => {
        expect(getSchoolYears).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /school year/i })).toBeInTheDocument();
        expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', 'School Years');
      });
    });

    it('should support keyboard navigation', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025' },
          { id: 2, name: '2023-2024' }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        const schoolYearSelector = screen.getByRole('combobox', { name: /school year/i });
        schoolYearSelector.focus();
        expect(schoolYearSelector).toHaveFocus();

        userEvent.tab();
        expect(screen.getByRole('button', { name: /refresh/i })).toHaveFocus();
      });
    });

    it('should announce school year selection to screen readers', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025' },
          { id: 2, name: '2023-2024' }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        const schoolYearSelector = screen.getByRole('combobox', { name: /school year/i });
        userEvent.click(schoolYearSelector);
      });

      await waitFor(() => {
        const previousYearOption = screen.getByText('2023-2024');
        userEvent.click(previousYearOption);
      });

      await waitFor(() => {
        const statusRegion = screen.getByRole('status');
        expect(statusRegion).toHaveAttribute('aria-live', 'polite');
        expect(statusRegion).toHaveTextContent(/selected school year: 2023-2024/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockRejectedValue({
        response: { data: { error: 'Network error occurred' } }
      });

      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce({
          data: [
            { id: 1, name: '2024-2025' }
          ]
        });

      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue('2024-2025')).toBeInTheDocument();
      });
    });

    it('should handle invalid stored school year', async () => {
      // Mock invalid stored school year
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'selectedSchoolYear') return JSON.stringify({ id: 999, name: 'Invalid Year' });
        return null;
      });

      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/invalid stored school year/i)).toBeInTheDocument();
        expect(screen.getByText(/selecting default school year/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      // Set mobile viewport
      window.innerWidth = 375;
      window.innerHeight = 667;
      window.dispatchEvent(new Event('resize'));

      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /school year/i })).toBeInTheDocument();
        // Should be mobile-friendly
        expect(screen.getByRole('combobox', { name: /school year/i })).toHaveClass('mobile-select');
      });
    });

    it('should show simplified view on small screens', async () => {
      // Set small viewport
      window.innerWidth = 320;
      window.dispatchEvent(new Event('resize'));

      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025' }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector showDetails={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should hide details on small screens
        expect(screen.queryByText(/school year details/i)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /show details/i })).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should debounce search input', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025' },
          { id: 2, name: '2023-2024' }
        ]
      });

      render(
        <TestWrapper>
          <SchoolYearSelector enableSearch={true} />
        </TestWrapper>
      );

      const searchInput = screen.getByLabelText(/search school years/i);
      
      // Rapidly type search terms
      await userEvent.type(searchInput, '2024');
      await userEvent.type(searchInput, ' 2023');
      await userEvent.type(searchInput, ' 2025');

      // Should only trigger one search due to debouncing
      await waitFor(() => {
        expect(screen.getByText(/no school years found/i)).toBeInTheDocument();
      });
    });

    it('should cache school year data', async () => {
      const { getSchoolYears } = require('../../services/api');
      
      getSchoolYears.mockResolvedValue({
        data: [
          { id: 1, name: '2024-2025' }
        ]
      });

      const { unmount } = render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getSchoolYears).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Re-render component
      render(
        <TestWrapper>
          <SchoolYearSelector />
        </TestWrapper>
      );

      // Should use cached data
      expect(getSchoolYears).toHaveBeenCalledTimes(1);
    });
  });
});
