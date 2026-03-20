import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import SearchRecords from '../SearchRecords';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  searchAdmissionSlips: jest.fn(),
  searchStudentReports: jest.fn(),
  getAdmissionSlipById: jest.fn(),
  getStudentReportById: jest.fn(),
  getStudents: jest.fn(),
  getViolationTypes: jest.fn(),
  exportSearchResults: jest.fn(),
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

describe('SearchRecords Component', () => {
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
    it('renders search interface correctly', async () => {
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [
          { id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform', category: 'minor' },
          { id: 2, code: 'DRUGS_ALCOHOL_WEAPONS', description: 'Possession of prohibited items', category: 'major' }
        ]
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/search records/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/search query/i)).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /search type/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /admission slips/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /student reports/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('displays error message when data loading fails', async () => {
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockRejectedValue(new Error('Failed to load data'));

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load search options/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should search admission slips', async () => {
      const { searchAdmissionSlips, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      const mockResults = [
        {
          id: 1,
          slip_number: 'AS-2024-001',
          student_name: 'John Doe',
          student_id: '2024-001',
          violation_type: 'IMPROPER_UNIFORM',
          violation_description: 'Student came without proper uniform',
          status: 'printed',
          created_at: '2024-01-15T08:30:00Z'
        }
      ];

      searchAdmissionSlips.mockResolvedValue({
        data: mockResults,
        total: 1
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /admission slips/i })).toBeInTheDocument();
      });

      // Select admission slips search type
      const admissionSlipsRadio = screen.getByRole('radio', { name: /admission slips/i });
      await userEvent.click(admissionSlipsRadio);

      // Enter search query
      const searchInput = screen.getByLabelText(/search query/i);
      await userEvent.type(searchInput, 'John Doe');

      // Click search button
      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(searchAdmissionSlips).toHaveBeenCalledWith({
          query: 'John Doe',
          type: 'admission_slips',
          filters: {}
        });
      });

      await waitFor(() => {
        expect(screen.getByText('AS-2024-001')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('2024-001')).toBeInTheDocument();
      });
    });

    it('should search student reports', async () => {
      const { searchStudentReports, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      const mockResults = [
        {
          id: 1,
          student_name: 'Jane Smith',
          student_id: '2024-002',
          violation_type: 'IMPROPER_UNIFORM',
          description: 'Student found littering',
          status: 'reported',
          created_at: '2024-01-15T10:30:00Z'
        }
      ];

      searchStudentReports.mockResolvedValue({
        data: mockResults,
        total: 1
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /student reports/i })).toBeInTheDocument();
      });

      // Select student reports search type
      const studentReportsRadio = screen.getByRole('radio', { name: /student reports/i });
      await userEvent.click(studentReportsRadio);

      // Enter search query
      const searchInput = screen.getByLabelText(/search query/i);
      await userEvent.type(searchInput, 'Jane Smith');

      // Click search button
      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(searchStudentReports).toHaveBeenCalledWith({
          query: 'Jane Smith',
          type: 'student_reports',
          filters: {}
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('2024-002')).toBeInTheDocument();
        expect(screen.getByText('Student found littering')).toBeInTheDocument();
      });
    });

    it('should handle empty search results', async () => {
      const { searchAdmissionSlips, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      searchAdmissionSlips.mockResolvedValue({
        data: [],
        total: 0
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      // Select admission slips search type
      const admissionSlipsRadio = screen.getByRole('radio', { name: /admission slips/i });
      await userEvent.click(admissionSlipsRadio);

      // Enter search query
      const searchInput = screen.getByLabelText(/search query/i);
      await userEvent.type(searchInput, 'Nonexistent Student');

      // Click search button
      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText(/no records found/i)).toBeInTheDocument();
        expect(screen.getByText(/try adjusting your search criteria/i)).toBeInTheDocument();
      });
    });

    it('should handle search errors', async () => {
      const { searchAdmissionSlips, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      searchAdmissionSlips.mockRejectedValue({
        response: { data: { error: 'Search failed' } }
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      // Select admission slips search type
      const admissionSlipsRadio = screen.getByRole('radio', { name: /admission slips/i });
      await userEvent.click(admissionSlipsRadio);

      // Enter search query
      const searchInput = screen.getByLabelText(/search query/i);
      await userEvent.type(searchInput, 'Test');

      // Click search button
      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText(/search failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Advanced Search Filters', () => {
    it('should show advanced filters', async () => {
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [
          { id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform', category: 'minor' },
          { id: 2, code: 'DRUGS_ALCOHOL_WEAPONS', description: 'Possession of prohibited items', category: 'major' }
        ]
      });

      render(
        <TestWrapper>
          <SearchRecords />
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
        expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/date from/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/date to/i)).toBeInTheDocument();
      });
    });

    it('should apply filters to search', async () => {
      const { searchAdmissionSlips, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [
          { id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform', category: 'minor' },
          { id: 2, code: 'DRUGS_ALCOHOL_WEAPONS', description: 'Possession of prohibited items', category: 'major' }
        ]
      });

      searchAdmissionSlips.mockResolvedValue({
        data: [],
        total: 0
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      // Open advanced filters
      const advancedFiltersButton = screen.getByRole('button', { name: /advanced filters/i });
      await userEvent.click(advancedFiltersButton);

      // Select filters
      await userEvent.selectOptions(screen.getByLabelText(/violation type/i), '1');
      await userEvent.selectOptions(screen.getByLabelText(/category/i), 'minor');
      await userEvent.selectOptions(screen.getByLabelText(/status/i), 'printed');
      await userEvent.type(screen.getByLabelText(/date from/i), '2024-01-01');
      await userEvent.type(screen.getByLabelText(/date to/i), '2024-01-31');

      // Select admission slips search type
      const admissionSlipsRadio = screen.getByRole('radio', { name: /admission slips/i });
      await userEvent.click(admissionSlipsRadio);

      // Enter search query
      const searchInput = screen.getByLabelText(/search query/i);
      await userEvent.type(searchInput, 'Test');

      // Click search button
      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(searchAdmissionSlips).toHaveBeenCalledWith({
          query: 'Test',
          type: 'admission_slips',
          filters: {
            violation_type_id: '1',
            category: 'minor',
            status: 'printed',
            date_from: '2024-01-01',
            date_to: '2024-01-31'
          }
        });
      });
    });

    it('should reset filters', async () => {
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      // Open advanced filters
      const advancedFiltersButton = screen.getByRole('button', { name: /advanced filters/i });
      await userEvent.click(advancedFiltersButton);

      // Apply some filters
      await userEvent.selectOptions(screen.getByLabelText(/violation type/i), '1');
      await userEvent.selectOptions(screen.getByLabelText(/category/i), 'minor');

      // Click reset button
      const resetButton = screen.getByRole('button', { name: /reset filters/i });
      await userEvent.click(resetButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/violation type/i)).toHaveValue('');
        expect(screen.getByLabelText(/category/i)).toHaveValue('');
      });
    });
  });

  describe('Search Results Display', () => {
    it('should display admission slip results correctly', async () => {
      const { searchAdmissionSlips, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      const mockResults = [
        {
          id: 1,
          slip_number: 'AS-2024-001',
          student_name: 'John Doe',
          student_id: '2024-001',
          course: 'Computer Science',
          year: '1st Year',
          section: 'A',
          violation_type: 'IMPROPER_UNIFORM',
          violation_description: 'Student came without proper uniform',
          remarks: 'First offense',
          status: 'printed',
          created_at: '2024-01-15T08:30:00Z'
        },
        {
          id: 2,
          slip_number: 'AS-2024-002',
          student_name: 'Jane Smith',
          student_id: '2024-002',
          course: 'Psychology',
          year: '2nd Year',
          section: 'B',
          violation_type: 'LITTERING',
          violation_description: 'Student found littering',
          remarks: 'Verbal warning',
          status: 'draft',
          created_at: '2024-01-15T10:15:00Z'
        }
      ];

      searchAdmissionSlips.mockResolvedValue({
        data: mockResults,
        total: 2
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      // Select admission slips search type
      const admissionSlipsRadio = screen.getByRole('radio', { name: /admission slips/i });
      await userEvent.click(admissionSlipsRadio);

      // Enter search query
      const searchInput = screen.getByLabelText(/search query/i);
      await userEvent.type(searchInput, 'Test');

      // Click search button
      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText(/found 2 results/i)).toBeInTheDocument();
        expect(screen.getByText('AS-2024-001')).toBeInTheDocument();
        expect(screen.getByText('AS-2024-002')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Computer Science')).toBeInTheDocument();
        expect(screen.getByText('Psychology')).toBeInTheDocument();
      });
    });

    it('should display student report results correctly', async () => {
      const { searchStudentReports, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      const mockResults = [
        {
          id: 1,
          student_name: 'Bob Johnson',
          student_id: '2024-003',
          course: 'Engineering',
          year: '3rd Year',
          section: 'C',
          violation_type: 'DRUGS_ALCOHOL_WEAPONS',
          description: 'Student found with prohibited items',
          remarks: 'Serious offense - requires disciplinary action',
          status: 'investigating',
          created_at: '2024-01-15T14:20:00Z'
        }
      ];

      searchStudentReports.mockResolvedValue({
        data: mockResults,
        total: 1
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      // Select student reports search type
      const studentReportsRadio = screen.getByRole('radio', { name: /student reports/i });
      await userEvent.click(studentReportsRadio);

      // Enter search query
      const searchInput = screen.getByLabelText(/search query/i);
      await userEvent.type(searchInput, 'Bob');

      // Click search button
      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText(/found 1 result/i)).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        expect(screen.getByText('2024-003')).toBeInTheDocument();
        expect(screen.getByText('Engineering')).toBeInTheDocument();
        expect(screen.getByText('3rd Year')).toBeInTheDocument();
        expect(screen.getByText('Student found with prohibited items')).toBeInTheDocument();
      });
    });

    it('should show result details on click', async () => {
      const { searchAdmissionSlips, getAdmissionSlipById, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      const mockResults = [
        {
          id: 1,
          slip_number: 'AS-2024-001',
          student_name: 'John Doe',
          student_id: '2024-001'
        }
      ];

      const mockSlipDetails = {
        id: 1,
        slip_number: 'AS-2024-001',
        student_name: 'John Doe',
        student_id: '2024-001',
        course: 'Computer Science',
        year: '1st Year',
        section: 'A',
        violation_type: 'IMPROPER_UNIFORM',
        violation_description: 'Student came without proper uniform',
        remarks: 'First offense',
        status: 'printed',
        created_at: '2024-01-15T08:30:00Z'
      };

      searchAdmissionSlips.mockResolvedValue({
        data: mockResults,
        total: 1
      });

      getAdmissionSlipById.mockResolvedValue({
        data: mockSlipDetails
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      // Perform search
      const admissionSlipsRadio = screen.getByRole('radio', { name: /admission slips/i });
      await userEvent.click(admissionSlipsRadio);

      const searchInput = screen.getByLabelText(/search query/i);
      await userEvent.type(searchInput, 'John Doe');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      // Click on result to view details
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
      });

      const viewDetailsButton = screen.getByRole('button', { name: /view details/i });
      await userEvent.click(viewDetailsButton);

      await waitFor(() => {
        expect(getAdmissionSlipById).toHaveBeenCalledWith(1);
        expect(screen.getByText(/record details/i)).toBeInTheDocument();
        expect(screen.getByText('AS-2024-001')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Student came without proper uniform')).toBeInTheDocument();
      });
    });
  });

  describe('Export Functionality', () => {
    it('should export search results', async () => {
      const { searchAdmissionSlips, exportSearchResults, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      const mockResults = [
        {
          id: 1,
          slip_number: 'AS-2024-001',
          student_name: 'John Doe',
          student_id: '2024-001'
        }
      ];

      searchAdmissionSlips.mockResolvedValue({
        data: mockResults,
        total: 1
      });

      exportSearchResults.mockResolvedValue({
        data: { success: true, downloadUrl: '/api/downloads/search_results.xlsx' }
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
          <SearchRecords />
        </TestWrapper>
      );

      // Perform search
      const admissionSlipsRadio = screen.getByRole('radio', { name: /admission slips/i });
      await userEvent.click(admissionSlipsRadio);

      const searchInput = screen.getByLabelText(/search query/i);
      await userEvent.type(searchInput, 'John Doe');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      // Export results
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export results/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export results/i });
      await userEvent.click(exportButton);

      await waitFor(() => {
        expect(exportSearchResults).toHaveBeenCalledWith({
          query: 'John Doe',
          type: 'admission_slips',
          filters: {}
        });
      });

      await waitFor(() => {
        expect(mockLink.click).toHaveBeenCalled();
      });
    });

    it('should show export format options', async () => {
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      render(
        <TestWrapper>
          <SearchRecords />
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
  });

  describe('Search History', () => {
    it('should save search history', async () => {
      const { searchAdmissionSlips, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      searchAdmissionSlips.mockResolvedValue({
        data: [],
        total: 0
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      // Perform search
      const admissionSlipsRadio = screen.getByRole('radio', { name: /admission slips/i });
      await userEvent.click(admissionSlipsRadio);

      const searchInput = screen.getByLabelText(/search query/i);
      await userEvent.type(searchInput, 'Test Query');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /search history/i })).toBeInTheDocument();
      });

      // Check if search is saved to history
      const searchHistoryButton = screen.getByRole('button', { name: /search history/i });
      await userEvent.click(searchHistoryButton);

      await waitFor(() => {
        expect(screen.getByText('Test Query')).toBeInTheDocument();
        expect(screen.getByText(/admission slips/i)).toBeInTheDocument();
      });
    });

    it('should repeat previous search', async () => {
      const { searchAdmissionSlips, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      searchAdmissionSlips.mockResolvedValue({
        data: [],
        total: 0
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      // Perform initial search
      const admissionSlipsRadio = screen.getByRole('radio', { name: /admission slips/i });
      await userEvent.click(admissionSlipsRadio);

      const searchInput = screen.getByLabelText(/search query/i);
      await userEvent.type(searchInput, 'Previous Search');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      // Open search history
      await waitFor(() => {
        const searchHistoryButton = screen.getByRole('button', { name: /search history/i });
        userEvent.click(searchHistoryButton);
      });

      // Click on previous search to repeat it
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /repeat search/i })).toBeInTheDocument();
      });

      const repeatButton = screen.getByRole('button', { name: /repeat search/i });
      await userEvent.click(repeatButton);

      await waitFor(() => {
        expect(searchAdmissionSlips).toHaveBeenCalledTimes(2);
        expect(screen.getByDisplayValue('Previous Search')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('should handle search result pagination', async () => {
      const { searchAdmissionSlips, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      // Mock first page
      searchAdmissionSlips.mockResolvedValueOnce({
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
          <SearchRecords />
        </TestWrapper>
      );

      // Perform search
      const admissionSlipsRadio = screen.getByRole('radio', { name: /admission slips/i });
      await userEvent.click(admissionSlipsRadio);

      const searchInput = screen.getByLabelText(/search query/i);
      await userEvent.type(searchInput, 'Test');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText(/showing 1-10 of 25 results/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
      });

      // Mock second page
      searchAdmissionSlips.mockResolvedValueOnce({
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
        expect(searchAdmissionSlips).toHaveBeenCalledWith({
          query: 'Test',
          type: 'admission_slips',
          filters: {},
          page: 2
        });
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to record details', async () => {
      const { searchAdmissionSlips, getAdmissionSlipById, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      const mockResults = [
        {
          id: 1,
          slip_number: 'AS-2024-001',
          student_name: 'John Doe'
        }
      ];

      searchAdmissionSlips.mockResolvedValue({
        data: mockResults,
        total: 1
      });

      getAdmissionSlipById.mockResolvedValue({
        data: {
          id: 1,
          slip_number: 'AS-2024-001',
          student_name: 'John Doe'
        }
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      // Perform search
      const admissionSlipsRadio = screen.getByRole('radio', { name: /admission slips/i });
      await userEvent.click(admissionSlipsRadio);

      const searchInput = screen.getByLabelText(/search query/i);
      await userEvent.type(searchInput, 'John Doe');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      // Click on result to navigate
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /view full record/i })).toBeInTheDocument();
      });

      const viewFullRecordButton = screen.getByRole('button', { name: /view full record/i });
      await userEvent.click(viewFullRecordButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admission-slips/1');
      });
    });

    it('should navigate back to dashboard', async () => {
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      render(
        <TestWrapper>
          <SearchRecords />
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
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('searchbox')).toHaveAttribute('aria-label', 'Search records');
      });

      // Check form elements have proper labels
      expect(screen.getByLabelText(/search query/i)).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /admission slips/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }]
      });

      render(
        <TestWrapper>
          <SearchRecords />
        </TestWrapper>
      );

      await waitFor(() => {
        const searchInput = screen.getByLabelText(/search query/i);
        searchInput.focus();
        expect(searchInput).toHaveFocus();

        userEvent.tab();
        expect(screen.getByRole('radio', { name: /admission slips/i })).toHaveFocus();
      });
    });
  });
});
