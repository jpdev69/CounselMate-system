import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ViolationAnalytics from '../ViolationAnalytics';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  getViolationAnalytics: jest.fn(),
  getViolationTrends: jest.fn(),
  getViolationCategories: jest.fn(),
  getStudentViolations: jest.fn(),
  exportAnalyticsData: jest.fn(),
  getAnalyticsFilters: jest.fn(),
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

describe('ViolationAnalytics Component', () => {
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
    it('renders violation analytics dashboard correctly', async () => {
      const { getViolationAnalytics, getViolationTrends, getViolationCategories } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({
        data: {
          totalViolations: 150,
          minorViolations: 120,
          majorViolations: 30,
          thisMonth: 25,
          lastMonth: 30,
          resolvedCases: 100,
          pendingCases: 50
        }
      });

      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', count: 25, category: 'minor' },
          { month: '2024-02', count: 30, category: 'minor' },
          { month: '2024-03', count: 35, category: 'minor' }
        ]
      });

      getViolationCategories.mockResolvedValue({
        data: [
          { category: 'minor', count: 120, percentage: 80 },
          { category: 'major', count: 30, percentage: 20 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/violation analytics/i)).toBeInTheDocument();
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
        expect(screen.getByText('150')).toBeInTheDocument();
        expect(screen.getByText('120')).toBeInTheDocument();
        expect(screen.getByText('30')).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      expect(screen.getByText(/loading analytics/i)).toBeInTheDocument();
    });

    it('displays error message when data loading fails', async () => {
      const { getViolationAnalytics } = require('../../services/api');
      
      getViolationAnalytics.mockRejectedValue(new Error('Failed to load analytics data'));

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load analytics/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Analytics Summary', () => {
    it('displays key metrics', async () => {
      const { getViolationAnalytics, getViolationTrends, getViolationCategories } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({
        data: {
          totalViolations: 150,
          minorViolations: 120,
          majorViolations: 30,
          thisMonth: 25,
          lastMonth: 30,
          resolvedCases: 100,
          pendingCases: 50,
          averageResolutionTime: 3.5,
          repeatOffenders: 15
        }
      });

      getViolationTrends.mockResolvedValue({ data: [] });
      getViolationCategories.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/total violations/i)).toBeInTheDocument();
        expect(screen.getByText(/minor violations/i)).toBeInTheDocument();
        expect(screen.getByText(/major violations/i)).toBeInTheDocument();
        expect(screen.getByText(/this month/i)).toBeInTheDocument();
        expect(screen.getByText(/last month/i)).toBeInTheDocument();
        expect(screen.getByText(/resolved cases/i)).toBeInTheDocument();
        expect(screen.getByText(/pending cases/i)).toBeInTheDocument();
        expect(screen.getByText(/average resolution time/i)).toBeInTheDocument();
        expect(screen.getByText(/repeat offenders/i)).toBeInTheDocument();
      });
    });

    it('shows trend indicators', async () => {
      const { getViolationAnalytics, getViolationTrends, getViolationCategories } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({
        data: {
          thisMonth: 25,
          lastMonth: 30,
          trend: 'decreasing',
          trendPercentage: -16.7
        }
      });

      getViolationTrends.mockResolvedValue({ data: [] });
      getViolationCategories.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('25')).toBeInTheDocument();
        expect(screen.getByText('30')).toBeInTheDocument();
        expect(screen.getByText(/decreasing/i)).toBeInTheDocument();
        expect(screen.getByText('-16.7%')).toBeInTheDocument();
      });
    });
  });

  describe('Charts and Visualizations', () => {
    it('renders violation trends chart', async () => {
      const { getViolationAnalytics, getViolationTrends, getViolationCategories } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });

      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', count: 25, category: 'minor' },
          { month: '2024-02', count: 30, category: 'minor' },
          { month: '2024-03', count: 35, category: 'minor' },
          { month: '2024-01', count: 5, category: 'major' },
          { month: '2024-02', count: 8, category: 'major' },
          { month: '2024-03', count: 10, category: 'major' }
        ]
      });

      getViolationCategories.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/violation trends/i)).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /trends chart/i })).toBeInTheDocument();
      });
    });

    it('renders category distribution chart', async () => {
      const { getViolationAnalytics, getViolationTrends, getViolationCategories } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });
      getViolationTrends.mockResolvedValue({ data: [] });

      getViolationCategories.mockResolvedValue({
        data: [
          { category: 'minor', count: 120, percentage: 80 },
          { category: 'major', count: 30, percentage: 20 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/category distribution/i)).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /distribution chart/i })).toBeInTheDocument();
        expect(screen.getByText('minor: 120 (80%)')).toBeInTheDocument();
        expect(screen.getByText('major: 30 (20%)')).toBeInTheDocument();
      });
    });

    it('renders violation types breakdown', async () => {
      const { getViolationAnalytics, getViolationTrends, getViolationCategories } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });
      getViolationTrends.mockResolvedValue({ data: [] });

      getViolationCategories.mockResolvedValue({
        data: [
          { violation_type: 'IMPROPER_UNIFORM', count: 35, category: 'minor' },
          { violation_type: 'LITTERING', count: 25, category: 'minor' },
          { violation_type: 'PORNOGRAPHIC_MATERIALS', count: 20, category: 'minor' },
          { violation_type: 'DRUGS_ALCOHOL_WEAPONS', count: 15, category: 'major' },
          { violation_type: 'ASSAULT_VERBAL_ABUSE', count: 10, category: 'major' }
        ]
      });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/violation types/i)).toBeInTheDocument();
        expect(screen.getByText('IMPROPER_UNIFORM')).toBeInTheDocument();
        expect(screen.getByText('35')).toBeInTheDocument();
        expect(screen.getByText('LITTERING')).toBeInTheDocument();
        expect(screen.getByText('25')).toBeInTheDocument();
      });
    });
  });

  describe('Date Range Filtering', () => {
    it('should filter analytics by date range', async () => {
      const { getViolationAnalytics, getViolationTrends, getViolationCategories } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({
        data: { totalViolations: 50, dateRange: '2024-01-01 to 2024-01-31' }
      });

      getViolationTrends.mockResolvedValue({ data: [] });
      getViolationCategories.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/from date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/to date/i)).toBeInTheDocument();
      });

      const fromDateInput = screen.getByLabelText(/from date/i);
      const toDateInput = screen.getByLabelText(/to date/i);

      await userEvent.type(fromDateInput, '2024-01-01');
      await userEvent.type(toDateInput, '2024-01-31');

      const applyButton = screen.getByRole('button', { name: /apply filters/i });
      await userEvent.click(applyButton);

      await waitFor(() => {
        expect(getViolationAnalytics).toHaveBeenCalledWith({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });
      });
    });

    it('should validate date range', async () => {
      const { getViolationAnalytics, getViolationTrends, getViolationCategories } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });
      getViolationTrends.mockResolvedValue({ data: [] });
      getViolationCategories.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      const fromDateInput = screen.getByLabelText(/from date/i);
      const toDateInput = screen.getByLabelText(/to date/i);

      await userEvent.type(fromDateInput, '2024-01-31');
      await userEvent.type(toDateInput, '2024-01-01'); // End date before start date

      const applyButton = screen.getByRole('button', { name: /apply filters/i });
      await userEvent.click(applyButton);

      await waitFor(() => {
        expect(screen.getByText(/end date must be after start date/i)).toBeInTheDocument();
      });
    });

    it('should support preset date ranges', async () => {
      const { getViolationAnalytics, getViolationTrends, getViolationCategories } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });
      getViolationTrends.mockResolvedValue({ data: [] });
      getViolationCategories.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /last 7 days/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /last 30 days/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /this month/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /last month/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /this year/i })).toBeInTheDocument();
      });

      const last30DaysButton = screen.getByRole('button', { name: /last 30 days/i });
      await userEvent.click(last30DaysButton);

      await waitFor(() => {
        expect(getViolationAnalytics).toHaveBeenCalledWith({
          presetRange: 'last30days'
        });
      });
    });
  });

  describe('Advanced Filtering', () => {
    it('should show advanced filter options', async () => {
      const { getAnalyticsFilters } = require('../../services/api');
      
      getAnalyticsFilters.mockResolvedValue({
        data: {
          violationTypes: [
            { id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' },
            { id: 2, code: 'LITTERING', description: 'Littering in campus areas' }
          ],
          categories: [
            { value: 'minor', label: 'Minor Violations' },
            { value: 'major', label: 'Major Violations' }
          ],
          courses: [
            { id: 1, name: 'Computer Science' },
            { id: 2, name: 'Psychology' }
          ],
          yearLevels: [
            { id: 1, name: '1st Year' },
            { id: 2, name: '2nd Year' }
          ]
        }
      });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /advanced filters/i })).toBeInTheDocument();
      });

      const advancedFiltersButton = screen.getByRole('button', { name: /advanced filters/i });
      await userEvent.click(advancedFiltersButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/violation type/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/course/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/year level/i)).toBeInTheDocument();
      });
    });

    it('should apply advanced filters', async () => {
      const { getViolationAnalytics, getAnalyticsFilters } = require('../../services/api');
      
      getAnalyticsFilters.mockResolvedValue({
        data: {
          violationTypes: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }],
          categories: [{ value: 'minor', label: 'Minor Violations' }],
          courses: [{ id: 1, name: 'Computer Science' }],
          yearLevels: [{ id: 1, name: '1st Year' }]
        }
      });

      getViolationAnalytics.mockResolvedValue({
        data: { totalViolations: 25 }
      });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      // Open advanced filters
      const advancedFiltersButton = screen.getByRole('button', { name: /advanced filters/i });
      await userEvent.click(advancedFiltersButton);

      // Apply filters
      await userEvent.selectOptions(screen.getByLabelText(/violation type/i), '1');
      await userEvent.selectOptions(screen.getByLabelText(/category/i), 'minor');
      await userEvent.selectOptions(screen.getByLabelText(/course/i), '1');
      await userEvent.selectOptions(screen.getByLabelText(/year level/i), '1');

      const applyButton = screen.getByRole('button', { name: /apply filters/i });
      await userEvent.click(applyButton);

      await waitFor(() => {
        expect(getViolationAnalytics).toHaveBeenCalledWith({
          violation_type_id: '1',
          category: 'minor',
          course_id: '1',
          year_level_id: '1'
        });
      });
    });

    it('should reset filters', async () => {
      const { getAnalyticsFilters } = require('../../services/api');
      
      getAnalyticsFilters.mockResolvedValue({
        data: {
          violationTypes: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }],
          categories: [{ value: 'minor', label: 'Minor Violations' }]
        }
      });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      // Open advanced filters
      const advancedFiltersButton = screen.getByRole('button', { name: /advanced filters/i });
      await userEvent.click(advancedFiltersButton);

      // Apply some filters
      await userEvent.selectOptions(screen.getByLabelText(/violation type/i), '1');
      await userEvent.selectOptions(screen.getByLabelText(/category/i), 'minor');

      // Reset filters
      const resetButton = screen.getByRole('button', { name: /reset filters/i });
      await userEvent.click(resetButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/violation type/i)).toHaveValue('');
        expect(screen.getByLabelText(/category/i)).toHaveValue('');
      });
    });
  });

  describe('Export Functionality', () => {
    it('should export analytics data', async () => {
      const { getViolationAnalytics, exportAnalyticsData } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });
      exportAnalyticsData.mockResolvedValue({
        data: { success: true, downloadUrl: '/api/downloads/analytics.xlsx' }
      });

      // Mock file download
      const mockLink = {
        click: jest.fn(),
        href: '',
        download: ''
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
      jest.spyOn(document.body, 'appendChild').mockImplementation();
      jest.spyOn(document.body, 'removeChild').mockImplementation();

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export data/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export data/i });
      await userEvent.click(exportButton);

      await waitFor(() => {
        expect(exportAnalyticsData).toHaveBeenCalled();
        expect(mockLink.click).toHaveBeenCalled();
      });
    });

    it('should show export format options', async () => {
      const { getViolationAnalytics } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export options/i })).toBeInTheDocument();
      });

      const exportOptionsButton = screen.getByRole('button', { name: /export options/i });
      await userEvent.click(exportOptionsButton);

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /excel/i })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /csv/i })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /pdf/i })).toBeInTheDocument();
      });
    });

    it('should export filtered data', async () => {
      const { getViolationAnalytics, exportAnalyticsData } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({
        data: { totalViolations: 25, filters: { category: 'minor' } }
      });

      exportAnalyticsData.mockResolvedValue({
        data: { success: true, downloadUrl: '/api/downloads/analytics_filtered.xlsx' }
      });

      const mockLink = { click: jest.fn() };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
      jest.spyOn(document.body, 'appendChild').mockImplementation();
      jest.spyOn(document.body, 'removeChild').mockImplementation();

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      const exportButton = screen.getByRole('button', { name: /export data/i });
      await userEvent.click(exportButton);

      await waitFor(() => {
        expect(exportAnalyticsData).toHaveBeenCalledWith({
          format: 'excel',
          filters: { category: 'minor' }
        });
      });
    });
  });

  describe('Student Violations', () => {
    it('should display student violations table', async () => {
      const { getViolationAnalytics, getStudentViolations } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });

      getStudentViolations.mockResolvedValue({
        data: [
          {
            id: 1,
            student_name: 'John Doe',
            student_id: '2024-001',
            total_violations: 3,
            category_breakdown: {
              minor: 2,
              major: 1
            },
            last_violation: '2024-01-15T10:30:00Z',
            status: 'active'
          },
          {
            id: 2,
            student_name: 'Jane Smith',
            student_id: '2024-002',
            total_violations: 1,
            category_breakdown: {
              minor: 1,
              major: 0
            },
            last_violation: '2024-01-10T14:20:00Z',
            status: 'active'
          }
        ]
      });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/student violations/i)).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('2024-001')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('2024-002')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('should search student violations', async () => {
      const { getViolationAnalytics, getStudentViolations } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });

      getStudentViolations.mockResolvedValue({
        data: [
          {
            id: 1,
            student_name: 'John Doe',
            student_id: '2024-001',
            total_violations: 3
          }
        ]
      });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/search students/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/search students/i);
      await userEvent.type(searchInput, 'John');

      await waitFor(() => {
        expect(getStudentViolations).toHaveBeenCalledWith({ search: 'John' });
      });
    });

    it('should sort student violations', async () => {
      const { getViolationAnalytics, getStudentViolations } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });

      getStudentViolations.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sort by total violations/i })).toBeInTheDocument();
      });

      const sortButton = screen.getByRole('button', { name: /sort by total violations/i });
      await userEvent.click(sortButton);

      await waitFor(() => {
        expect(getStudentViolations).toHaveBeenCalledWith({ sortBy: 'total_violations', sortOrder: 'desc' });
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should refresh data automatically', async () => {
      const { getViolationAnalytics } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({
        data: { totalViolations: 150 }
      });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getViolationAnalytics).toHaveBeenCalledTimes(1);
      });

      // Simulate auto-refresh
      jest.advanceTimersByTime(60000); // 1 minute

      await waitFor(() => {
        expect(getViolationAnalytics).toHaveBeenCalledTimes(2);
      });
    });

    it('should allow manual refresh', async () => {
      const { getViolationAnalytics } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({
        data: { totalViolations: 150 }
      });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh data/i })).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh data/i });
      await userEvent.click(refreshButton);

      await waitFor(() => {
        expect(getViolationAnalytics).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back to dashboard', async () => {
      const { getViolationAnalytics } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      await userEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should navigate to detailed reports', async () => {
      const { getViolationAnalytics } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /view detailed reports/i })).toBeInTheDocument();
      });

      const reportsLink = screen.getByRole('link', { name: /view detailed reports/i });
      await userEvent.click(reportsLink);

      expect(mockNavigate).toHaveBeenCalledWith('/reports');
    });
  });

  describe('Error Handling', () => {
    it('should handle chart rendering errors', async () => {
      const { getViolationAnalytics, getViolationTrends } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });

      getViolationTrends.mockRejectedValue(new Error('Chart rendering failed'));

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/chart unavailable/i)).toBeInTheDocument();
        expect(screen.getByText(/unable to load trends chart/i)).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      const { getViolationAnalytics } = require('../../services/api');
      
      getViolationAnalytics
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { totalViolations: 150 } });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const { getViolationAnalytics } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Violation Analytics Dashboard');
        expect(screen.getByRole('region', { name: /analytics summary/i })).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      const { getViolationAnalytics } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        const filterButton = screen.getByRole('button', { name: /advanced filters/i });
        filterButton.focus();
        expect(filterButton).toHaveFocus();

        userEvent.tab();
        expect(screen.getByRole('button', { name: /export data/i })).toHaveFocus();
      });
    });

    it('should announce data updates to screen readers', async () => {
      const { getViolationAnalytics } = require('../../services/api');
      
      getViolationAnalytics.mockResolvedValue({
        data: { totalViolations: 150 }
      });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        const totalViolations = screen.getByText('150');
        expect(totalViolations).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      // Set mobile viewport
      window.innerWidth = 375;
      window.innerHeight = 667;
      window.dispatchEvent(new Event('resize'));

      const { getViolationAnalytics } = require('../../services/api');
      getViolationAnalytics.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      expect(screen.getByText(/violation analytics/i)).toBeInTheDocument();
      // Should be mobile-friendly
      expect(screen.getByRole('main')).toHaveClass('mobile-analytics');
    });

    it('should collapse charts on mobile', async () => {
      // Set mobile viewport
      window.innerWidth = 768;
      window.dispatchEvent(new Event('resize'));

      const { getViolationAnalytics } = require('../../services/api');
      getViolationAnalytics.mockResolvedValue({ data: {} });

      render(
        <TestWrapper>
          <ViolationAnalytics />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /toggle charts/i })).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /toggle charts/i });
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('region', { name: /charts/i })).toHaveClass('collapsed');
      });
    });
  });
});
