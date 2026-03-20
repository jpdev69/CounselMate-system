import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { SlipsProvider, useSlips } from '../contexts/SlipsContext';

// Mock the API
jest.mock('../services/api', () => ({
  getAdmissionSlips: jest.fn(),
  createAdmissionSlip: jest.fn(),
  updateAdmissionSlip: jest.fn(),
  deleteAdmissionSlip: jest.fn(),
  getAdmissionSlipById: jest.fn(),
  exportSlips: jest.fn(),
}));

// Test component that uses the slips context
const TestComponent = () => {
  const { 
    slips, 
    loading, 
    error, 
    fetchSlips, 
    createSlip, 
    updateSlip, 
    deleteSlip, 
    getSlipById,
    exportSlips,
    filteredSlips,
    setFilters,
    filters
  } = useSlips();

  if (loading) return <div>Loading slips...</div>;

  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <div data-testid="slips-count">{slips.length}</div>
      <div data-testid="filtered-slips-count">{filteredSlips.length}</div>
      <button onClick={() => fetchSlips()}>Fetch Slips</button>
      <button onClick={() => createSlip({ student_name: 'Test Student' })}>
        Create Slip
      </button>
      <button onClick={() => updateSlip(1, { status: 'updated' })}>
        Update Slip
      </button>
      <button onClick={() => deleteSlip(1)}>Delete Slip</button>
      <button onClick={() => getSlipById(1)}>Get Slip by ID</button>
      <button onClick={() => exportSlips()}>Export Slips</button>
      <button onClick={() => setFilters({ status: 'printed' })}>
        Set Filter
      </button>
      <div data-testid="filters">{JSON.stringify(filters)}</div>
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

describe('SlipsContext', () => {
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

  describe('Context Provider', () => {
    it('should provide slips context to children', () => {
      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      expect(screen.getByTestId('slips-count')).toHaveTextContent('0');
      expect(screen.getByTestId('filtered-slips-count')).toHaveTextContent('0');
      expect(screen.getByTestId('filters')).toHaveTextContent('{}');
    });

    it('should initialize with loading state', () => {
      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      expect(screen.getByText('Loading slips...')).toBeInTheDocument();
    });

    it('should restore slips from sessionStorage', async () => {
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'authToken') return 'mock-token';
        if (key === 'userData') return JSON.stringify({
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'counselor'
        });
        if (key === 'cachedSlips') return JSON.stringify([
          { id: 1, student_name: 'Cached Student', status: 'printed' }
        ]);
        return null;
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('slips-count')).toHaveTextContent('1');
        expect(screen.getByText('Cached Student')).toBeInTheDocument();
      });
    });
  });

  describe('Fetch Slips', () => {
    it('should fetch slips successfully', async () => {
      const { getAdmissionSlips } = require('../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [
          { id: 1, student_name: 'John Doe', status: 'printed' },
          { id: 2, student_name: 'Jane Smith', status: 'draft' }
        ]
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const fetchButton = screen.getByText('Fetch Slips');
      await userEvent.click(fetchButton);

      await waitFor(() => {
        expect(getAdmissionSlips).toHaveBeenCalled();
        expect(screen.getByTestId('slips-count')).toHaveTextContent('2');
        expect(screen.getByTestId('filtered-slips-count')).toHaveTextContent('2');
      });
    });

    it('should handle fetch errors', async () => {
      const { getAdmissionSlips } = require('../services/api');
      
      getAdmissionSlips.mockRejectedValue({
        response: { data: { error: 'Failed to fetch slips' } }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const fetchButton = screen.getByText('Fetch Slips');
      await userEvent.click(fetchButton);

      await waitFor(() => {
        expect(screen.getByText('Error: Failed to fetch slips')).toBeInTheDocument();
      });
    });

    it('should cache fetched slips', async () => {
      const { getAdmissionSlips } = require('../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [
          { id: 1, student_name: 'John Doe', status: 'printed' }
        ]
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const fetchButton = screen.getByText('Fetch Slips');
      await userEvent.click(fetchButton);

      await waitFor(() => {
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
          'cachedSlips',
          JSON.stringify([{ id: 1, student_name: 'John Doe', status: 'printed' }])
        );
      });
    });
  });

  describe('Create Slip', () => {
    it('should create slip successfully', async () => {
      const { createAdmissionSlip } = require('../services/api');
      
      createAdmissionSlip.mockResolvedValue({
        data: {
          success: true,
          slip: { id: 3, student_name: 'Test Student', status: 'draft' }
        }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const createButton = screen.getByText('Create Slip');
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(createAdmissionSlip).toHaveBeenCalledWith({
          student_name: 'Test Student'
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('slips-count')).toHaveTextContent('1');
        expect(screen.getByText('Test Student')).toBeInTheDocument();
      });
    });

    it('should handle create errors', async () => {
      const { createAdmissionSlip } = require('../services/api');
      
      createAdmissionSlip.mockRejectedValue({
        response: { data: { error: 'Failed to create slip' } }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const createButton = screen.getByText('Create Slip');
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Error: Failed to create slip')).toBeInTheDocument();
      });
    });

    it('should validate slip data before creation', async () => {
      const { createAdmissionSlip } = require('../services/api');
      
      createAdmissionSlip.mockResolvedValue({
        data: { success: true, slip: {} }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const createButton = screen.getByText('Create Slip');
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(createAdmissionSlip).toHaveBeenCalledWith({
          student_name: 'Test Student'
        });
      });
    });
  });

  describe('Update Slip', () => {
    it('should update slip successfully', async () => {
      const { updateAdmissionSlip, getAdmissionSlips } = require('../services/api');
      
      // Start with existing slips
      getAdmissionSlips.mockResolvedValue({
        data: [
          { id: 1, student_name: 'John Doe', status: 'draft' }
        ]
      });

      updateAdmissionSlip.mockResolvedValue({
        data: {
          success: true,
          slip: { id: 1, student_name: 'John Doe', status: 'updated' }
        }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('slips-count')).toHaveTextContent('1');
      });

      const updateButton = screen.getByText('Update Slip');
      await userEvent.click(updateButton);

      await waitFor(() => {
        expect(updateAdmissionSlip).toHaveBeenCalledWith(1, { status: 'updated' });
      });

      await waitFor(() => {
        expect(screen.getByTestId('slips-count')).toHaveTextContent('1');
        // The slip should be updated in the state
      });
    });

    it('should handle update errors', async () => {
      const { updateAdmissionSlip } = require('../services/api');
      
      updateAdmissionSlip.mockRejectedValue({
        response: { data: { error: 'Failed to update slip' } }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const updateButton = screen.getByText('Update Slip');
      await userEvent.click(updateButton);

      await waitFor(() => {
        expect(screen.getByText('Error: Failed to update slip')).toBeInTheDocument();
      });
    });

    it('should handle non-existent slip update', async () => {
      const { updateAdmissionSlip } = require('../services/api');
      
      updateAdmissionSlip.mockRejectedValue({
        response: { data: { error: 'Slip not found' } }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const updateButton = screen.getByText('Update Slip');
      await userEvent.click(updateButton);

      await waitFor(() => {
        expect(screen.getByText('Error: Slip not found')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Slip', () => {
    it('should delete slip successfully', async () => {
      const { deleteAdmissionSlip, getAdmissionSlips } = require('../services/api');
      
      // Start with existing slips
      getAdmissionSlips.mockResolvedValue({
        data: [
          { id: 1, student_name: 'John Doe', status: 'draft' },
          { id: 2, student_name: 'Jane Smith', status: 'draft' }
        ]
      });

      deleteAdmissionSlip.mockResolvedValue({
        data: { success: true }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('slips-count')).toHaveTextContent('2');
      });

      const deleteButton = screen.getByText('Delete Slip');
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(deleteAdmissionSlip).toHaveBeenCalledWith(1);
      });

      await waitFor(() => {
        expect(screen.getByTestId('slips-count')).toHaveTextContent('1');
      });
    });

    it('should handle delete errors', async () => {
      const { deleteAdmissionSlip } = require('../services/api');
      
      deleteAdmissionSlip.mockRejectedValue({
        response: { data: { error: 'Failed to delete slip' } }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const deleteButton = screen.getByText('Delete Slip');
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Error: Failed to delete slip')).toBeInTheDocument();
      });
    });

    it('should handle non-existent slip deletion', async () => {
      const { deleteAdmissionSlip } = require('../services/api');
      
      deleteAdmissionSlip.mockRejectedValue({
        response: { data: { error: 'Slip not found' } }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const deleteButton = screen.getByText('Delete Slip');
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Error: Slip not found')).toBeInTheDocument();
      });
    });
  });

  describe('Get Slip by ID', () => {
    it('should get slip by ID successfully', async () => {
      const { getAdmissionSlipById } = require('../services/api');
      
      getAdmissionSlipById.mockResolvedValue({
        data: {
          id: 1,
          student_name: 'John Doe',
          status: 'printed',
          violation_type: 'IMPROPER_UNIFORM'
        }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const getButton = screen.getByText('Get Slip by ID');
      await userEvent.click(getButton);

      await waitFor(() => {
        expect(getAdmissionSlipById).toHaveBeenCalledWith(1);
      });
    });

    it('should handle get by ID errors', async () => {
      const { getAdmissionSlipById } = require('../services/api');
      
      getAdmissionSlipById.mockRejectedValue({
        response: { data: { error: 'Slip not found' } }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const getButton = screen.getByText('Get Slip by ID');
      await userEvent.click(getButton);

      await waitFor(() => {
        expect(screen.getByText('Error: Slip not found')).toBeInTheDocument();
      });
    });
  });

  describe('Export Slips', () => {
    it('should export slips successfully', async () => {
      const { exportSlips } = require('../services/api');
      
      exportSlips.mockResolvedValue({
        data: { success: true, downloadUrl: '/api/downloads/slips.xlsx' }
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
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const exportButton = screen.getByText('Export Slips');
      await userEvent.click(exportButton);

      await waitFor(() => {
        expect(exportSlips).toHaveBeenCalled();
        expect(mockLink.click).toHaveBeenCalled();
      });
    });

    it('should handle export errors', async () => {
      const { exportSlips } = require('../services/api');
      
      exportSlips.mockRejectedValue({
        response: { data: { error: 'Failed to export slips' } }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const exportButton = screen.getByText('Export Slips');
      await userEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Error: Failed to export slips')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('should set filters', async () => {
      const { getAdmissionSlips } = require('../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [
          { id: 1, student_name: 'John Doe', status: 'printed' },
          { id: 2, student_name: 'Jane Smith', status: 'draft' }
        ]
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('slips-count')).toHaveTextContent('2');
      });

      const filterButton = screen.getByText('Set Filter');
      await userEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByTestId('filters')).toHaveTextContent('{"status":"printed"}');
        expect(screen.getByTestId('filtered-slips-count')).toHaveTextContent('1');
      });
    });

    it('should clear filters', async () => {
      const { getAdmissionSlips } = require('../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [
          { id: 1, student_name: 'John Doe', status: 'printed' },
          { id: 2, student_name: 'Jane Smith', status: 'draft' }
        ]
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('slips-count')).toHaveTextContent('2');
      });

      // Set filter
      const filterButton = screen.getByText('Set Filter');
      await userEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByTestId('filtered-slips-count')).toHaveTextContent('1');
      });

      // Clear filter
      const clearFiltersButton = screen.getByText('Clear Filters');
      if (clearFiltersButton) {
        await userEvent.click(clearFiltersButton);

        await waitFor(() => {
          expect(screen.getByTestId('filters')).toHaveTextContent('{}');
          expect(screen.getByTestId('filtered-slips-count')).toHaveTextContent('2');
        });
      }
    });

    it('should apply multiple filters', async () => {
      const { getAdmissionSlips } = require('../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [
          { id: 1, student_name: 'John Doe', status: 'printed', course: 'CS' },
          { id: 2, student_name: 'Jane Smith', status: 'draft', course: 'PS' },
          { id: 3, student_name: 'Bob Johnson', status: 'printed', course: 'CS' }
        ]
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      // Set multiple filters
      const setFilters = screen.getByText('Set Filter').onclick;
      setFilters({ status: 'printed', course: 'CS' });

      await waitFor(() => {
        expect(screen.getByTestId('filtered-slips-count')).toHaveTextContent('2');
      });
    });
  });

  describe('Context Hooks', () => {
    it('should throw error when useSlips is used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useSlips must be used within a SlipsProvider');

      consoleError.mockRestore();
    });

    it('should provide correct context values', async () => {
      let contextValues;

      const ContextChecker = () => {
        const slips = useSlips();
        contextValues = slips;
        return <div>Context checked</div>;
      };

      render(
        <BrowserRouter>
          <SlipsProvider>
            <ContextChecker />
          </SlipsProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(Array.isArray(contextValues.slips)).toBe(true);
        expect(typeof contextValues.loading).toBe('boolean');
        expect(typeof contextValues.fetchSlips).toBe('function');
        expect(typeof contextValues.createSlip).toBe('function');
        expect(typeof contextValues.updateSlip).toBe('function');
        expect(typeof contextValues.deleteSlip).toBe('function');
        expect(typeof contextValues.getSlipById).toBe('function');
        expect(typeof contextValues.exportSlips).toBe('function');
        expect(typeof contextValues.setFilters).toBe('function');
        expect(Array.isArray(contextValues.filteredSlips)).toBe(true);
        expect(typeof contextValues.filters).toBe('object');
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

      const { rerender } = render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponentWithCounter />
          </SlipsProvider>
        </BrowserRouter>
      );

      // Initial render
      expect(renderCount).toBe(1);

      // Re-render with same props
      rerender(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponentWithCounter />
          </SlipsProvider>
        </BrowserRouter>
      );

      // Should not re-render children unnecessarily
      expect(renderCount).toBe(1);
    });

    it('should handle large datasets efficiently', async () => {
      const { getAdmissionSlips } = require('../services/api');
      
      // Mock large dataset
      const largeDataset = Array(1000).fill().map((_, i) => ({
        id: i + 1,
        student_name: `Student ${i + 1}`,
        status: i % 2 === 0 ? 'printed' : 'draft'
      }));

      getAdmissionSlips.mockResolvedValue({
        data: largeDataset
      });

      const startTime = performance.now();

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('slips-count')).toHaveTextContent('1000');
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within 1 second
      expect(renderTime).toBeLessThan(1000);
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted cached data', async () => {
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'authToken') return 'mock-token';
        if (key === 'userData') return JSON.stringify({
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'counselor'
        });
        if (key === 'cachedSlips') return 'invalid-json'; // Corrupted data
        return null;
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('slips-count')).toHaveTextContent('0');
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('cachedSlips');
      });
    });

    it('should handle network errors gracefully', async () => {
      const { getAdmissionSlips } = require('../services/api');
      
      getAdmissionSlips.mockRejectedValue(new Error('Network error'));

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const fetchButton = screen.getByText('Fetch Slips');
      await userEvent.click(fetchButton);

      await waitFor(() => {
        expect(screen.getByText('Error: Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should update state when slips are modified', async () => {
      const { getAdmissionSlips, createAdmissionSlip } = require('../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: []
      });

      createAdmissionSlip.mockResolvedValue({
        data: {
          success: true,
          slip: { id: 1, student_name: 'New Student', status: 'draft' }
        }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('slips-count')).toHaveTextContent('0');
      });

      const createButton = screen.getByText('Create Slip');
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByTestId('slips-count')).toHaveTextContent('1');
      });
    });

    it('should maintain filter state during updates', async () => {
      const { getAdmissionSlips, updateAdmissionSlip } = require('../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [
          { id: 1, student_name: 'John Doe', status: 'draft' }
        ]
      });

      updateAdmissionSlip.mockResolvedValue({
        data: {
          success: true,
          slip: { id: 1, student_name: 'John Doe', status: 'printed' }
        }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('slips-count')).toHaveTextContent('1');
      });

      // Set filter
      const filterButton = screen.getByText('Set Filter');
      await userEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByTestId('filtered-slips-count')).toHaveTextContent('1');
      });

      // Update slip
      const updateButton = screen.getByText('Update Slip');
      await userEvent.click(updateButton);

      await waitFor(() => {
        // Filter should still be applied
        expect(screen.getByTestId('filtered-slips-count')).toHaveTextContent('1');
      });
    });
  });

  describe('Data Validation', () => {
    it('should validate slip data structure', async () => {
      const { createAdmissionSlip } = require('../services/api');
      
      createAdmissionSlip.mockResolvedValue({
        data: {
          success: true,
          slip: { id: 1, student_name: 'Valid Student' }
        }
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const createButton = screen.getByText('Create Slip');
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByTestId('slips-count')).toHaveTextContent('1');
      });
    });

    it('should handle invalid API responses', async () => {
      const { getAdmissionSlips } = require('../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: null // Invalid response
      });

      render(
        <BrowserRouter>
          <SlipsProvider>
            <TestComponent />
          </SlipsProvider>
        </BrowserRouter>
      );

      const fetchButton = screen.getByText('Fetch Slips');
      await userEvent.click(fetchButton);

      await waitFor(() => {
        expect(screen.getByText('Error: Invalid response from server')).toBeInTheDocument();
      });
    });
  });
});
