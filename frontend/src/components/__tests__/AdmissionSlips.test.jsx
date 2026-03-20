import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AdmissionSlips from '../AdmissionSlips';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  getAdmissionSlips: jest.fn(),
  getAdmissionSlipById: jest.fn(),
  updateAdmissionSlip: jest.fn(),
  deleteAdmissionSlip: jest.fn(),
  printAdmissionSlip: jest.fn(),
  getStudents: jest.fn(),
  getCourses: jest.fn(),
  getYearLevels: jest.fn(),
  getSections: jest.fn(),
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

describe('AdmissionSlips Component', () => {
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
    it('renders admission slips list correctly', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      const mockSlips = [
        {
          id: 1,
          slip_number: 'AS-2024-001',
          student_name: 'John Doe',
          student_id: '2024-001',
          course: 'Bachelor of Science in Computer Science',
          year: '1st Year',
          section: 'A',
          violation_type: 'IMPROPER_UNIFORM',
          violation_description: 'Student came without proper uniform',
          remarks: 'First offense',
          status: 'printed',
          created_at: '2024-01-15T08:30:00Z',
          updated_at: '2024-01-15T08:30:00Z'
        },
        {
          id: 2,
          slip_number: 'AS-2024-002',
          student_name: 'Jane Smith',
          student_id: '2024-002',
          course: 'Bachelor of Arts in Psychology',
          year: '2nd Year',
          section: 'B',
          violation_type: 'DRUGS_ALCOHOL_WEAPONS',
          violation_description: 'Student found with prohibited items',
          remarks: 'Serious offense',
          status: 'pending',
          created_at: '2024-01-15T10:15:00Z',
          updated_at: '2024-01-15T10:15:00Z'
        }
      ];

      getAdmissionSlips.mockResolvedValue({
        data: mockSlips,
        total: 2,
        page: 1,
        totalPages: 1
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/admission slips/i)).toBeInTheDocument();
      });

      expect(screen.getByText('AS-2024-001')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('AS-2024-002')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create new slip/i })).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      expect(screen.getByText(/loading admission slips/i)).toBeInTheDocument();
    });

    it('displays empty state when no slips exist', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        totalPages: 1
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/no admission slips found/i)).toBeInTheDocument();
        expect(screen.getByText(/create your first admission slip/i)).toBeInTheDocument();
      });
    });

    it('displays error message when loading fails', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockRejectedValue(new Error('Failed to load admission slips'));

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load admission slips/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filtering', () => {
    it('should search admission slips by student name', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      const mockSlips = [
        {
          id: 1,
          student_name: 'John Doe',
          slip_number: 'AS-2024-001'
        }
      ];

      getAdmissionSlips.mockResolvedValue({
        data: mockSlips,
        total: 1
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/search slips/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/search slips/i);
      await userEvent.type(searchInput, 'John');

      await waitFor(() => {
        expect(getAdmissionSlips).toHaveBeenCalledWith({ search: 'John', page: 1 });
      });
    });

    it('should filter slips by status', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [],
        total: 0
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
      });

      const statusFilter = screen.getByLabelText(/filter by status/i);
      await userEvent.selectOptions(statusFilter, 'printed');

      await waitFor(() => {
        expect(getAdmissionSlips).toHaveBeenCalledWith({ status: 'printed', page: 1 });
      });
    });

    it('should filter slips by violation category', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [],
        total: 0
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/filter by category/i)).toBeInTheDocument();
      });

      const categoryFilter = screen.getByLabelText(/filter by category/i);
      await userEvent.selectOptions(categoryFilter, 'minor');

      await waitFor(() => {
        expect(getAdmissionSlips).toHaveBeenCalledWith({ category: 'minor', page: 1 });
      });
    });

    it('should filter by date range', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [],
        total: 0
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
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

      await waitFor(() => {
        expect(getAdmissionSlips).toHaveBeenCalledWith({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          page: 1
        });
      });
    });
  });

  describe('Pagination', () => {
    it('should handle pagination correctly', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      // Mock first page
      getAdmissionSlips.mockResolvedValueOnce({
        data: Array(10).fill().map((_, i) => ({
          id: i + 1,
          slip_number: `AS-2024-${String(i + 1).padStart(3, '0')}`,
          student_name: `Student ${i + 1}`
        })),
        total: 25,
        page: 1,
        totalPages: 3
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/showing 1-10 of 25 slips/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
      });

      // Mock second page
      getAdmissionSlips.mockResolvedValueOnce({
        data: Array(10).fill().map((_, i) => ({
          id: i + 11,
          slip_number: `AS-2024-${String(i + 11).padStart(3, '0')}`,
          student_name: `Student ${i + 11}`
        })),
        total: 25,
        page: 2,
        totalPages: 3
      });

      const nextButton = screen.getByRole('button', { name: /next page/i });
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(getAdmissionSlips).toHaveBeenCalledWith({ page: 2 });
        expect(screen.getByText(/showing 11-20 of 25 slips/i)).toBeInTheDocument();
      });
    });

    it('should disable pagination buttons appropriately', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [],
        total: 5,
        page: 1,
        totalPages: 1
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
      });
    });
  });

  describe('Slip Actions', () => {
    it('should view slip details', async () => {
      const { getAdmissionSlips, getAdmissionSlipById } = require('../../services/api');
      
      const mockSlips = [
        {
          id: 1,
          slip_number: 'AS-2024-001',
          student_name: 'John Doe',
          status: 'printed'
        }
      ];

      const mockSlipDetails = {
        id: 1,
        slip_number: 'AS-2024-001',
        student_name: 'John Doe',
        student_id: '2024-001',
        course: 'Computer Science',
        violation_type: 'IMPROPER_UNIFORM',
        violation_description: 'Student without uniform',
        remarks: 'First offense',
        created_at: '2024-01-15T08:30:00Z'
      };

      getAdmissionSlips.mockResolvedValue({
        data: mockSlips,
        total: 1
      });

      getAdmissionSlipById.mockResolvedValue({
        data: mockSlipDetails
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
      });

      const viewButton = screen.getByRole('button', { name: /view details/i });
      await userEvent.click(viewButton);

      await waitFor(() => {
        expect(getAdmissionSlipById).toHaveBeenCalledWith(1);
        expect(screen.getByText(/slip details/i)).toBeInTheDocument();
        expect(screen.getByText('AS-2024-001')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should edit slip', async () => {
      const { getAdmissionSlips, getStudents, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlips = [
        {
          id: 1,
          slip_number: 'AS-2024-001',
          student_name: 'John Doe',
          status: 'draft'
        }
      ];

      getAdmissionSlips.mockResolvedValue({
        data: mockSlips,
        total: 1
      });

      getStudents.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [{ id: 1, name: 'Computer Science' }] });
      getYearLevels.mockResolvedValue({ data: [{ id: 1, name: '1st Year' }] });
      getSections.mockResolvedValue({ data: [{ id: 1, name: 'A' }] });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit/i });
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText(/edit admission slip/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      });
    });

    it('should print slip', async () => {
      const { getAdmissionSlips, printAdmissionSlip } = require('../../services/api');
      
      const mockSlips = [
        {
          id: 1,
          slip_number: 'AS-2024-001',
          student_name: 'John Doe',
          status: 'printed'
        }
      ];

      getAdmissionSlips.mockResolvedValue({
        data: mockSlips,
        total: 1
      });

      printAdmissionSlip.mockResolvedValue({
        data: { success: true, printed: true }
      });

      // Mock window.print
      const mockPrint = jest.fn();
      Object.defineProperty(window, 'print', {
        value: mockPrint,
        writable: true,
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await userEvent.click(printButton);

      await waitFor(() => {
        expect(printAdmissionSlip).toHaveBeenCalledWith(1);
        expect(mockPrint).toHaveBeenCalled();
      });
    });

    it('should delete slip', async () => {
      const { getAdmissionSlips, deleteAdmissionSlip } = require('../../services/api');
      
      const mockSlips = [
        {
          id: 1,
          slip_number: 'AS-2024-001',
          student_name: 'John Doe',
          status: 'draft'
        }
      ];

      getAdmissionSlips.mockResolvedValue({
        data: mockSlips,
        total: 1
      });

      deleteAdmissionSlip.mockResolvedValue({
        data: { success: true }
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to delete this slip/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(deleteAdmissionSlip).toHaveBeenCalledWith(1);
        expect(screen.getByText(/admission slip deleted successfully/i)).toBeInTheDocument();
      });
    });

    it('should show appropriate actions based on slip status', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      const mockSlips = [
        {
          id: 1,
          slip_number: 'AS-2024-001',
          student_name: 'John Doe',
          status: 'draft'
        },
        {
          id: 2,
          slip_number: 'AS-2024-002',
          student_name: 'Jane Smith',
          status: 'printed'
        },
        {
          id: 3,
          slip_number: 'AS-2024-003',
          student_name: 'Bob Johnson',
          status: 'completed'
        }
      ];

      getAdmissionSlips.mockResolvedValue({
        data: mockSlips,
        total: 3
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        // Draft slips should show edit and delete
        const draftRow = screen.getByText('John Doe').closest('tr');
        expect(draftRow).toContainElement(screen.getByRole('button', { name: /edit/i }));
        expect(draftRow).toContainElement(screen.getByRole('button', { name: /delete/i }));

        // Printed slips should show print and edit
        const printedRow = screen.getByText('Jane Smith').closest('tr');
        expect(printedRow).toContainElement(screen.getByRole('button', { name: /print/i }));
        expect(printedRow).toContainElement(screen.getByRole('button', { name: /edit/i }));

        // Completed slips should only show view
        const completedRow = screen.getByText('Bob Johnson').closest('tr');
        expect(completedRow).toContainElement(screen.getByRole('button', { name: /view details/i }));
        expect(completedRow).not.toContainElement(screen.getByRole('button', { name: /edit/i }));
      });
    });
  });

  describe('Bulk Actions', () => {
    it('should select multiple slips', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      const mockSlips = [
        { id: 1, slip_number: 'AS-2024-001', student_name: 'John Doe' },
        { id: 2, slip_number: 'AS-2024-002', student_name: 'Jane Smith' },
        { id: 3, slip_number: 'AS-2024-003', student_name: 'Bob Johnson' }
      ];

      getAdmissionSlips.mockResolvedValue({
        data: mockSlips,
        total: 3
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /select all/i })).toBeInTheDocument();
      });

      // Select individual slips
      const checkboxes = screen.getAllByRole('checkbox').filter(cb => 
        !screen.getByRole('checkbox', { name: /select all/i }).contains(cb)
      );

      await userEvent.click(checkboxes[0]); // Select first slip
      await userEvent.click(checkboxes[2]); // Select third slip

      await waitFor(() => {
        expect(screen.getByText(/2 slips selected/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /bulk print/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /bulk delete/i })).toBeInTheDocument();
      });
    });

    it('should select all slips', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      const mockSlips = [
        { id: 1, slip_number: 'AS-2024-001', student_name: 'John Doe' },
        { id: 2, slip_number: 'AS-2024-002', student_name: 'Jane Smith' }
      ];

      getAdmissionSlips.mockResolvedValue({
        data: mockSlips,
        total: 2
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
        userEvent.click(selectAllCheckbox);
      });

      await waitFor(() => {
        expect(screen.getByText(/2 slips selected/i)).toBeInTheDocument();
      });
    });

    it('should perform bulk print', async () => {
      const { getAdmissionSlips, printAdmissionSlip } = require('../../services/api');
      
      const mockSlips = [
        { id: 1, slip_number: 'AS-2024-001', student_name: 'John Doe' },
        { id: 2, slip_number: 'AS-2024-002', student_name: 'Jane Smith' }
      ];

      getAdmissionSlips.mockResolvedValue({
        data: mockSlips,
        total: 2
      });

      printAdmissionSlip.mockResolvedValue({
        data: { success: true }
      });

      const mockPrint = jest.fn();
      Object.defineProperty(window, 'print', {
        value: mockPrint,
        writable: true,
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      // Select all slips
      await waitFor(() => {
        const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
        userEvent.click(selectAllCheckbox);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /bulk print/i })).toBeInTheDocument();
      });

      const bulkPrintButton = screen.getByRole('button', { name: /bulk print/i });
      await userEvent.click(bulkPrintButton);

      await waitFor(() => {
        expect(printAdmissionSlip).toHaveBeenCalledTimes(2);
        expect(screen.getByText(/bulk print completed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    it('should sort slips by different columns', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [],
        total: 0
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sort by slip number/i })).toBeInTheDocument();
      });

      const sortButton = screen.getByRole('button', { name: /sort by slip number/i });
      await userEvent.click(sortButton);

      await waitFor(() => {
        expect(getAdmissionSlips).toHaveBeenCalledWith({ sortBy: 'slip_number', sortOrder: 'asc', page: 1 });
      });

      // Test sorting by student name
      const nameSortButton = screen.getByRole('button', { name: /sort by student name/i });
      await userEvent.click(nameSortButton);

      await waitFor(() => {
        expect(getAdmissionSlips).toHaveBeenCalledWith({ sortBy: 'student_name', sortOrder: 'asc', page: 1 });
      });
    });

    it('should toggle sort order', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [],
        total: 0
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      const sortButton = screen.getByRole('button', { name: /sort by slip number/i });
      
      // First click - ascending
      await userEvent.click(sortButton);
      await waitFor(() => {
        expect(getAdmissionSlips).toHaveBeenCalledWith({ sortBy: 'slip_number', sortOrder: 'asc', page: 1 });
      });

      // Second click - descending
      await userEvent.click(sortButton);
      await waitFor(() => {
        expect(getAdmissionSlips).toHaveBeenCalledWith({ sortBy: 'slip_number', sortOrder: 'desc', page: 1 });
      });
    });
  });

  describe('Export Functionality', () => {
    it('should export slips to Excel', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [
          { id: 1, slip_number: 'AS-2024-001', student_name: 'John Doe' }
        ],
        total: 1
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
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export to excel/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export to excel/i });
      await userEvent.click(exportButton);

      await waitFor(() => {
        expect(mockLink.click).toHaveBeenCalled();
        expect(mockLink.download).toContain('admission_slips');
      });
    });

    it('should export filtered results', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [
          { id: 1, slip_number: 'AS-2024-001', student_name: 'John Doe', status: 'printed' }
        ],
        total: 1
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      // Apply filter first
      await waitFor(() => {
        const statusFilter = screen.getByLabelText(/filter by status/i);
        userEvent.selectOptions(statusFilter, 'printed');
      });

      await waitFor(() => {
        expect(getAdmissionSlips).toHaveBeenCalledWith({ status: 'printed', page: 1 });
      });

      // Export filtered results
      const mockLink = { click: jest.fn() };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
      jest.spyOn(document.body, 'appendChild').mockImplementation();
      jest.spyOn(document.body, 'removeChild').mockImplementation();

      const exportButton = screen.getByRole('button', { name: /export to excel/i });
      await userEvent.click(exportButton);

      await waitFor(() => {
        expect(mockLink.click).toHaveBeenCalled();
      });
    });
  });

  describe('Statistics Dashboard', () => {
    it('should display admission slip statistics', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [
          { id: 1, status: 'printed' },
          { id: 2, status: 'draft' },
          { id: 3, status: 'completed' }
        ],
        total: 3,
        statistics: {
          total_slips: 150,
          printed_slips: 120,
          draft_slips: 20,
          completed_slips: 10,
          this_month: 25,
          last_month: 30
        }
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/total slips/i)).toBeInTheDocument();
        expect(screen.getByText('150')).toBeInTheDocument();
        expect(screen.getByText(/printed/i)).toBeInTheDocument();
        expect(screen.getByText('120')).toBeInTheDocument();
        expect(screen.getByText(/draft/i)).toBeInTheDocument();
        expect(screen.getByText('20')).toBeInTheDocument();
        expect(screen.getByText(/completed/i)).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to create new slip', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [],
        total: 0
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create new slip/i })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create new slip/i });
      await userEvent.click(createButton);

      expect(mockNavigate).toHaveBeenCalledWith('/print-slip');
    });

    it('should navigate to dashboard', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [],
        total: 0
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      await userEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [],
        total: 0
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'Admission Slips');
      });

      // Check table headers
      expect(screen.getByRole('columnheader', { name: /slip number/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /student name/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const { getAdmissionSlips } = require('../../services/api');
      
      getAdmissionSlips.mockResolvedValue({
        data: [
          { id: 1, slip_number: 'AS-2024-001', student_name: 'John Doe' }
        ],
        total: 1
      });

      render(
        <TestWrapper>
          <AdmissionSlips />
        </TestWrapper>
      );

      await waitFor(() => {
        const searchInput = screen.getByLabelText(/search slips/i);
        searchInput.focus();
        expect(searchInput).toHaveFocus();

        userEvent.tab();
        expect(screen.getByLabelText(/filter by status/i)).toHaveFocus();
      });
    });
  });
});
