describe('Authentication Flows', () => {
  beforeEach(() => {
    // Reset and seed the database before each test
    cy.task('db:seed');
    cy.visit('/');
  });

  describe('Login Flow', () => {
    it('should allow valid user to login', () => {
      cy.navigateTo('/login');
      
      // Fill in login form
      cy.get('[data-testid="email-input"]').type('counselor@example.com');
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="login-button"]').click();

      // Should redirect to dashboard
      cy.url().should('not.include', '/login');
      cy.url().should('include', '/');
      
      // Should show user info
      cy.get('[data-testid="user-name"]').should('contain', 'Test Counselor');
      cy.get('[data-testid="user-role"]').should('contain', 'counselor');
    });

    it('should allow admin user to login', () => {
      cy.navigateTo('/login');
      
      cy.get('[data-testid="email-input"]').type('admin@university.edu');
      cy.get('[data-testid="password-input"]').type('admin123');
      cy.get('[data-testid="login-button"]').click();

      // Should redirect to admin dashboard
      cy.url().should('include', '/admin');
      cy.get('[data-testid="admin-panel"]').should('be.visible');
    });

    it('should show error for invalid credentials', () => {
      cy.navigateTo('/login');
      
      cy.get('[data-testid="email-input"]').type('counselor@example.com');
      cy.get('[data-testid="password-input"]').type('wrongpassword');
      cy.get('[data-testid="login-button"]').click();

      // Should show error message
      cy.get('[data-testid="error-message"]').should('contain', 'Invalid email or password');
      cy.url().should('include', '/login');
    });

    it('should show validation errors for empty fields', () => {
      cy.navigateTo('/login');
      
      cy.get('[data-testid="login-button"]').click();

      cy.get('[data-testid="email-error"]').should('contain', 'Email is required');
      cy.get('[data-testid="password-error"]').should('contain', 'Password is required');
    });

    it('should show validation error for invalid email format', () => {
      cy.navigateTo('/login');
      
      cy.get('[data-testid="email-input"]').type('invalid-email');
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="login-button"]').click();

      cy.get('[data-testid="email-error"]').should('contain', 'valid email address');
    });

    it('should handle rate limiting', () => {
      cy.navigateTo('/login');
      
      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        cy.get('[data-testid="email-input"]').clear().type('counselor@example.com');
        cy.get('[data-testid="password-input"]').clear().type('wrongpassword');
        cy.get('[data-testid="login-button"]').click();
        cy.wait(100);
      }

      // Should show rate limiting message
      cy.get('[data-testid="error-message"]').should('contain', 'Too many attempts');
    });

    it('should navigate to forgot password', () => {
      cy.navigateTo('/login');
      
      cy.get('[data-testid="forgot-password-link"]').click();
      cy.url().should('include', '/forgot-password');
      cy.checkPageTitle('Forgot Password');
    });

    it('should navigate to signup request', () => {
      cy.navigateTo('/login');
      
      cy.get('[data-testid="signup-request-link"]').click();
      cy.url().should('include', '/signup-request');
      cy.checkPageTitle('Request Access');
    });
  });

  describe('Logout Flow', () => {
    beforeEach(() => {
      cy.loginAsCounselor();
    });

    it('should allow user to logout', () => {
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="logout-button"]').click();

      // Should redirect to login
      cy.url().should('include', '/login');
      
      // Should clear session storage
      cy.window().then((win) => {
        expect(win.sessionStorage.getItem('authToken')).to.be.null;
        expect(win.sessionStorage.getItem('userData')).to.be.null;
      });
    });

    it('should handle session expiration', () => {
      // Simulate token expiration
      cy.window().then((win) => {
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6ImNvdW5zZWxvciIsImV4cCI6MX0.invalid';
        win.sessionStorage.setItem('authToken', expiredToken);
      });

      // Try to access protected route
      cy.visit('/dashboard');
      
      // Should redirect to login
      cy.url().should('include', '/login');
    });
  });

  describe('Password Change Flow', () => {
    beforeEach(() => {
      cy.loginAsCounselor();
      cy.navigateTo('/change-password');
    });

    it('should allow user to change password', () => {
      cy.get('[data-testid="current-password-input"]').type('password123');
      cy.get('[data-testid="new-password-input"]').type('NewPassword123!');
      cy.get('[data-testid="confirm-password-input"]').type('NewPassword123!');
      cy.get('[data-testid="change-password-button"]').click();

      // Should show success message
      cy.checkToast('Password changed successfully', 'success');
      
      // Should redirect to dashboard
      cy.url().should('include', '/');
    });

    it('should validate password requirements', () => {
      cy.get('[data-testid="current-password-input"]').type('password123');
      cy.get('[data-testid="new-password-input"]').type('weak');
      cy.get('[data-testid="confirm-password-input"]').type('weak');
      cy.get('[data-testid="change-password-button"]').click();

      // Should show validation errors
      cy.get('[data-testid="password-error"]').should('contain', 'at least 6 characters');
      cy.get('[data-testid="password-error"]').should('contain', 'uppercase letter');
      cy.get('[data-testid="password-error"]').should('contain', 'special character');
    });

    it('should show error when passwords do not match', () => {
      cy.get('[data-testid="current-password-input"]').type('password123');
      cy.get('[data-testid="new-password-input"]').type('NewPassword123!');
      cy.get('[data-testid="confirm-password-input"]').type('DifferentPassword123!');
      cy.get('[data-testid="change-password-button"]').click();

      cy.get('[data-testid="confirm-password-error"]').should('contain', 'passwords do not match');
    });

    it('should show error for incorrect current password', () => {
      cy.get('[data-testid="current-password-input"]').type('wrongpassword');
      cy.get('[data-testid="new-password-input"]').type('NewPassword123!');
      cy.get('[data-testid="confirm-password-input"]').type('NewPassword123!');
      cy.get('[data-testid="change-password-button"]').click();

      cy.get('[data-testid="current-password-error"]').should('contain', 'Current password is incorrect');
    });

    it('should toggle password visibility', () => {
      const passwordInput = cy.get('[data-testid="current-password-input"]');
      
      // Initially should be password type
      passwordInput.should('have.attr', 'type', 'password');
      
      // Click toggle button
      cy.get('[data-testid="toggle-current-password"]').click();
      passwordInput.should('have.attr', 'type', 'text');
      
      // Click again to hide
      cy.get('[data-testid="toggle-current-password"]').click();
      passwordInput.should('have.attr', 'type', 'password');
    });
  });

  describe('Signup Request Flow', () => {
    it('should allow new user to request access', () => {
      cy.navigateTo('/signup-request');
      
      cy.get('[data-testid="email-input"]').type('newuser@gmail.com');
      cy.get('[data-testid="full-name-input"]').type('New User');
      cy.get('[data-testid="reason-input"]').type('I need access to the counseling system for my work');
      cy.get('[data-testid="submit-request-button"]').click();

      // Should show success message
      cy.checkToast('Signup request submitted successfully', 'success');
      
      // Should redirect to login
      cy.url().should('include', '/login');
    });

    it('should validate signup request form', () => {
      cy.navigateTo('/signup-request');
      
      cy.get('[data-testid="submit-request-button"]').click();

      cy.checkValidationErrors([
        ['email', 'Email is required'],
        ['full-name', 'Full name is required'],
        ['reason', 'Reason is required']
      ]);
    });

    it('should reject non-Gmail addresses', () => {
      cy.navigateTo('/signup-request');
      
      cy.get('[data-testid="email-input"]').type('newuser@yahoo.com');
      cy.get('[data-testid="full-name-input"]').type('New User');
      cy.get('[data-testid="reason-input"]').type('I need access');
      cy.get('[data-testid="submit-request-button"]').click();

      cy.get('[data-testid="email-error"]').should('contain', 'Only Gmail addresses are allowed');
    });

    it('should reject duplicate email requests', () => {
      cy.navigateTo('/signup-request');
      
      // Submit first request
      cy.get('[data-testid="email-input"]').type('newuser@gmail.com');
      cy.get('[data-testid="full-name-input"]').type('New User');
      cy.get('[data-testid="reason-input"]').type('I need access');
      cy.get('[data-testid="submit-request-button"]').click();
      
      cy.wait(1000);
      
      // Try to submit again
      cy.visit('/signup-request');
      cy.get('[data-testid="email-input"]').type('newuser@gmail.com');
      cy.get('[data-testid="full-name-input"]').type('New User');
      cy.get('[data-testid="reason-input"]').type('I need access');
      cy.get('[data-testid="submit-request-button"]').click();

      cy.get('[data-testid="error-message"]').should('contain', 'already pending');
    });
  });

  describe('Protected Routes', () => {
    it('should redirect unauthenticated users to login', () => {
      const protectedRoutes = [
        '/dashboard',
        '/print-slip',
        '/complete-form',
        '/search',
        '/student-manual',
        '/change-password'
      ];

      protectedRoutes.forEach(route => {
        cy.visit(route);
        cy.url().should('include', '/login');
      });
    });

    it('should redirect non-admin users from admin routes', () => {
      cy.loginAsCounselor();
      
      const adminRoutes = [
        '/admin',
        '/admin/users',
        '/admin/settings'
      ];

      adminRoutes.forEach(route => {
        cy.visit(route);
        cy.url().should('not.include', '/admin');
        cy.url().should('include', '/');
      });
    });

    it('should allow admin users to access admin routes', () => {
      cy.loginAsAdmin();
      
      cy.visit('/admin');
      cy.url().should('include', '/admin');
      cy.get('[data-testid="admin-panel"]').should('be.visible');
    });
  });
});
