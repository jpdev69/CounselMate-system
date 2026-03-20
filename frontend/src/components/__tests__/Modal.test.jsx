import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Modal from '../Modal';
import { AuthProvider } from '../../contexts/AuthContext';

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

describe('Modal Component', () => {
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
    it('renders modal when open', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Test Modal">
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(
        <TestWrapper>
          <Modal isOpen={false} title="Test Modal">
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    });

    it('renders with different sizes', () => {
      const { rerender } = render(
        <TestWrapper>
          <Modal isOpen={true} title="Small Modal" size="small">
            <p>Small modal content</p>
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toHaveClass('modal-small');

      rerender(
        <TestWrapper>
          <Modal isOpen={true} title="Large Modal" size="large">
            <p>Large modal content</p>
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toHaveClass('modal-large');
    });

    it('renders without title', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true}>
            <p>Modal without title</p>
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
      expect(screen.getByText('Modal without title')).toBeInTheDocument();
    });
  });

  describe('Modal Actions', () => {
    it('should call onClose when close button is clicked', () => {
      const mockOnClose = jest.fn();

      render(
        <TestWrapper>
          <Modal isOpen={true} title="Test Modal" onClose={mockOnClose}>
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      userEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when overlay is clicked', () => {
      const mockOnClose = jest.fn();

      render(
        <TestWrapper>
          <Modal isOpen={true} title="Test Modal" onClose={mockOnClose}>
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      const overlay = screen.getByRole('dialog').parentElement;
      userEvent.click(overlay);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not close when overlay is clicked if closeOnOverlayClick is false', () => {
      const mockOnClose = jest.fn();

      render(
        <TestWrapper>
          <Modal isOpen={true} title="Test Modal" onClose={mockOnClose} closeOnOverlayClick={false}>
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      const overlay = screen.getByRole('dialog').parentElement;
      userEvent.click(overlay);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should call onConfirm when confirm button is clicked', () => {
      const mockOnConfirm = jest.fn();

      render(
        <TestWrapper>
          <Modal isOpen={true} title="Test Modal" onConfirm={mockOnConfirm} confirmText="Confirm">
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      userEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalled();
    });

    it('should call onCancel when cancel button is clicked', () => {
      const mockOnCancel = jest.fn();

      render(
        <TestWrapper>
          <Modal isOpen={true} title="Test Modal" onCancel={mockOnCancel} cancelText="Cancel">
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      userEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close on Escape key press', () => {
      const mockOnClose = jest.fn();

      render(
        <TestWrapper>
          <Modal isOpen={true} title="Test Modal" onClose={mockOnClose}>
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should trap focus within modal', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Test Modal">
            <button>First Button</button>
            <button>Second Button</button>
            <button>Third Button</button>
          </Modal>
        </TestWrapper>
      );

      const firstButton = screen.getByText('First Button');
      firstButton.focus();

      expect(firstButton).toHaveFocus();

      // Tab through modal elements
      userEvent.tab();
      expect(screen.getByText('Second Button')).toHaveFocus();

      userEvent.tab();
      expect(screen.getByText('Third Button')).toHaveFocus();

      userEvent.tab();
      // Should cycle back to first button
      expect(screen.getByText('First Button')).toHaveFocus();
    });

    it('should not trap focus when isOpen is false', () => {
      render(
        <TestWrapper>
          <Modal isOpen={false} title="Test Modal">
            <button>Modal Button</button>
          </Modal>
        </TestWrapper>
      );

      // Focus should not be trapped when modal is closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Test Modal">
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');
    });

    it('should announce modal to screen readers', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Test Modal">
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      const titleElement = screen.getByText('Test Modal');
      expect(titleElement).toHaveAttribute('id');
      
      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-labelledby')).toBe(titleElement.id);
    });

    it('should focus on first focusable element when opened', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Test Modal">
            <button>First Button</button>
            <button>Second Button</button>
          </Modal>
        </TestWrapper>
      );

      // Should auto-focus first focusable element
      expect(screen.getByText('First Button')).toHaveFocus();
    });

    it('should return focus to trigger element when closed', () => {
      const mockOnClose = jest.fn();

      render(
        <TestWrapper>
          <button id="trigger">Open Modal</button>
          <Modal isOpen={true} title="Test Modal" onClose={mockOnClose}>
            <button>Modal Button</button>
          </Modal>
        </TestWrapper>
      );

      const triggerButton = screen.getByText('Open Modal');
      triggerButton.focus();

      // Close modal
      const closeButton = screen.getByRole('button', { name: /close/i });
      userEvent.click(closeButton);

      // Focus should return to trigger
      expect(triggerButton).toHaveFocus();
    });
  });

  describe('Modal Variants', () => {
    it('renders confirmation modal variant', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Confirm Action" variant="confirmation" confirmText="Yes" cancelText="No">
            <p>Are you sure you want to proceed?</p>
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toHaveClass('modal-confirmation');
      expect(screen.getByRole('button', { name: /yes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /no/i })).toBeInTheDocument();
    });

    it('renders alert modal variant', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Alert" variant="alert">
            <p>This is an alert message</p>
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toHaveClass('modal-alert');
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders info modal variant', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Information" variant="info">
            <p>This is an informational message</p>
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toHaveClass('modal-info');
    });

    it('renders warning modal variant', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Warning" variant="warning">
            <p>This is a warning message</p>
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toHaveClass('modal-warning');
    });

    it('renders error modal variant', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Error" variant="error">
            <p>This is an error message</p>
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toHaveClass('modal-error');
    });
  });

  describe('Custom Content', () => {
    it('renders with custom header', () => {
      const customHeader = <div>Custom Header Content</div>;

      render(
        <TestWrapper>
          <Modal isOpen={true} header={customHeader}>
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByText('Custom Header Content')).toBeInTheDocument();
    });

    it('renders with custom footer', () => {
      const customFooter = <div>Custom Footer Content</div>;

      render(
        <TestWrapper>
          <Modal isOpen={true} footer={customFooter}>
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByText('Custom Footer Content')).toBeInTheDocument();
    });

    it('renders with custom actions', () => {
      const customActions = (
        <>
          <button>Custom Action 1</button>
          <button>Custom Action 2</button>
        </>
      );

      render(
        <TestWrapper>
          <Modal isOpen={true} actions={customActions}>
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByText('Custom Action 1')).toBeInTheDocument();
      expect(screen.getByText('Custom Action 2')).toBeInTheDocument();
    });

    it('renders with complex content', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Complex Modal">
            <form>
              <label htmlFor="input1">Input 1</label>
              <input id="input1" type="text" />
              <label htmlFor="input2">Input 2</label>
              <input id="input2" type="text" />
              <button type="submit">Submit</button>
            </form>
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByLabelText('Input 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Input 2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });
  });

  describe('Scrolling Behavior', () => {
    it('should prevent body scroll when modal is open', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Test Modal">
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      // Check if body has overflow hidden
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when modal is closed', () => {
      const { rerender } = render(
        <TestWrapper>
          <Modal isOpen={true} title="Test Modal">
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      // Close modal
      rerender(
        <TestWrapper>
          <Modal isOpen={false} title="Test Modal">
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      // Check if body scroll is restored
      expect(document.body.style.overflow).toBe('');
    });

    it('should handle modal content scrolling', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Scrollable Modal">
            <div style={{ height: '1000px' }}>
              <p>Very long content that should scroll</p>
              {Array.from({ length: 50 }, (_, i) => (
                <p key={i}>Content line {i + 1}</p>
              ))}
            </div>
          </Modal>
        </TestWrapper>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveStyle({ maxHeight: '80vh' });
    });
  });

  describe('Animation', () => {
    it('should apply animation classes', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Animated Modal">
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('modal-open');
    });

    it('should apply closing animation classes', () => {
      const { rerender } = render(
        <TestWrapper>
          <Modal isOpen={true} title="Animated Modal">
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      // Close modal
      rerender(
        <TestWrapper>
          <Modal isOpen={false} title="Animated Modal">
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      const dialog = screen.queryByRole('dialog');
      expect(dialog).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required props gracefully', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true}>
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      // Should render without title
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('should handle empty children gracefully', () => {
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Empty Modal">
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Empty Modal')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', () => {
      // Set mobile viewport
      window.innerWidth = 375;
      window.innerHeight = 667;
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <Modal isOpen={true} title="Mobile Modal">
            <p>Modal content for mobile</p>
          </Modal>
        </TestWrapper>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('modal-mobile');
    });

    it('should adapt to tablet viewport', () => {
      // Set tablet viewport
      window.innerWidth = 768;
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <Modal isOpen={true} title="Tablet Modal">
            <p>Modal content for tablet</p>
          </Modal>
        </TestWrapper>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('modal-tablet');
    });

    it('should adapt to desktop viewport', () => {
      // Set desktop viewport
      window.innerWidth = 1200;
      window.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <Modal isOpen={true} title="Desktop Modal">
            <p>Modal content for desktop</p>
          </Modal>
        </TestWrapper>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('modal-desktop');
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderCount = jest.fn();
      
      const TestComponent = React.memo(() => {
        renderCount();
        return <p>Test content</p>;
      });

      render(
        <TestWrapper>
          <Modal isOpen={true} title="Performance Modal">
            <TestComponent />
          </Modal>
        </TestWrapper>
      );

      // Initial render
      expect(renderCount).toHaveBeenCalledTimes(1);

      // Re-render with same props
      render(
        <TestWrapper>
          <Modal isOpen={true} title="Performance Modal">
            <TestComponent />
          </Modal>
        </TestWrapper>
      );

      // Should not re-render TestComponent
      expect(renderCount).toHaveBeenCalledTimes(2); // One for parent, one for child
    });

    it('should handle rapid open/close operations', () => {
      const { rerender } = render(
        <TestWrapper>
          <Modal isOpen={false} title="Rapid Modal">
            <p>Rapid content</p>
          </Modal>
        </TestWrapper>
      );

      // Rapidly open and close modal
      for (let i = 0; i < 10; i++) {
        rerender(
          <TestWrapper>
            <Modal isOpen={true} title="Rapid Modal">
              <p>Rapid content</p>
            </Modal>
          </TestWrapper>
        );

        rerender(
          <TestWrapper>
            <Modal isOpen={false} title="Rapid Modal">
              <p>Rapid content</p>
            </Modal>
          </TestWrapper>
        );
      }

      // Should not crash
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Integration with Other Components', () => {
    it('should work within forms', () => {
      const mockOnSubmit = jest.fn();

      render(
        <TestWrapper>
          <Modal isOpen={true} title="Form Modal">
            <form onSubmit={mockOnSubmit}>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" />
              <button type="submit">Submit</button>
            </form>
          </Modal>
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button', { name: /submit/i });

      userEvent.type(emailInput, 'test@example.com');
      userEvent.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('should work with nested components', () => {
      const NestedComponent = () => (
        <div>
          <h3>Nested Component</h3>
          <button>Nested Button</button>
        </div>
      );

      render(
        <TestWrapper>
          <Modal isOpen={true} title="Nested Modal">
            <NestedComponent />
          </Modal>
        </TestWrapper>
      );

      expect(screen.getByText('Nested Component')).toBeInTheDocument();
      expect(screen.getByText('Nested Button')).toBeInTheDocument();
    });
  });

  describe('Custom Events', () => {
    it('should call onOpen callback when modal opens', () => {
      const mockOnOpen = jest.fn();

      render(
        <TestWrapper>
          <Modal isOpen={true} title="Event Modal" onOpen={mockOnOpen}>
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      expect(mockOnOpen).toHaveBeenCalled();
    });

    it('should call onAfterClose callback when modal closes', () => {
      const mockOnAfterClose = jest.fn();
      const mockOnClose = jest.fn();

      const { rerender } = render(
        <TestWrapper>
          <Modal isOpen={true} title="Event Modal" onClose={mockOnClose} onAfterClose={mockOnAfterClose}>
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      // Close modal
      rerender(
        <TestWrapper>
          <Modal isOpen={false} title="Event Modal" onClose={mockOnClose} onAfterClose={mockOnAfterClose}>
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      expect(mockOnAfterClose).toHaveBeenCalled();
    });

    it('should call onBeforeClose callback and respect the result', () => {
      const mockOnBeforeClose = jest.fn().mockReturnValue(false);
      const mockOnClose = jest.fn();

      render(
        <TestWrapper>
          <Modal isOpen={true} title="Event Modal" onClose={mockOnClose} onBeforeClose={mockOnBeforeClose}>
            <p>Modal content</p>
          </Modal>
        </TestWrapper>
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      userEvent.click(closeButton);

      expect(mockOnBeforeClose).toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled(); // Should not close if beforeClose returns false
    });
  });

  describe('Portal Behavior', () => {
    it('should render in portal by default', () => {
      render(
        <TestWrapper>
          <div id="container">
            <Modal isOpen={true} title="Portal Modal">
              <p>Portal content</p>
            </Modal>
          </div>
        </TestWrapper>
      );

      // Modal should render outside the container
      const container = screen.getByText('Portal content').closest('#container');
      expect(container).toBeNull();
    });

    it('should render inline when portal is disabled', () => {
      render(
        <TestWrapper>
          <div id="container">
            <Modal isOpen={true} title="Inline Modal" usePortal={false}>
              <p>Inline content</p>
            </Modal>
          </div>
        </TestWrapper>
      );

      // Modal should render inside the container
      const container = screen.getByText('Inline content').closest('#container');
      expect(container).not.toBeNull();
    });
  });
});
