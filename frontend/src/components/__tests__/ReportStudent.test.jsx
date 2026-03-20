import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ReportStudent from '../ReportStudent';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  getViolationTypes: jest.fn(),
  getStudents: jest.fn(),
  createStudentReport: jest.fn(),
  getCourses: jest.fn(),
  getYearLevels: jest.fn(),
  getSections: jest.fn(),
  getOverrideSetting: jest.fn(),
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

describe('ReportStudent Component', () => {
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
    it('renders report student form correctly', async () => {
      const { getViolationTypes, getCourses, getYearLevels, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({
        data: [
          { id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform', category: 'minor' },
          { id: 2, code: 'DRUGS_ALCOHOL_WEAPONS', description: 'Possession of prohibited items', category: 'major' }
        ]
      });
      
      getCourses.mockResolvedValue({ data: [{ id: 1, name: 'Computer Science' }] });
      getYearLevels.mockResolvedValue({ data: [{ id: 1, name: '1st Year' }] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: true } });

      render(
        <TestWrapper>
          <ReportStudent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/report student violation/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/violation type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/remarks/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit report/i })).toBeInTheDocument();
    });

    it('shows loading states initially', () => {
      render(
        <TestWrapper>
          <ReportStudent />
        </TestWrapper>
      );

      expect(screen.getByText(/loading violation types/i)).toBeInTheDocument();
    });

    it('displays error message when data loading fails', async () => {
      const { getViolationTypes } = require('../../services/api');
      getViolationTypes.mockRejectedValue(new Error('Failed to load'));

      render(
        <TestWrapper>
          <ReportStudent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load violation types/i)).toBeInTheDocument();
      });
    });
  });

  describe('Student Search Functionality', () => {
    it('should search for existing students', async () => {
      const { getStudents, getViolationTypes, getCourses, getYearLevels, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: true } });

      const mockStudents = [
        { id: 1, studentId: '2024-001', firstName: 'John', lastName: 'Doe', course: 'Computer Science' },
        { id: 2, studentId: '2024-002', firstName: 'Jane', lastName: 'Smith', course: 'Psychology' }
      ];

      getStudents.mockResolvedValue({ data: mockStudents });

      render(
        <TestWrapper>
          <ReportStudent />
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

    it('should display search results', async () => {
      const { getStudents, getViolationTypes, getCourses, getYearLevels, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: true } });

      const mockStudents = [
        { id: 1, studentId: '2024-001', firstName: 'John', lastName: 'Doe', course: 'Computer Science' }
      ];

      getStudents.mockResolvedValue({ data: mockStudents });

      render(
        <TestWrapper>
          <ReportStudent />
        </TestWrapper>
      );

      const searchInput = screen.getByLabelText(/search student/i);
      await userEvent.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('2024-001')).toBeInTheDocument();
      });
    });

    it('should allow manual student entry when override is enabled', async () => {
      const { getViolationTypes, getCourses, getYearLevels, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: true } });

      render(
        <TestWrapper>
          <ReportStudent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/enter student manually/i)).toBeInTheDocument();
      });

      const manualEntryButton = screen.getByText(/enter student manually/i);
      await userEvent.click(manualEntryButton);

      expect(screen.getByLabelText(/student id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const { getViolationTypes, getCourses, getYearLevels, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: true } });

      render(
        <TestWrapper>
          <ReportStudent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit report/i })).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /submit report/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/violation type is required/i)).toBeInTheDocument();
        expect(screen.getByText(/description is required/i)).toBeInTheDocument();
        expect(screen.getByText(/student information is required/i)).toBeInTheDocument();
      });
    });

    it('should validate description length', async () => {
      const { getViolationTypes, getCourses, getYearLevels, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [{ id: 1, code: 'TEST', description: 'Test violation' }] });
      getCourses.mockResolvedValue({ data: [{ id: 1, name: 'Computer Science' }] });
      getYearLevels.mockResolvedValue({ data: [{ id: 1, name: '1st Year' }] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: true } });

      render(
        <TestWrapper>
          <ReportStudent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      });

      const descriptionInput = screen.getByLabelText(/description/i);
      const longDescription = 'a'.repeat(1001); // Assuming max length is 1000
      
      await userEvent.type(descriptionInput, longDescription);

      await waitFor(() => {
        expect(screen.getByText(/description is too long/i)).toBeInTheDocument();
      });
    });

    it('should validate course/year/section when manual entry', async () => {
      const { getViolationTypes, getCourses, getYearLevels, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [{ id: 1, code: 'TEST', description: 'Test violation' }] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: true } });

      render(
        <TestWrapper>
          <ReportStudent />
        </TestWrapper>
      );

      // Enable manual entry
      const manualEntryButton = screen.getByText(/enter student manually/i);
      await userEvent.click(manualEntryButton);

      // Fill student info but not course/year/section
      await userEvent.type(screen.getByLabelText(/student id/i), '2024-001');
      await userEvent.type(screen.getByLabelText(/first name/i), 'John');
      await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');

      const submitButton = screen.getByRole('button', { name: /submit report/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/course is required/i)).toBeInTheDocument();
        expect(screen.getByText(/year level is required/i)).toBeInTheDocument();
        expect(screen.getByText(/section is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit report successfully with existing student', async () => {
      const { createStudentReport, getStudents, getViolationTypes, getCourses, getYearLevels, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ 
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform', category: 'minor' }] 
      });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: true } });

      const mockStudents = [
        { id: 1, studentId: '2024-001', firstName: 'John', lastName: 'Doe', course: 'Computer Science' }
      ];
      getStudents.mockResolvedValue({ data: mockStudents });

      createStudentReport.mockResolvedValue({
        data: { id: 1, status: 'reported' }
      });

      render(
        <TestWrapper>
          <ReportStudent />
        </TestWrapper>
      );

      // Search and select student
      await waitFor(() => {
        expect(screen.getByLabelText(/search student/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/search student/i);
      await userEvent.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('John Doe'));

      // Fill form
      await userEvent.selectOptions(screen.getByLabelText(/violation type/i), '1');
      await userEvent.type(screen.getByLabelText(/description/i), 'Student came without proper uniform');
      await userEvent.type(screen.getByLabelText(/remarks/i), 'First offense');

      // Submit
      const submitButton = screen.getByRole('button', { name: /submit report/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(createStudentReport).toHaveBeenCalledWith({
          student_id: 1,
          violation_type_id: 1,
          description: 'Student came without proper uniform',
          remarks: 'First offense',
          course: 'Computer Science'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/report submitted successfully/i)).toBeInTheDocument();
      });
    });

    it('should submit report successfully with manual student entry', async () => {
      const { createStudentReport, getViolationTypes, getCourses, getYearLevels, getSections, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ 
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform', category: 'minor' }] 
      });
      getCourses.mockResolvedValue({ data: [{ id: 1, name: 'Computer Science' }] });
      getYearLevels.mockResolvedValue({ data: [{ id: 1, name: '1st Year' }] });
      getSections.mockResolvedValue({ data: [{ id: 1, name: 'A' }] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: true } });

      createStudentReport.mockResolvedValue({
        data: { id: 1, status: 'reported' }
      });

      render(
        <TestWrapper>
          <ReportStudent />
        </TestWrapper>
      );

      // Enable manual entry
      const manualEntryButton = screen.getByText(/enter student manually/i);
      await userEvent.click(manualEntryButton);

      // Fill student information
      await userEvent.type(screen.getByLabelText(/student id/i), '2024-001');
      await userEvent.type(screen.getByLabelText(/first name/i), 'John');
      await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
      
      // Select course/year/section
      await userEvent.selectOptions(screen.getByLabelText(/course/i), '1');
      await userEvent.selectOptions(screen.getByLabelText(/year level/i), '1');
      await userEvent.selectOptions(screen.getByLabelText(/section/i), '1');

      // Fill violation details
      await userEvent.selectOptions(screen.getByLabelText(/violation type/i), '1');
      await userEvent.type(screen.getByLabelText(/description/i), 'Student came without proper uniform');
      await userEvent.type(screen.getByLabelText(/remarks/i), 'First offense');

      // Submit
      const submitButton = screen.getByRole('button', { name: /submit report/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(createStudentReport).toHaveBeenCalledWith({
          student_id: null, // Manual entry
          student_name: 'John Doe',
          student_id_number: '2024-001',
          course: 'Computer Science',
          year: '1st Year',
          section: 'A',
          violation_type_id: 1,
          description: 'Student came without proper uniform',
          remarks: 'First offense'
        });
      });
    });

    it('should handle submission errors', async () => {
      const { createStudentReport, getStudents, getViolationTypes, getCourses, getYearLevels, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [{ id: 1, code: 'TEST', description: 'Test violation' }] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: true } });

      const mockStudents = [
        { id: 1, studentId: '2024-001', firstName: 'John', lastName: 'Doe' }
      ];
      getStudents.mockResolvedValue({ data: mockStudents });

      createStudentReport.mockRejectedValue({
        response: { data: { error: 'Failed to create report' } }
      });

      render(
        <TestWrapper>
          <ReportStudent />
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
      await userEvent.type(screen.getByLabelText(/description/i), 'Test violation');

      const submitButton = screen.getByRole('button', { name: /submit report/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to create report/i)).toBeInTheDocument();
      });
    });
  });

  describe('Override Functionality', () => {
    it('should show override option when enabled', async () => {
      const { getViolationTypes, getCourses, getYearLevels, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: true } });

      render(
        <TestWrapper>
          <ReportStudent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/enter student manually/i)).toBeInTheDocument();
      });
    });

    it('should hide override option when disabled', async () => {
      const { getViolationTypes, getCourses, getYearLevels, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: false } });

      render(
        <TestWrapper>
          <ReportStudent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText(/enter student manually/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Dynamic Dropdown Loading', () => {
    it('should load sections when course and year are selected', async () => {
      const { getViolationTypes, getCourses, getYearLevels, getSections, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [{ id: 1, name: 'Computer Science' }] });
      getYearLevels.mockResolvedValue({ data: [{ id: 1, name: '1st Year' }] });
      getSections.mockResolvedValue({ data: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: true } });

      render(
        <TestWrapper>
          <ReportStudent />
        </TestWrapper>
      );

      // Enable manual entry
      const manualEntryButton = screen.getByText(/enter student manually/i);
      await userEvent.click(manualEntryButton);

      // Select course and year
      await userEvent.selectOptions(screen.getByLabelText(/course/i), '1');
      await userEvent.selectOptions(screen.getByLabelText(/year level/i), '1');

      await waitFor(() => {
        expect(getSections).toHaveBeenCalledWith({ courseId: 1, yearLevelId: 1 });
        expect(screen.getByLabelText(/section/i)).toBeInTheDocument();
      });
    });

    it('should show loading state while loading sections', async () => {
      const { getViolationTypes, getCourses, getYearLevels, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ data: [] });
      getCourses.mockResolvedValue({ data: [{ id: 1, name: 'Computer Science' }] });
      getYearLevels.mockResolvedValue({ data: [{ id: 1, name: '1st Year' }] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: true } });

      // Mock sections to return a promise that never resolves to test loading state
      const { getSections } = require('../../services/api');
      getSections.mockImplementation(() => new Promise(() => {}));

      render(
        <TestWrapper>
          <ReportStudent />
        </TestWrapper>
      );

      // Enable manual entry
      const manualEntryButton = screen.getByText(/enter student manually/i);
      await userEvent.click(manualEntryButton);

      // Select course and year
      await userEvent.selectOptions(screen.getByLabelText(/course/i), '1');
      await userEvent.selectOptions(screen.getByLabelText(/year level/i), '1');

      await waitFor(() => {
        expect(screen.getByText(/loading sections/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Reset', () => {
    it('should reset form after successful submission', async () => {
      const { createStudentReport, getStudents, getViolationTypes, getCourses, getYearLevels, getOverrideSetting } = require('../../services/api');
      
      getViolationTypes.mockResolvedValue({ 
        data: [{ id: 1, code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper uniform', category: 'minor' }] 
      });
      getCourses.mockResolvedValue({ data: [] });
      getYearLevels.mockResolvedValue({ data: [] });
      getOverrideSetting.mockResolvedValue({ data: { allowOverride: true } });

      const mockStudents = [
        { id: 1, studentId: '2024-001', firstName: 'John', lastName: 'Doe' }
      ];
      getStudents.mockResolvedValue({ data: mockStudents });

      createStudentReport.mockResolvedValue({
        data: { id: 1, status: 'reported' }
      });

      render(
        <TestWrapper>
          <ReportStudent />
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
      await userEvent.type(screen.getByLabelText(/description/i), 'Test violation');
      await userEvent.type(screen.getByLabelText(/remarks/i), 'Test remarks');

      const submitButton = screen.getByRole('button', { name: /submit report/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/report submitted successfully/i)).toBeInTheDocument();
      });

      // Check if form is reset
      expect(screen.getByLabelText(/search student/i)).toHaveValue('');
      expect(screen.getByLabelText(/description/i)).toHaveValue('');
      expect(screen.getByLabelText(/remarks/i)).toHaveValue('');
    });
  });
});
