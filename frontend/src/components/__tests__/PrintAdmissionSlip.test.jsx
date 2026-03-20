import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import PrintAdmissionSlip from '../PrintAdmissionSlip';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  getViolationTypes: jest.fn(),
  getStudents: jest.fn(),
  createAdmissionSlip: jest.fn(),
  getAdmissionSlipById: jest.fn(),
  updateAdmissionSlip: jest.fn(),
  printAdmissionSlip: jest.fn(),
}));

// Mock React Router
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: null }),
}));

// Mock window.print
const mockPrint = jest.fn();
Object.defineProperty(window, 'print', {
  value: mockPrint,
  writable: true,
});

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

describe('PrintAdmissionSlip Component', () => {
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
    it('renders admission slip form correctly', async () => {
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [
          { id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform', category: 'minor' },
          { id: 2, code: 'DRUGS_ALCOHOL_WEAPONS', description: 'Possession of prohibited items', category: 'major' }
        ]
      });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/print admission slip/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/student id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/student name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/course/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/year/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/section/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/school year/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/term/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/violation type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/violation description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/remarks/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create slip/i })).toBeInTheDocument();
    });

    it('shows loading states initially', () => {
      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      expect(screen.getByText(/loading violation types/i)).toBeInTheDocument();
    });

    it('displays error message when data loading fails', async () => {
      const { getViolationTypes } = require('../../services/api');
      getViolationTypes.mockRejectedValue(new Error('Failed to load'));

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load violation types/i)).toBeInTheDocument();
      });
    });
  });

  describe('Student Search and Selection', () => {
    it('should search for existing students', async () => {
      const { getStudents, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });

      const mockStudents = [
        { id: 1, studentId: '2024-001', firstName: 'John', lastName: 'Doe', course: 'Computer Science' },
        { id: 2, studentId: '2024-002', firstName: 'Jane', lastName: 'Smith', course: 'Psychology' }
      ];

      getStudents.mockResolvedValue({ data: mockStudents });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/search student/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/search student/i);
      await userEvent.type(searchInput, 'John');

      await waitFor(() => {
        expect(getStudents).toHaveBeenCalledWith({ search: 'John' });
      });
    });

    it('should populate form fields when student is selected', async () => {
      const { getStudents, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });

      const mockStudents = [
        { 
          id: 1, 
          studentId: '2024-001', 
          firstName: 'John', 
          lastName: 'Doe', 
          course: 'Bachelor of Science in Computer Science',
          year: '1st Year',
          section: 'A'
        }
      ];

      getStudents.mockResolvedValue({ data: mockStudents });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      const searchInput = screen.getByLabelText(/search student/i);
      await userEvent.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('2024-001')).toBeInTheDocument();
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Bachelor of Science in Computer Science')).toBeInTheDocument();
        expect(screen.getByDisplayValue('1st Year')).toBeInTheDocument();
        expect(screen.getByDisplayValue('A')).toBeInTheDocument();
      });
    });

    it('should allow manual student entry', async () => {
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/enter student manually/i)).toBeInTheDocument();
      });

      const manualEntryButton = screen.getByText(/enter student manually/i);
      await userEvent.click(manualEntryButton);

      expect(screen.getByLabelText(/student id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/student name/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create slip/i })).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /create slip/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/student id is required/i)).toBeInTheDocument();
        expect(screen.getByText(/student name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/course is required/i)).toBeInTheDocument();
        expect(screen.getByText(/violation type is required/i)).toBeInTheDocument();
        expect(screen.getByText(/violation description is required/i)).toBeInTheDocument();
      });
    });

    it('should validate student ID format', async () => {
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      const manualEntryButton = screen.getByText(/enter student manually/i);
      await userEvent.click(manualEntryButton);

      const studentIdInput = screen.getByLabelText(/student id/i);
      await userEvent.type(studentIdInput, 'invalid-id');

      await waitFor(() => {
        expect(screen.getByText(/invalid student id format/i)).toBeInTheDocument();
      });
    });

    it('should validate school year format', async () => {
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      const schoolYearInput = screen.getByLabelText(/school year/i);
      await userEvent.type(schoolYearInput, '2024');

      await waitFor(() => {
        expect(screen.getByText(/invalid school year format/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should create admission slip successfully', async () => {
      const { createAdmissionSlip, getStudents, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ 
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform', category: 'minor' }] 
      });

      const mockStudents = [
        { 
          id: 1, 
          studentId: '2024-001', 
          firstName: 'John', 
          lastName: 'Doe', 
          course: 'Bachelor of Science in Computer Science',
          year: '1st Year',
          section: 'A'
        }
      ];
      getStudents.mockResolvedValue({ data: mockStudents });

      createAdmissionSlip.mockResolvedValue({
        data: { 
          id: 1, 
          slip_number: 'AS-2024-001',
          status: 'printed' 
        }
      });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      // Select student
      const searchInput = screen.getByLabelText(/search student/i);
      await userEvent.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('John Doe'));

      // Fill violation details
      await userEvent.selectOptions(screen.getByLabelText(/violation type/i), '1');
      await userEvent.type(screen.getByLabelText(/violation description/i), 'Student came without proper uniform');
      await userEvent.type(screen.getByLabelText(/remarks/i), 'First offense');

      // Submit
      const submitButton = screen.getByRole('button', { name: /create slip/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(createAdmissionSlip).toHaveBeenCalledWith({
          student_id: 1,
          violation_type_id: 1,
          violation_description: 'Student came without proper uniform',
          remarks: 'First offense',
          course: 'Bachelor of Science in Computer Science',
          year: '1st Year',
          section: 'A',
          school_year: '2024-2025',
          term: '1st Semester'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/admission slip created successfully/i)).toBeInTheDocument();
        expect(screen.getByText(/AS-2024-001/i)).toBeInTheDocument();
      });
    });

    it('should handle submission errors', async () => {
      const { createAdmissionSlip, getStudents, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [{ id: 1, code: 'TEST', description: 'Test violation' }] });

      const mockStudents = [
        { id: 1, studentId: '2024-001', firstName: 'John', lastName: 'Doe' }
      ];
      getStudents.mockResolvedValue({ data: mockStudents });

      createAdmissionSlip.mockRejectedValue({
        response: { data: { error: 'Failed to create admission slip' } }
      });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      // Select student and fill form
      const searchInput = screen.getByLabelText(/search student/i);
      await userEvent.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('John Doe'));
      await userEvent.selectOptions(screen.getByLabelText(/violation type/i), '1');
      await userEvent.type(screen.getByLabelText(/violation description/i), 'Test violation');

      const submitButton = screen.getByRole('button', { name: /create slip/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to create admission slip/i)).toBeInTheDocument();
      });
    });
  });

  describe('Print Functionality', () => {
    it('should show print preview after slip creation', async () => {
      const { createAdmissionSlip, getStudents, getViolationTypes, getAdmissionSlipById } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [{ id: 1, code: 'TEST', description: 'Test violation' }] });

      const mockStudents = [
        { id: 1, studentId: '2024-001', firstName: 'John', lastName: 'Doe' }
      ];
      getStudents.mockResolvedValue({ data: mockStudents });

      createAdmissionSlip.mockResolvedValue({
        data: { id: 1, slip_number: 'AS-2024-001' }
      });

      const mockSlip = {
        id: 1,
        slip_number: 'AS-2024-001',
        student_name: 'John Doe',
        student_id: '2024-001',
        violation_type: 'IMPROPER_UNIFORM',
        violation_description: 'Test violation',
        created_at: new Date().toISOString()
      };
      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      // Create slip
      const searchInput = screen.getByLabelText(/search student/i);
      await userEvent.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('John Doe'));
      await userEvent.selectOptions(screen.getByLabelText(/violation type/i), '1');
      await userEvent.type(screen.getByLabelText(/violation description/i), 'Test violation');

      const submitButton = screen.getByRole('button', { name: /create slip/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/print preview/i)).toBeInTheDocument();
        expect(screen.getByText('AS-2024-001')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should call window.print when print button is clicked', async () => {
      const { createAdmissionSlip, getStudents, getViolationTypes, getAdmissionSlipById } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [{ id: 1, code: 'TEST', description: 'Test violation' }] });

      const mockStudents = [
        { id: 1, studentId: '2024-001', firstName: 'John', lastName: 'Doe' }
      ];
      getStudents.mockResolvedValue({ data: mockStudents });

      createAdmissionSlip.mockResolvedValue({
        data: { id: 1, slip_number: 'AS-2024-001' }
      });

      const mockSlip = {
        id: 1,
        slip_number: 'AS-2024-001',
        student_name: 'John Doe'
      };
      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      // Create slip
      const searchInput = screen.getByLabelText(/search student/i);
      await userEvent.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('John Doe'));
      await userEvent.selectOptions(screen.getByLabelText(/violation type/i), '1');
      await userEvent.type(screen.getByLabelText(/violation description/i), 'Test violation');

      const submitButton = screen.getByRole('button', { name: /create slip/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await userEvent.click(printButton);

      expect(mockPrint).toHaveBeenCalled();
    });

    it('should handle print API call', async () => {
      const { createAdmissionSlip, getStudents, getViolationTypes, printAdmissionSlip } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [{ id: 1, code: 'TEST', description: 'Test violation' }] });

      const mockStudents = [
        { id: 1, studentId: '2024-001', firstName: 'John', lastName: 'Doe' }
      ];
      getStudents.mockResolvedValue({ data: mockStudents });

      createAdmissionSlip.mockResolvedValue({
        data: { id: 1, slip_number: 'AS-2024-001' }
      });

      printAdmissionSlip.mockResolvedValue({
        data: { success: true, printed: true }
      });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      // Create slip
      const searchInput = screen.getByLabelText(/search student/i);
      await userEvent.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('John Doe'));
      await userEvent.selectOptions(screen.getByLabelText(/violation type/i), '1');
      await userEvent.type(screen.getByLabelText(/violation description/i), 'Test violation');

      const submitButton = screen.getByRole('button', { name: /create slip/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await userEvent.click(printButton);

      await waitFor(() => {
        expect(printAdmissionSlip).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Edit Mode', () => {
    it('should load existing slip data when editing', async () => {
      const { getViolationTypes, getAdmissionSlipById } = require('../../services/api');
      const useParams = require('react-router-dom').useParams;
      useParams.mockReturnValue({ id: '1' });

      getViolationTypes.mockResolvedValue({ 
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform', category: 'minor' }] 
      });

      const mockSlip = {
        id: 1,
        slip_number: 'AS-2024-001',
        student_id: 1,
        student_name: 'John Doe',
        student_id_number: '2024-001',
        course: 'Bachelor of Science in Computer Science',
        year: '1st Year',
        section: 'A',
        school_year: '2024-2025',
        term: '1st Semester',
        violation_type_id: 1,
        violation_description: 'Student came without proper uniform',
        remarks: 'First offense',
        status: 'draft'
      };
      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('2024-001')).toBeInTheDocument();
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Student came without proper uniform')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /update slip/i })).toBeInTheDocument();
      });
    });

    it('should update existing slip successfully', async () => {
      const { updateAdmissionSlip, getViolationTypes, getAdmissionSlipById } = require('../../services/api');
      const useParams = require('react-router-dom').useParams;
      useParams.mockReturnValue({ id: '1' });

      getViolationTypes.mockResolvedValue({ data: [{ id: 1, code: 'TEST', description: 'Test violation' }] });

      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        violation_description: 'Original description'
      };
      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });

      updateAdmissionSlip.mockResolvedValue({
        data: { id: 1, status: 'updated' }
      });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /update slip/i })).toBeInTheDocument();
      });

      // Update description
      const descriptionInput = screen.getByLabelText(/violation description/i);
      await userEvent.clear(descriptionInput);
      await userEvent.type(descriptionInput, 'Updated description');

      const updateButton = screen.getByRole('button', { name: /update slip/i });
      await userEvent.click(updateButton);

      await waitFor(() => {
        expect(updateAdmissionSlip).toHaveBeenCalledWith(1, {
          violation_description: 'Updated description'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/admission slip updated successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Reset and Navigation', () => {
    it('should reset form after successful creation', async () => {
      const { createAdmissionSlip, getStudents, getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [{ id: 1, code: 'TEST', description: 'Test violation' }] });

      const mockStudents = [
        { id: 1, studentId: '2024-001', firstName: 'John', lastName: 'Doe' }
      ];
      getStudents.mockResolvedValue({ data: mockStudents });

      createAdmissionSlip.mockResolvedValue({
        data: { id: 1, slip_number: 'AS-2024-001' }
      });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      // Fill and submit form
      const searchInput = screen.getByLabelText(/search student/i);
      await userEvent.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('John Doe'));
      await userEvent.selectOptions(screen.getByLabelText(/violation type/i), '1');
      await userEvent.type(screen.getByLabelText(/violation description/i), 'Test violation');

      const submitButton = screen.getByRole('button', { name: /create slip/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/admission slip created successfully/i)).toBeInTheDocument();
      });

      // Check if new slip button appears
      expect(screen.getByRole('button', { name: /create new slip/i })).toBeInTheDocument();
    });

    it('should navigate back to dashboard', async () => {
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
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
      
      getViolationTypes.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Admission Slip Form');
      });

      // Check form fields have proper labels
      expect(screen.getByLabelText(/student id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/violation type/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const { getViolationTypes } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <PrintAdmissionSlip />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create slip/i })).toBeInTheDocument();
      });

      // Tab through form fields
      screen.getByLabelText(/student id/i).focus();
      expect(screen.getByLabelText(/student id/i)).toHaveFocus();

      userEvent.tab();
      expect(screen.getByLabelText(/student name/i)).toHaveFocus();
    });
  });
});
