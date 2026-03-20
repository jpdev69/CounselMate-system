describe('Admin Panel Functionality', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
    cy.navigateTo('/admin');
  });

  describe('Admin Panel Layout', () => {
    it('should display admin panel components correctly', () => {
      cy.checkPageTitle('Admin Panel');
      cy.get('[data-testid="admin-dashboard"]').should('be.visible');
      
      // Check admin navigation
      const adminSections = [
        'users',
        'signup-requests',
        'settings',
        'analytics'
      ];

      adminSections.forEach(section => {
        cy.get(`[data-testid="${section}-section"]`).should('be.visible');
      });

      // Check admin role indicator
      cy.get('[data-testid="admin-badge"]').should('be.visible');
      cy.get('[data-testid="admin-badge"]').should('contain', 'Administrator');
    });

    it('should show admin-specific navigation', () => {
      const adminNavItems = [
        'dashboard',
        'users',
        'signup-requests',
        'settings',
        'logs'
      ];

      adminNavItems.forEach(item => {
        cy.get(`[data-testid="admin-nav-${item}"]`).should('be.visible');
      });
    });
  });

  describe('User Management', () => {
    beforeEach(() => {
      cy.get('[data-testid="admin-nav-users"]').click();
      cy.waitForLoading();
    });

    it('should display list of users', () => {
      // Mock users data
      cy.intercept('GET', '/api/admin/users', {
        body: {
          success: true,
          users: [
            {
              id: 1,
              email: 'admin@university.edu',
              full_name: 'Admin User',
              role: 'admin',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            },
            {
              id: 2,
              email: 'counselor@example.com',
              full_name: 'Test Counselor',
              role: 'counselor',
              created_at: '2024-01-02T00:00:00Z',
              updated_at: '2024-01-02T00:00:00Z'
            }
          ]
        }
      }).as('getUsers');

      cy.wait('@getUsers');

      // Check user table
      cy.get('[data-testid="users-table"]').should('be.visible');
      cy.get('[data-testid="user-row"]').should('have.length', 2);
      
      // Check user data
      cy.get('[data-testid="user-row"]').first().should('contain', 'admin@university.edu');
      cy.get('[data-testid="user-row"]').first().should('contain', 'Admin User');
      cy.get('[data-testid="user-row"]').first().should('contain', 'admin');
    });

    it('should allow admin to delete user', () => {
      // Mock users and delete API
      cy.intercept('GET', '/api/admin/users', {
        body: {
          success: true,
          users: [
            {
              id: 2,
              email: 'counselor@example.com',
              full_name: 'Test Counselor',
              role: 'counselor'
            }
          ]
        }
      }).as('getUsers');

      cy.intercept('DELETE', '/api/admin/users/2', {
        body: {
          success: true,
          message: 'User deleted successfully'
        }
      }).as('deleteUser');

      cy.wait('@getUsers');

      // Click delete button
      cy.get('[data-testid="delete-user-2"]').click();
      
      // Confirm deletion
      cy.get('[data-testid="confirm-delete"]').click();
      
      cy.wait('@deleteUser');

      // Should show success message
      cy.checkToast('User deleted successfully', 'success');
      
      // Should refresh user list
      cy.wait('@getUsers');
    });

    it('should prevent deletion of main admin account', () => {
      cy.intercept('GET', '/api/admin/users', {
        body: {
          success: true,
          users: [
            {
              id: 1,
              email: 'admin@university.edu',
              full_name: 'Admin User',
              role: 'admin'
            }
          ]
        }
      }).as('getUsers');

      cy.wait('@getUsers');

      // Delete button should be disabled for main admin
      cy.get('[data-testid="delete-user-1"]').should('be.disabled');
      
      // Or should show error when clicked
      cy.get('[data-testid="delete-user-1"]').click({ force: true });
      cy.get('[data-testid="error-message"]').should('contain', 'Cannot delete the main administrator account');
    });

    it('should allow admin to reset user password', () => {
      cy.intercept('GET', '/api/admin/users', {
        body: {
          success: true,
          users: [
            {
              id: 2,
              email: 'counselor@example.com',
              full_name: 'Test Counselor',
              role: 'counselor'
            }
          ]
        }
      }).as('getUsers');

      cy.intercept('PUT', '/api/admin/users/2/reset-password', {
        body: {
          success: true,
          message: 'Password reset successfully'
        }
      }).as('resetPassword');

      cy.wait('@getUsers');

      // Click reset password button
      cy.get('[data-testid="reset-password-2"]').click();
      
      // Confirm reset
      cy.get('[data-testid="confirm-reset"]').click();
      
      cy.wait('@resetPassword');

      // Should show success message
      cy.checkToast('Password reset successfully', 'success');
    });

    it('should search and filter users', () => {
      cy.intercept('GET', '/api/admin/users', {
        body: {
          success: true,
          users: [
            {
              id: 1,
              email: 'admin@university.edu',
              full_name: 'Admin User',
              role: 'admin'
            },
            {
              id: 2,
              email: 'counselor@example.com',
              full_name: 'Test Counselor',
              role: 'counselor'
            },
            {
              id: 3,
              email: 'another@example.com',
              full_name: 'Another User',
              role: 'counselor'
            }
          ]
        }
      }).as('getUsers');

      cy.wait('@getUsers');

      // Test search
      cy.get('[data-testid="user-search"]').type('admin');
      cy.get('[data-testid="user-row"]').should('have.length', 1);
      cy.get('[data-testid="user-row"]').should('contain', 'admin@university.edu');

      // Test role filter
      cy.get('[data-testid="user-search"]').clear();
      cy.get('[data-testid="role-filter"]').select('counselor');
      cy.get('[data-testid="user-row"]').should('have.length', 2);
    });
  });

  describe('Signup Requests Management', () => {
    beforeEach(() => {
      cy.get('[data-testid="admin-nav-signup-requests"]').click();
      cy.waitForLoading();
    });

    it('should display list of signup requests', () => {
      cy.intercept('GET', '/api/admin/signup-requests', {
        body: {
          success: true,
          requests: [
            {
              id: 1,
              email: 'newuser@gmail.com',
              full_name: 'New User',
              reason: 'I need access to the system',
              status: 'pending',
              created_at: '2024-01-15T10:00:00Z'
            }
          ]
        }
      }).as('getSignupRequests');

      cy.wait('@getSignupRequests');

      // Check requests table
      cy.get('[data-testid="requests-table"]').should('be.visible');
      cy.get('[data-testid="request-row"]').should('have.length', 1);
      
      // Check request data
      cy.get('[data-testid="request-row"]').should('contain', 'newuser@gmail.com');
      cy.get('[data-testid="request-row"]').should('contain', 'New User');
      cy.get('[data-testid="request-row"]').should('contain', 'pending');
    });

    it('should allow admin to approve signup request', () => {
      cy.intercept('GET', '/api/admin/signup-requests', {
        body: {
          success: true,
          requests: [
            {
              id: 1,
              email: 'newuser@gmail.com',
              full_name: 'New User',
              reason: 'I need access',
              status: 'pending'
            }
          ]
        }
      }).as('getRequests');

      cy.intercept('PUT', '/api/admin/signup-requests/1', {
        body: {
          success: true,
          message: 'Request approved successfully'
        }
      }).as('approveRequest');

      cy.wait('@getRequests');

      // Click approve button
      cy.get('[data-testid="approve-request-1"]').click();
      
      // Confirm approval
      cy.get('[data-testid="confirm-approve"]').click();
      
      cy.wait('@approveRequest');

      // Should show success message
      cy.checkToast('Request approved successfully', 'success');
    });

    it('should allow admin to reject signup request', () => {
      cy.intercept('GET', '/api/admin/signup-requests', {
        body: {
          success: true,
          requests: [
            {
              id: 1,
              email: 'newuser@gmail.com',
              full_name: 'New User',
              reason: 'I need access',
              status: 'pending'
            }
          ]
        }
      }).as('getRequests');

      cy.intercept('PUT', '/api/admin/signup-requests/1', {
        body: {
          success: true,
          message: 'Request rejected successfully'
        }
      }).as('rejectRequest');

      cy.wait('@getRequests');

      // Click reject button
      cy.get('[data-testid="reject-request-1"]').click();
      
      // Add rejection reason
      cy.get('[data-testid="rejection-reason"]').type('Does not meet requirements');
      
      // Confirm rejection
      cy.get('[data-testid="confirm-reject"]').click();
      
      cy.wait('@rejectRequest');

      // Should show success message
      cy.checkToast('Request rejected successfully', 'success');
    });

    it('should allow admin to delete signup request', () => {
      cy.intercept('GET', '/api/admin/signup-requests', {
        body: {
          success: true,
          requests: [
            {
              id: 1,
              email: 'newuser@gmail.com',
              full_name: 'New User',
              reason: 'I need access',
              status: 'rejected'
            }
          ]
        }
      }).as('getRequests');

      cy.intercept('DELETE', '/api/admin/signup-requests/1', {
        body: {
          success: true,
          message: 'Request deleted successfully'
        }
      }).as('deleteRequest');

      cy.wait('@getRequests');

      // Click delete button
      cy.get('[data-testid="delete-request-1"]').click();
      
      // Confirm deletion
      cy.get('[data-testid="confirm-delete"]').click();
      
      cy.wait('@deleteRequest');

      // Should show success message
      cy.checkToast('Request deleted successfully', 'success');
    });

    it('should filter requests by status', () => {
      cy.intercept('GET', '/api/admin/signup-requests', {
        body: {
          success: true,
          requests: [
            {
              id: 1,
              email: 'user1@gmail.com',
              status: 'pending'
            },
            {
              id: 2,
              email: 'user2@gmail.com',
              status: 'approved'
            },
            {
              id: 3,
              email: 'user3@gmail.com',
              status: 'rejected'
            }
          ]
        }
      }).as('getRequests');

      cy.wait('@getRequests');

      // Filter by pending
      cy.get('[data-testid="status-filter"]').select('pending');
      cy.get('[data-testid="request-row"]').should('have.length', 1);
      cy.get('[data-testid="request-row"]').should('contain', 'user1@gmail.com');

      // Filter by approved
      cy.get('[data-testid="status-filter"]').select('approved');
      cy.get('[data-testid="request-row"]').should('have.length', 1);
      cy.get('[data-testid="request-row"]').should('contain', 'user2@gmail.com');
    });
  });

  describe('Admin Settings', () => {
    beforeEach(() => {
      cy.get('[data-testid="admin-nav-settings"]').click();
      cy.waitForLoading();
    });

    it('should display admin settings page', () => {
      cy.checkPageTitle('Admin Settings');
      cy.get('[data-testid="settings-form"]').should('be.visible');
    });

    it('should allow admin to update system settings', () => {
      cy.intercept('PUT', '/api/admin/settings', {
        body: {
          success: true,
          message: 'Settings updated successfully'
        }
      }).as('updateSettings');

      // Update settings
      cy.get('[data-testid="max-login-attempts"]').clear().type('5');
      cy.get('[data-testid="session-timeout"]').clear().type('30');
      cy.get('[data-testid="enable-email-notifications"]').check();
      
      cy.get('[data-testid="save-settings"]').click();
      
      cy.wait('@updateSettings');

      cy.checkToast('Settings updated successfully', 'success');
    });

    it('should validate settings input', () => {
      // Test invalid input
      cy.get('[data-testid="max-login-attempts"]').clear().type('-1');
      cy.get('[data-testid="save-settings"]').click();
      
      cy.get('[data-testid="max-login-attempts-error"]').should('contain', 'must be positive');
    });
  });

  describe('Admin Analytics', () => {
    beforeEach(() => {
      cy.get('[data-testid="admin-nav-analytics"]').click();
      cy.waitForLoading();
    });

    it('should display system analytics', () => {
      cy.intercept('GET', '/api/admin/analytics', {
        body: {
          success: true,
          analytics: {
            totalUsers: 50,
            activeUsers: 25,
            totalSlips: 1000,
            totalReports: 500,
            monthlyGrowth: 15,
            systemHealth: 'good'
          }
        }
      }).as('getAnalytics');

      cy.wait('@getAnalytics');

      // Check analytics cards
      cy.get('[data-testid="total-users-stat"]').should('contain', '50');
      cy.get('[data-testid="active-users-stat"]').should('contain', '25');
      cy.get('[data-testid="total-slips-stat"]').should('contain', '1000');
      cy.get('[data-testid="total-reports-stat"]').should('contain', '500');
    });

    it('should display activity charts', () => {
      cy.intercept('GET', '/api/admin/analytics/charts', {
        body: {
          success: true,
          charts: {
            userActivity: [
              { date: '2024-01-01', count: 10 },
              { date: '2024-01-02', count: 15 }
            ],
            systemUsage: [
              { date: '2024-01-01', slips: 5, reports: 3 },
              { date: '2024-01-02', slips: 8, reports: 6 }
            ]
          }
        }
      }).as('getCharts');

      cy.wait('@getCharts');

      // Check charts
      cy.get('[data-testid="user-activity-chart"]').should('be.visible');
      cy.get('[data-testid="system-usage-chart"]').should('be.visible');
    });
  });

  describe('Admin Security', () => {
    it('should require admin authentication for admin routes', () => {
      // Test without authentication
      cy.window().then((win) => {
        win.sessionStorage.removeItem('authToken');
        win.sessionStorage.removeItem('userData');
      });

      cy.visit('/admin/users');
      cy.url().should('include', '/admin/login');
    });

    it('should prevent counselor access to admin routes', () => {
      cy.window().then((win) => {
        win.sessionStorage.setItem('authToken', 'counselor-token');
        win.sessionStorage.setItem('userData', JSON.stringify({
          id: 2,
          email: 'counselor@example.com',
          role: 'counselor'
        }));
      });

      cy.visit('/admin/users');
      cy.url().should('not.include', '/admin');
      cy.url().should('include', '/');
    });

    it('should log admin actions', () => {
      cy.intercept('POST', '/api/admin/logs', {
        body: {
          success: true,
          message: 'Action logged successfully'
        }
      }).as('logAction');

      // Perform admin action
      cy.get('[data-testid="admin-nav-users"]').click();
      
      // Should log the action
      cy.wait('@logAction');
    });
  });

  describe('Admin Performance', () => {
    it('should handle large user lists efficiently', () => {
      // Mock large user dataset
      cy.intercept('GET', '/api/admin/users', {
        body: {
          success: true,
          users: Array(1000).fill().map((_, index) => ({
            id: index,
            email: `user${index}@example.com`,
            full_name: `User ${index}`,
            role: 'counselor',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }))
        }
      }).as('getLargeUserList');

      cy.get('[data-testid="admin-nav-users"]').click();
      cy.wait('@getLargeUserList');

      // Should implement pagination or virtual scrolling
      cy.get('[data-testid="pagination"]').should('be.visible');
      cy.get('[data-testid="user-row"]').should('have.length.lessThan', 50); // Should not render all at once
    });

    it('should load data with lazy loading', () => {
      cy.intercept('GET', '/api/admin/users', {
        body: {
          success: true,
          users: Array(50).fill().map((_, index) => ({
            id: index,
            email: `user${index}@example.com`,
            full_name: `User ${index}`,
            role: 'counselor'
          }))
        }
      }).as('getUsersPage1');

      cy.get('[data-testid="admin-nav-users"]').click();
      cy.wait('@getUsersPage1');

      // Should load more data on scroll
      cy.get('[data-testid="users-container"]').scrollTo('bottom');
      
      cy.intercept('GET', '/api/admin/users?page=2', {
        body: {
          success: true,
          users: Array(50).fill().map((_, index) => ({
            id: index + 50,
            email: `user${index + 50}@example.com`,
            full_name: `User ${index + 50}`,
            role: 'counselor'
          }))
        }
      }).as('getUsersPage2');

      cy.wait('@getUsersPage2');
    });
  });
});
