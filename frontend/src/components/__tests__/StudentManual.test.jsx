import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import StudentManual from '../StudentManual';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
jest.mock('../../services/api', () => ({
  getStudentManual: jest.fn(),
  downloadStudentManual: jest.fn(),
  getStudentManualSections: jest.fn(),
  searchStudentManual: jest.fn(),
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

describe('StudentManual Component', () => {
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
    it('renders student manual correctly', async () => {
      const { getStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Isabela State University Student Manual',
        version: '2024-2025',
        last_updated: '2024-01-15T10:00:00Z',
        content: '# Student Manual\n\n## Introduction\n\nThis is the student manual...',
        sections: [
          {
            id: 1,
            title: 'Introduction',
            order: 1,
            content: 'This section introduces the student manual...'
          },
          {
            id: 2,
            title: 'Academic Policies',
            order: 2,
            content: 'Academic policies and procedures...'
          },
          {
            id: 3,
            title: 'Student Conduct',
            order: 3,
            content: 'Student conduct guidelines...'
          }
        ]
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/student manual/i)).toBeInTheDocument();
      });

      expect(screen.getByText('Isabela State University Student Manual')).toBeInTheDocument();
      expect(screen.getByText('Version: 2024-2025')).toBeInTheDocument();
      expect(screen.getByText('Introduction')).toBeInTheDocument();
      expect(screen.getByText('Academic Policies')).toBeInTheDocument();
      expect(screen.getByText('Student Conduct')).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      expect(screen.getByText(/loading student manual/i)).toBeInTheDocument();
    });

    it('displays error message when manual loading fails', async () => {
      const { getStudentManual } = require('../../services/api');
      
      getStudentManual.mockRejectedValue(new Error('Failed to load student manual'));

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load student manual/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('displays empty state when manual is not available', async () => {
      const { getStudentManual } = require('../../services/api');
      
      getStudentManual.mockResolvedValue({
        data: null
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/student manual not available/i)).toBeInTheDocument();
        expect(screen.getByText(/contact administrator/i)).toBeInTheDocument();
      });
    });
  });

  describe('Manual Content Display', () => {
    it('should render markdown content correctly', async () => {
      const { getStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        content: '# Main Title\n\n## Section 1\n\nThis is **bold** text and *italic* text.\n\n- Item 1\n- Item 2\n- Item 3\n\n### Subsection\n\nRegular paragraph with [link](http://example.com).'
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Main Title' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Section 1' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 3, name: 'Subsection' })).toBeInTheDocument();
        expect(screen.getByText('bold')).toBeInTheDocument();
        expect(screen.getByText('italic')).toBeInTheDocument();
        expect(screen.getByRole('list')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'link' })).toBeInTheDocument();
      });
    });

    it('should display table of contents', async () => {
      const { getStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        sections: [
          { id: 1, title: 'Introduction', order: 1 },
          { id: 2, title: 'Academic Policies', order: 2 },
          { id: 3, title: 'Student Conduct', order: 3 },
          { id: 4, title: 'Disciplinary Procedures', order: 4 }
        ]
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/table of contents/i)).toBeInTheDocument();
        expect(screen.getByText('Introduction')).toBeInTheDocument();
        expect(screen.getByText('Academic Policies')).toBeInTheDocument();
        expect(screen.getByText('Student Conduct')).toBeInTheDocument();
        expect(screen.getByText('Disciplinary Procedures')).toBeInTheDocument();
      });
    });

    it('should handle large manual content efficiently', async () => {
      const { getStudentManual } = require('../../services/api');
      
      const largeContent = '# Large Manual\n\n' + Array(1000).fill().map((_, i) => `## Section ${i + 1}\n\nContent for section ${i + 1}.\n\n`).join('');
      
      const mockManual = {
        id: 1,
        title: 'Large Student Manual',
        content: largeContent
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      const startTime = Date.now();

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Large Student Manual')).toBeInTheDocument();
      });

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      // Should render large content efficiently (less than 2 seconds)
      expect(renderTime).toBeLessThan(2000);
    });
  });

  describe('Navigation', () => {
    it('should navigate to sections using table of contents', async () => {
      const { getStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        sections: [
          { id: 1, title: 'Introduction', order: 1, content: 'Introduction content...' },
          { id: 2, title: 'Academic Policies', order: 2, content: 'Academic policies...' }
        ]
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Academic Policies')).toBeInTheDocument();
      });

      // Click on table of contents link
      const academicPoliciesLink = screen.getByText('Academic Policies');
      await userEvent.click(academicPoliciesLink);

      await waitFor(() => {
        // Should scroll to or highlight the section
        expect(screen.getByText('Academic policies...')).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      const { getStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        sections: [
          { id: 1, title: 'Introduction', order: 1 },
          { id: 2, title: 'Academic Policies', order: 2 }
        ]
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        const tocLink = screen.getByText('Academic Policies');
        tocLink.focus();
        expect(tocLink).toHaveFocus();

        userEvent.tab();
        // Should focus next interactive element
      });
    });
  });

  describe('Search Functionality', () => {
    it('should search within manual content', async () => {
      const { getStudentManual, searchStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        content: 'Introduction content with specific keyword...'
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      searchStudentManual.mockResolvedValue({
        data: [
          {
            section: 'Introduction',
            content: 'Introduction content with specific keyword...',
            matches: [
              { text: 'keyword', position: 30 }
            ]
          }
        ]
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/search manual/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/search manual/i);
      await userEvent.type(searchInput, 'keyword');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(searchStudentManual).toHaveBeenCalledWith('keyword');
        expect(screen.getByText(/search results/i)).toBeInTheDocument();
        expect(screen.getByText('keyword')).toBeInTheDocument();
      });
    });

    it('should highlight search results', async () => {
      const { getStudentManual, searchStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        content: 'This is a test content with search term highlighted.'
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      searchStudentManual.mockResolvedValue({
        data: [
          {
            section: 'Introduction',
            content: 'This is a test content with search term highlighted.',
            matches: [
              { text: 'search term', position: 25 }
            ]
          }
        ]
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      // Perform search
      const searchInput = screen.getByLabelText(/search manual/i);
      await userEvent.type(searchInput, 'search term');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        // Should highlight the search term
        const highlightedElement = screen.getByText('search term');
        expect(highlightedElement).toHaveClass('highlight');
      });
    });

    it('should handle no search results', async () => {
      const { getStudentManual, searchStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        content: 'Regular content...'
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      searchStudentManual.mockResolvedValue({
        data: []
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      const searchInput = screen.getByLabelText(/search manual/i);
      await userEvent.type(searchInput, 'nonexistent');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText(/no results found/i)).toBeInTheDocument();
        expect(screen.getByText(/try different keywords/i)).toBeInTheDocument();
      });
    });
  });

  describe('Download Functionality', () => {
    it('should download manual as PDF', async () => {
      const { getStudentManual, downloadStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        content: 'Manual content...'
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      downloadStudentManual.mockResolvedValue({
        data: { success: true, downloadUrl: '/api/downloads/student_manual.pdf' }
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
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /download pdf/i });
      await userEvent.click(downloadButton);

      await waitFor(() => {
        expect(downloadStudentManual).toHaveBeenCalledWith('pdf');
        expect(mockLink.click).toHaveBeenCalled();
        expect(mockLink.download).toContain('student_manual.pdf');
      });
    });

    it('should download manual as Word document', async () => {
      const { getStudentManual, downloadStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        content: 'Manual content...'
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      downloadStudentManual.mockResolvedValue({
        data: { success: true, downloadUrl: '/api/downloads/student_manual.docx' }
      });

      const mockLink = { click: jest.fn() };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
      jest.spyOn(document.body, 'appendChild').mockImplementation();
      jest.spyOn(document.body, 'removeChild').mockImplementation();

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download word/i })).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /download word/i });
      await userEvent.click(downloadButton);

      await waitFor(() => {
        expect(downloadStudentManual).toHaveBeenCalledWith('docx');
        expect(mockLink.click).toHaveBeenCalled();
      });
    });

    it('should handle download errors', async () => {
      const { getStudentManual, downloadStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        content: 'Manual content...'
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      downloadStudentManual.mockRejectedValue({
        response: { data: { error: 'Download failed' } }
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      const downloadButton = screen.getByRole('button', { name: /download pdf/i });
      await userEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText(/download failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Print Functionality', () => {
    it('should open print dialog', async () => {
      const { getStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        content: 'Manual content...'
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      // Mock window.print
      const mockPrint = jest.fn();
      Object.defineProperty(window, 'print', {
        value: mockPrint,
        writable: true,
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await userEvent.click(printButton);

      expect(mockPrint).toHaveBeenCalled();
    });

    it('should show print preview', async () => {
      const { getStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        content: 'Manual content...'
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /print preview/i })).toBeInTheDocument();
      });

      const printPreviewButton = screen.getByRole('button', { name: /print preview/i });
      await userEvent.click(printPreviewButton);

      await waitFor(() => {
        expect(screen.getByText(/print preview/i)).toBeInTheDocument();
        expect(screen.getByText('Student Manual')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      const { getStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        content: 'Manual content...'
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      // Set mobile viewport
      window.innerWidth = 375;
      window.innerHeight = 667;
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Student Manual')).toBeInTheDocument();
      });

      // Check mobile-specific elements
      expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
    });

    it('should show collapsible table of contents on mobile', async () => {
      const { getStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        sections: [
          { id: 1, title: 'Introduction', order: 1 },
          { id: 2, title: 'Academic Policies', order: 2 }
        ]
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      // Set mobile viewport
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /table of contents/i })).toBeInTheDocument();
      });

      const tocButton = screen.getByRole('button', { name: /table of contents/i });
      await userEvent.click(tocButton);

      await waitFor(() => {
        expect(screen.getByText('Introduction')).toBeInTheDocument();
        expect(screen.getByText('Academic Policies')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const { getStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        content: 'Manual content...'
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Student Manual Content');
      });

      // Check navigation elements
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Manual Navigation');
      expect(screen.getByLabelText(/search manual/i)).toBeInTheDocument();
    });

    it('should support screen readers', async () => {
      const { getStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        content: '# Main Title\n\nThis is important content.'
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        // Check proper heading hierarchy
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
        expect(screen.getByText('This is important content.')).toBeInTheDocument();
      });
    });

    it('should announce search results to screen readers', async () => {
      const { getStudentManual, searchStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        content: 'Content with keyword...'
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      searchStudentManual.mockResolvedValue({
        data: [
          {
            section: 'Introduction',
            content: 'Content with keyword...',
            matches: [{ text: 'keyword', position: 10 }]
          }
        ]
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      const searchInput = screen.getByLabelText(/search manual/i);
      await userEvent.type(searchInput, 'keyword');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        const searchResults = screen.getByText(/search results/i);
        expect(searchResults).toHaveAttribute('role', 'status');
        expect(searchResults).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('Error Handling', () => {
    it('should retry loading manual', async () => {
      const { getStudentManual } = require('../../services/api');
      
      getStudentManual
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: { id: 1, title: 'Student Manual', content: 'Content...' }
        });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Student Manual')).toBeInTheDocument();
      });
    });

    it('should handle corrupted content gracefully', async () => {
      const { getStudentManual } = require('../../services/api');
      
      getStudentManual.mockResolvedValue({
        data: {
          id: 1,
          title: 'Student Manual',
          content: null // Corrupted content
        }
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/manual content is corrupted/i)).toBeInTheDocument();
        expect(screen.getByText(/please contact administrator/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Controls', () => {
    it('should navigate back to dashboard', async () => {
      const { getStudentManual } = require('../../services/api');
      
      const mockManual = {
        id: 1,
        title: 'Student Manual',
        content: 'Content...'
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      await userEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should show reading progress', async () => {
      const { getStudentManual } = require('../../services/api');
      
      const largeContent = '# Large Manual\n\n' + Array(100).fill().map((_, i) => `## Section ${i + 1}\n\nContent for section ${i + 1}.\n\n`).join('');
      
      const mockManual = {
        id: 1,
        title: 'Large Student Manual',
        content: largeContent
      };

      getStudentManual.mockResolvedValue({
        data: mockManual
      });

      render(
        <TestWrapper>
          <StudentManual />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/reading progress/i)).toBeInTheDocument();
      });

      // Simulate scrolling
      fireEvent.scroll(window, { target: { scrollY: 1000 } });

      await waitFor(() => {
        expect(screen.getByText(/\d+% complete/i)).toBeInTheDocument();
      });
    });
  });
});
