import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import CompleteForm from '../CompleteForm';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  getAdmissionSlipById: jest.fn(),
  updateAdmissionSlip: jest.fn(),
  getStudents: jest.fn(),
  getCourses: jest.fn(),
  getYearLevels: jest.fn(),
  getSections: jest.fn(),
  getViolationTypes: jest.fn(),
}));

// Mock React Router
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: '1' }),
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

describe('CompleteForm Component', () => {
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
    it('renders complete admission form correctly', async () => {
      const { getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
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
        status: 'draft',
        created_at: '2024-01-15T08:30:00Z'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({
        data: [
          { id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform', category: 'minor' },
          { id: 2, code: 'DRUGS_ALCOHOL_WEAPONS', description: 'Possession of prohibited items', category: 'major' }
        ]
      });
      getCourses.mockResolvedValue({ data: [{ id: 1, name: 'Computer Science' }] });
      getYearLevels.mockResolvedValue({ data: [{ id: 1, name: '1st Year' }] });
      getSections.mockResolvedValue({ data: [{ id: 1, name: 'A' }] });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/complete admission form/i)).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue('AS-2024-001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2024-001')).toBeInTheDocument();
      expect(screen.getByLabelText(/violation type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/violation description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/remarks/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/counselor notes/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/follow up actions/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /complete form/i })).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      expect(screen.getByText(/loading admission slip/i)).toBeInTheDocument();
    });

    it('displays error message when slip loading fails', async () => {
      const { getAdmissionSlipById } = require('../../services/api');
      
      getAdmissionSlipById.mockRejectedValue(new Error('Failed to load admission slip'));

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load admission slip/i)).toBeInTheDocument();
      });
    });

    it('shows not found message for invalid slip ID', async () => {
      const { getAdmissionSlipById } = require('../../services/api');
      
      getAdmissionSlipById.mockResolvedValue({ data: null });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/admission slip not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Fields', () => {
    it('should display all required form fields', async () => {
      const { getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        student_id_number: '2024-001',
        course: 'Computer Science',
        year: '1st Year',
        section: 'A',
        violation_type_id: 1,
        violation_description: 'Test violation',
        status: 'draft'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/student name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/student id/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/course/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/year/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/section/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/violation type/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/violation description/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/remarks/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/counselor notes/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/follow up actions/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/completion date/i)).toBeInTheDocument();
      });
    });

    it('should populate form with existing slip data', async () => {
      const { getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        slip_number: 'AS-2024-001',
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
      getViolationTypes.mockResolvedValue({ data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }] });
      getCourses.mockResolvedValue({ data: [{ id: 1, name: 'Bachelor of Science in Computer Science' }] });
      getYearLevels.mockResolvedValue({ data: [{ id: 1, name: '1st Year' }] });
      getSections.mockResolvedValue({ data: [{ id: 1, name: 'A' }] });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
        expect(screen.getByDisplayValue('2024-001')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Bachelor of Science in Computer Science')).toBeInTheDocument();
        expect(screen.getByDisplayValue('1st Year')).toBeInTheDocument();
        expect(screen.getByDisplayValue('A')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Student came without proper uniform')).toBeInTheDocument();
        expect(screen.getByDisplayValue('First offense')).toBeInTheDocument();
      });
    });

    it('should show read-only fields for completed slips', async () => {
      const { getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        student_id_number: '2024-001',
        violation_type_id: 1,
        violation_description: 'Test violation',
        status: 'completed'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('John Doe')).toBeDisabled();
        expect(screen.getByLabelText(/violation description/i)).toBeDisabled();
        expect(screen.getByLabelText(/remarks/i)).toBeDisabled();
        expect(screen.queryByRole('button', { name: /complete form/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const { getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        violation_type_id: 1,
        violation_description: 'Test violation',
        status: 'draft'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /complete form/i })).toBeInTheDocument();
      });

      // Clear required fields
      const descriptionInput = screen.getByLabelText(/violation description/i);
      await userEvent.clear(descriptionInput);

      const submitButton = screen.getByRole('button', { name: /complete form/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/violation description is required/i)).toBeInTheDocument();
      });
    });

    it('should validate completion date', async () => {
      const { getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        violation_type_id: 1,
        violation_description: 'Test violation',
        status: 'draft'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      const completionDateInput = screen.getByLabelText(/completion date/i);
      await userEvent.type(completionDateInput, 'invalid-date');

      await waitFor(() => {
        expect(screen.getByText(/invalid date format/i)).toBeInTheDocument();
      });
    });

    it('should validate counselor notes length', async () => {
      const { getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        violation_type_id: 1,
        violation_description: 'Test violation',
        status: 'draft'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      const counselorNotesInput = screen.getByLabelText(/counselor notes/i);
      const longNotes = 'a'.repeat(2001); // Assuming max length is 2000
      
      await userEvent.type(counselorNotesInput, longNotes);

      await waitFor(() => {
        expect(screen.getByText(/counselor notes too long/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should complete admission form successfully', async () => {
      const { updateAdmissionSlip, getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        student_id_number: '2024-001',
        course: 'Computer Science',
        year: '1st Year',
        section: 'A',
        violation_type_id: 1,
        violation_description: 'Student came without proper uniform',
        remarks: 'First offense',
        status: 'draft'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform' }] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      updateAdmissionSlip.mockResolvedValue({
        data: { 
          id: 1, 
          status: 'completed',
          completed_at: new Date().toISOString()
        }
      });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/counselor notes/i)).toBeInTheDocument();
      });

      // Fill completion fields
      const counselorNotesInput = screen.getByLabelText(/counselor notes/i);
      const followUpActionsInput = screen.getByLabelText(/follow up actions/i);
      const completionDateInput = screen.getByLabelText(/completion date/i);

      await userEvent.type(counselorNotesInput, 'Student counseled regarding uniform policy');
      await userEvent.type(followUpActionsInput, 'Monitor compliance for next 2 weeks');
      await userEvent.type(completionDateInput, '2024-01-20');

      const submitButton = screen.getByRole('button', { name: /complete form/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(updateAdmissionSlip).toHaveBeenCalledWith(1, {
          counselor_notes: 'Student counseled regarding uniform policy',
          follow_up_actions: 'Monitor compliance for next 2 weeks',
          completion_date: '2024-01-20',
          status: 'completed'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/admission form completed successfully/i)).toBeInTheDocument();
      });
    });

    it('should handle submission errors', async () => {
      const { updateAdmissionSlip, getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        violation_type_id: 1,
        violation_description: 'Test violation',
        status: 'draft'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      updateAdmissionSlip.mockRejectedValue({
        response: { data: { error: 'Failed to complete admission form' } }
      });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      const counselorNotesInput = screen.getByLabelText(/counselor notes/i);
      await userEvent.type(counselorNotesInput, 'Test notes');

      const submitButton = screen.getByRole('button', { name: /complete form/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to complete admission form/i)).toBeInTheDocument();
      });
    });

    it('should show loading state during submission', async () => {
      const { updateAdmissionSlip, getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        violation_type_id: 1,
        violation_description: 'Test violation',
        status: 'draft'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      updateAdmissionSlip.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      const counselorNotesInput = screen.getByLabelText(/counselor notes/i);
      await userEvent.type(counselorNotesInput, 'Test notes');

      const submitButton = screen.getByRole('button', { name: /complete form/i });
      await userEvent.click(submitButton);

      expect(screen.getByText(/completing form/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Student Information Update', () => {
    it('should allow updating student information', async () => {
      const { getStudents, updateAdmissionSlip, getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_id: null, // No student linked yet
        student_name: 'John Doe',
        student_id_number: '2024-001',
        status: 'draft'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      const mockStudents = [
        { id: 1, studentId: '2024-001', firstName: 'John', lastName: 'Doe', course: 'Computer Science' }
      ];
      getStudents.mockResolvedValue({ data: mockStudents });

      updateAdmissionSlip.mockResolvedValue({
        data: { id: 1, student_id: 1 }
      });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/update student information/i)).toBeInTheDocument();
      });

      const updateStudentButton = screen.getByText(/update student information/i);
      await userEvent.click(updateStudentButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/search student/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/search student/i);
      await userEvent.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(updateAdmissionSlip).toHaveBeenCalledWith(1, {
          student_id: 1,
          student_name: 'John Doe',
          student_id_number: '2024-001'
        });
      });
    });
  });

  describe('Form Reset', () => {
    it('should reset form after successful completion', async () => {
      const { updateAdmissionSlip, getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        violation_type_id: 1,
        violation_description: 'Test violation',
        status: 'draft'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      updateAdmissionSlip.mockResolvedValue({
        data: { id: 1, status: 'completed' }
      });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      const counselorNotesInput = screen.getByLabelText(/counselor notes/i);
      await userEvent.type(counselorNotesInput, 'Test notes');

      const submitButton = screen.getByRole('button', { name: /complete form/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/admission form completed successfully/i)).toBeInTheDocument();
      });

      // Check if navigation occurs after completion
      expect(mockNavigate).toHaveBeenCalledWith('/admission-slips');
    });
  });

  describe('Navigation', () => {
    it('should navigate back to admission slips list', async () => {
      const { getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        status: 'draft'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to slips/i })).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /back to slips/i });
      await userEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/admission-slips');
    });

    it('should navigate to print slip', async () => {
      const { getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        status: 'printed'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /print slip/i })).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print slip/i });
      await userEvent.click(printButton);

      expect(mockNavigate).toHaveBeenCalledWith(`/print-slip/${mockSlip.id}`);
    });
  });

  describe('Status Display', () => {
    it('should show correct status badge', async () => {
      const { getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const statuses = ['draft', 'printed', 'completed', 'cancelled'];
      
      for (const status of statuses) {
        const mockSlip = {
          id: 1,
          student_name: 'John Doe',
          status: status
        };

        getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
        getViolationTypes.mockResolvedValue({ data: [] });
        getCourses.mockResolvedValue({ data: [] });
        getYearLevels.mockResolvedValue({ data: [] });
        getSections.mockResolvedValue({ data: [] });

        const { unmount } = render(
          <TestWrapper>
            <CompleteForm />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByText(status.toUpperCase())).toBeInTheDocument();
        });

        unmount();
      }
    });

    it('should show completion timestamp for completed forms', async () => {
      const { getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        status: 'completed',
        completed_at: '2024-01-20T14:30:00Z',
        completed_by: 'Test Counselor'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/completed on:/i)).toBeInTheDocument();
        expect(screen.getByText(/completed by:/i)).toBeInTheDocument();
        expect(screen.getByText('Test Counselor')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const { getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        status: 'draft'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Complete Admission Form');
      });

      // Check form fields have proper labels
      expect(screen.getByLabelText(/counselor notes/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/follow up actions/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const { getAdmissionSlipById, getViolationTypes, getCourses, getYearLevels, getSections } = require('../../services/api');
      
      const mockSlip = {
        id: 1,
        student_name: 'John Doe',
        status: 'draft'
      };

      getAdmissionSlipById.mockResolvedValue({ data: mockSlip });
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getSections.mockResolvedValue({ data: [] });

      render(
        <TestWrapper>
          <CompleteForm />
        </TestWrapper>
      );

      await waitFor(() => {
        const counselorNotesInput = screen.getByLabelText(/counselor notes/i);
        counselorNotesInput.focus();
        expect(counselorNotesInput).toHaveFocus();

        userEvent.tab();
        expect(screen.getByLabelText(/follow up actions/i)).toHaveFocus();
      });
    });
  });
});
