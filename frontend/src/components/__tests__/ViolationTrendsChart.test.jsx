import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ViolationTrendsChart from '../ViolationTrendsChart';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock Chart.js or other charting library
jest.mock('react-chartjs-2', () => ({
  Line: ({ data, options }) => (
    <div data-testid="line-chart">
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      <div data-testid="chart-options">{JSON.stringify(options)}</div>
    </div>
  ),
  Bar: ({ data, options }) => (
    <div data-testid="bar-chart">
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      <div data-testid="chart-options">{JSON.stringify(options)}</div>
    </div>
  ),
}));

// Mock the API
jest.mock('../../services/api', () => ({
  getViolationTrends: jest.fn(),
  getViolationTrendsByCategory: jest.fn(),
  getViolationTrendsByType: jest.fn(),
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

describe('ViolationTrendsChart Component', () => {
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
    it('renders violation trends chart correctly', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', minor: 25, major: 5, total: 30 },
          { month: '2024-02', minor: 30, major: 8, total: 38 },
          { month: '2024-03', minor: 35, major: 10, total: 45 },
          { month: '2024-04', minor: 28, major: 7, total: 35 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/violation trends/i)).toBeInTheDocument();
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      expect(screen.getByText(/loading trends/i)).toBeInTheDocument();
    });

    it('displays error message when data loading fails', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockRejectedValue(new Error('Failed to load trends data'));

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load trends/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('displays empty state when no data available', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/no trend data available/i)).toBeInTheDocument();
        expect(screen.getByText(/no violations recorded in the selected period/i)).toBeInTheDocument();
      });
    });
  });

  describe('Chart Types', () => {
    it('should switch between line and bar charts', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', minor: 25, major: 5, total: 30 },
          { month: '2024-02', minor: 30, major: 8, total: 38 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /bar chart/i })).toBeInTheDocument();
      });

      const barChartButton = screen.getByRole('button', { name: /bar chart/i });
      await userEvent.click(barChartButton);

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /line chart/i })).toBeInTheDocument();
      });
    });

    it('should display stacked charts for category comparison', async () => {
      const { getViolationTrendsByCategory } = require('../../services/api');
      
      getViolationTrendsByCategory.mockResolvedValue({
        data: [
          { month: '2024-01', minor: 25, major: 5 },
          { month: '2024-02', minor: 30, major: 8 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart chartType="stacked" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.getByText(/stacked view/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    it('should display trend statistics', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', minor: 25, major: 5, total: 30 },
          { month: '2024-02', minor: 30, major: 8, total: 38 },
          { month: '2024-03', minor: 35, major: 10, total: 45 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/total violations/i)).toBeInTheDocument();
        expect(screen.getByText('113')).toBeInTheDocument(); // Sum of totals
        expect(screen.getByText(/average per month/i)).toBeInTheDocument();
        expect(screen.getByText('37.7')).toBeInTheDocument(); // Average
        expect(screen.getByText(/peak month/i)).toBeInTheDocument();
        expect(screen.getByText('2024-03')).toBeInTheDocument();
      });
    });

    it('should show trend indicators', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', total: 30 },
          { month: '2024-02', total: 38 },
          { month: '2024-03', total: 45 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/trend/i)).toBeInTheDocument();
        expect(screen.getByText(/increasing/i)).toBeInTheDocument();
        expect(screen.getByText(/\+50%/)).toBeInTheDocument(); // 50% increase from first to last
      });
    });

    it('should display category breakdown', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', minor: 25, major: 5, total: 30 },
          { month: '2024-02', minor: 30, major: 8, total: 38 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/category breakdown/i)).toBeInTheDocument();
        expect(screen.getByText(/minor violations/i)).toBeInTheDocument();
        expect(screen.getByText('55')).toBeInTheDocument(); // 25 + 30
        expect(screen.getByText(/major violations/i)).toBeInTheDocument();
        expect(screen.getByText('13')).toBeInTheDocument(); // 5 + 8
      });
    });
  });

  describe('Time Period Selection', () => {
    it('should allow selecting different time periods', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', total: 30 },
          { month: '2024-02', total: 38 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /last 3 months/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /last 6 months/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /last year/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /custom range/i })).toBeInTheDocument();
      });

      const last6MonthsButton = screen.getByRole('button', { name: /last 6 months/i });
      await userEvent.click(last6MonthsButton);

      await waitFor(() => {
        expect(getViolationTrends).toHaveBeenCalledWith({ period: '6months' });
      });
    });

    it('should handle custom date range selection', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        const customRangeButton = screen.getByRole('button', { name: /custom range/i });
        userEvent.click(customRangeButton);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
      });

      const startDateInput = screen.getByLabelText(/start date/i);
      const endDateInput = screen.getByLabelText(/end date/i);

      await userEvent.type(startDateInput, '2024-01-01');
      await userEvent.type(endDateInput, '2024-03-31');

      const applyButton = screen.getByRole('button', { name: /apply range/i });
      await userEvent.click(applyButton);

      await waitFor(() => {
        expect(getViolationTrends).toHaveBeenCalledWith({
          startDate: '2024-01-01',
          endDate: '2024-03-31'
        });
      });
    });

    it('should validate custom date range', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      // Open custom range
      const customRangeButton = screen.getByRole('button', { name: /custom range/i });
      await userEvent.click(customRangeButton);

      // Enter invalid date range
      const startDateInput = screen.getByLabelText(/start date/i);
      const endDateInput = screen.getByLabelText(/end date/i);

      await userEvent.type(startDateInput, '2024-03-31');
      await userEvent.type(endDateInput, '2024-01-01'); // End before start

      const applyButton = screen.getByRole('button', { name: /apply range/i });
      await userEvent.click(applyButton);

      await waitFor(() => {
        expect(screen.getByText(/end date must be after start date/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering Options', () => {
    it('should filter by violation category', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', minor: 25, major: 5 },
          { month: '2024-02', minor: 30, major: 8 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/filter by category/i)).toBeInTheDocument();
      });

      const categoryFilter = screen.getByLabelText(/filter by category/i);
      await userEvent.selectOptions(categoryFilter, 'minor');

      await waitFor(() => {
        expect(getViolationTrends).toHaveBeenCalledWith({ category: 'minor' });
      });
    });

    it('should filter by violation type', async () => {
      const { getViolationTrendsByType } = require('../../services/api');
      
      getViolationTrendsByType.mockResolvedValue({
        data: [
          { month: '2024-01', count: 15, type: 'IMPROPER_UNIFORM' },
          { month: '2024-02', count: 18, type: 'IMPROPER_UNIFORM' }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart filterBy="type" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/filter by violation type/i)).toBeInTheDocument();
      });

      const typeFilter = screen.getByLabelText(/filter by violation type/i);
      await userEvent.selectOptions(typeFilter, 'IMPROPER_UNIFORM');

      await waitFor(() => {
        expect(getViolationTrendsByType).toHaveBeenCalledWith({ violationType: 'IMPROPER_UNIFORM' });
      });
    });

    it('should filter by course or year level', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/filter by course/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/filter by year level/i)).toBeInTheDocument();
      });

      const courseFilter = screen.getByLabelText(/filter by course/i);
      const yearLevelFilter = screen.getByLabelText(/filter by year level/i);

      await userEvent.selectOptions(courseFilter, '1');
      await userEvent.selectOptions(yearLevelFilter, '1');

      const applyButton = screen.getByRole('button', { name: /apply filters/i });
      await userEvent.click(applyButton);

      await waitFor(() => {
        expect(getViolationTrends).toHaveBeenCalledWith({
          courseId: '1',
          yearLevelId: '1'
        });
      });
    });
  });

  describe('Chart Interactions', () => {
    it('should show tooltips on hover', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', minor: 25, major: 5, total: 30 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        const chartElement = screen.getByTestId('line-chart');
        userEvent.hover(chartElement);
      });

      await waitFor(() => {
        expect(screen.getByText(/2024-01/i)).toBeInTheDocument();
        expect(screen.getByText(/total: 30/i)).toBeInTheDocument();
        expect(screen.getByText(/minor: 25/i)).toBeInTheDocument();
        expect(screen.getByText(/major: 5/i)).toBeInTheDocument();
      });
    });

    it('should allow clicking on data points for details', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', minor: 25, major: 5, total: 30 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        const chartElement = screen.getByTestId('line-chart');
        userEvent.click(chartElement);
      });

      await waitFor(() => {
        expect(screen.getByText(/detailed view/i)).toBeInTheDocument();
        expect(screen.getByText(/january 2024/i)).toBeInTheDocument();
        expect(screen.getByText(/30 total violations/i)).toBeInTheDocument();
      });
    });

    it('should support zoom functionality', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: Array(12).fill().map((_, i) => ({
          month: `2024-${String(i + 1).padStart(2, '0')}`,
          total: Math.floor(Math.random() * 50) + 10
        }))
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reset zoom/i })).toBeInTheDocument();
      });

      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      await userEvent.click(zoomInButton);

      await waitFor(() => {
        expect(screen.getByText(/zoomed view/i)).toBeInTheDocument();
      });
    });
  });

  describe('Export Functionality', () => {
    it('should export chart as image', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', total: 30 },
          { month: '2024-02', total: 38 }
        ]
      });

      // Mock canvas export
      const mockCanvas = {
        toDataURL: jest.fn().mockReturnValue('data:image/png;base64,mockdata')
      };
      HTMLCanvasElement.prototype.toDataURL = mockCanvas.toDataURL;

      // Mock download
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
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export chart/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export chart/i });
      await userEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export as png/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /export as jpg/i })).toBeInTheDocument();
      });

      const exportPngButton = screen.getByRole('button', { name: /export as png/i });
      await userEvent.click(exportPngButton);

      await waitFor(() => {
        expect(mockLink.click).toHaveBeenCalled();
        expect(mockLink.download).toContain('violation_trends');
      });
    });

    it('should export chart data as CSV', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', minor: 25, major: 5, total: 30 },
          { month: '2024-02', minor: 30, major: 8, total: 38 }
        ]
      });

      const mockLink = { click: jest.fn() };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
      jest.spyOn(document.body, 'appendChild').mockImplementation();
      jest.spyOn(document.body, 'removeChild').mockImplementation();

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export data/i });
        userEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export as csv/i })).toBeInTheDocument();
      });

      const exportCsvButton = screen.getByRole('button', { name: /export as csv/i });
      await userEvent.click(exportCsvButton);

      await waitFor(() => {
        expect(mockLink.click).toHaveBeenCalled();
        expect(mockLink.download).toContain('violation_trends_data');
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      // Set mobile viewport
      window.innerWidth = 375;
      window.innerHeight = 667;
      window.dispatchEvent(new Event('resize'));

      const { getViolationTrends } = require('../../services/api');
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', total: 30 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /toggle chart size/i })).toBeInTheDocument();
      });

      const toggleSizeButton = screen.getByRole('button', { name: /toggle chart size/i });
      await userEvent.click(toggleSizeButton);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toHaveClass('mobile-fullscreen');
      });
    });

    it('should hide legend on small screens', async () => {
      // Set small viewport
      window.innerWidth = 320;
      window.dispatchEvent(new Event('resize'));

      const { getViolationTrends } = require('../../services/api');
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', total: 30 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText(/legend/i)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /show legend/i })).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle chart rendering errors gracefully', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', total: 30 }
        ]
      });

      // Mock chart error
      const originalConsoleError = console.error;
      console.error = jest.fn();

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      // Simulate chart error
      fireEvent.error(screen.getByTestId('line-chart'));

      await waitFor(() => {
        expect(screen.getByText(/chart rendering error/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      console.error = originalConsoleError;
    });

    it('should allow retry after error', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: [
            { month: '2024-01', total: 30 }
          ]
        });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', total: 30 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Violation Trends Chart');
        expect(screen.getByTestId('line-chart')).toHaveAttribute('role', 'img');
        expect(screen.getByTestId('line-chart')).toHaveAttribute('aria-label', 'Line chart showing violation trends over time');
      });
    });

    it('should support keyboard navigation', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', total: 30 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        const chartElement = screen.getByTestId('line-chart');
        chartElement.focus();
        expect(chartElement).toHaveFocus();

        userEvent.tab();
        expect(screen.getByRole('button', { name: /export chart/i })).toHaveFocus();
      });
    });

    it('should announce chart updates to screen readers', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', total: 30 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        const statusRegion = screen.getByRole('status');
        expect(statusRegion).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      // Mock large dataset (5 years of monthly data)
      const largeDataset = Array(60).fill().map((_, i) => ({
        month: new Date(2019, i % 12, 1).toISOString().slice(0, 7),
        minor: Math.floor(Math.random() * 50) + 10,
        major: Math.floor(Math.random() * 20) + 1,
        total: 0
      })).map(item => ({ ...item, total: item.minor + item.major }));

      getViolationTrends.mockResolvedValue({
        data: largeDataset
      });

      const startTime = Date.now();

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      // Should render within 2 seconds
      expect(renderTime).toBeLessThan(2000);
    });

    it('should debounce rapid filter changes', async () => {
      const { getViolationTrends } = require('../../services/api');
      
      getViolationTrends.mockResolvedValue({
        data: [
          { month: '2024-01', total: 30 }
        ]
      });

      render(
        <TestWrapper>
          <ViolationTrendsChart />
        </TestWrapper>
      );

      await waitFor(() => {
        const categoryFilter = screen.getByLabelText(/filter by category/i);
        
        // Rapidly change filters
        userEvent.selectOptions(categoryFilter, 'minor');
        userEvent.selectOptions(categoryFilter, 'major');
        userEvent.selectOptions(categoryFilter, 'all');
      });

      // Should only make one API call due to debouncing
      await waitFor(() => {
        expect(getViolationTrends).toHaveBeenCalledTimes(2); // Initial load + debounced call
      });
    });
  });
});
