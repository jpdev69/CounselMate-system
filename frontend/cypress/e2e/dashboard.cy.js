describe('Dashboard Functionality', () => {
  beforeEach(() => {
    cy.loginAsCounselor();
    cy.navigateTo('/');
  });

  describe('Dashboard Layout', () => {
    it('should display dashboard components correctly', () => {
      // Check main elements
      cy.checkPageTitle('GuidanceOS Dashboard');
      cy.get('[data-testid="welcome-message"]').should('contain', 'Welcome back');
      cy.get('[data-testid="user-info"]').should('be.visible');
      
      // Check navigation buttons
      const navigationButtons = [
        'print-slip',
        'complete-form',
        'report-student',
        'search-records',
        'student-manual'
      ];

      navigationButtons.forEach(button => {
        cy.get(`[data-testid="${button}-button"]`).should('be.visible');
      });

      // Check user menu
      cy.get('[data-testid="user-menu"]').should('be.visible');
    });

    it('should display user information correctly', () => {
      cy.get('[data-testid="user-name"]').should('contain', 'Test Counselor');
      cy.get('[data-testid="user-email"]').should('contain', 'counselor@example.com');
      cy.get('[data-testid="user-role"]').should('contain', 'counselor');
    });

    it('should show current date', () => {
      const today = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      cy.get('[data-testid="current-date"]').should('contain', today);
    });
  });

  describe('Navigation', () => {
    it('should navigate to Print Admission Slip', () => {
      cy.get('[data-testid="print-slip-button"]').click();
      
      cy.url().should('include', '/print-slip');
      cy.checkPageTitle('Print Admission Slip');
      cy.waitForLoading();
    });

    it('should navigate to Complete Form', () => {
      cy.get('[data-testid="complete-form-button"]').click();
      
      cy.url().should('include', '/complete-form');
      cy.checkPageTitle('Complete Admission Form');
      cy.waitForLoading();
    });

    it('should navigate to Report Student', () => {
      cy.get('[data-testid="report-student-button"]').click();
      
      cy.url().should('include', '/report-student');
      cy.checkPageTitle('Report Student Violation');
      cy.waitForLoading();
    });

    it('should navigate to Search Records', () => {
      cy.get('[data-testid="search-records-button"]').click();
      
      cy.url().should('include', '/search');
      cy.checkPageTitle('Search Records');
      cy.waitForLoading();
    });

    it('should navigate to Student Manual', () => {
      cy.get('[data-testid="student-manual-button"]').click();
      
      cy.url().should('include', '/student-manual');
      cy.checkPageTitle('Student Manual');
      cy.waitForLoading();
    });
  });

  describe('User Menu', () => {
    it('should open user menu dropdown', () => {
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="user-menu-dropdown"]').should('be.visible');
      
      // Check menu items
      const menuItems = [
        'profile',
        'change-password',
        'recovery-email',
        'logout'
      ];

      menuItems.forEach(item => {
        cy.get(`[data-testid="${item}-menu-item"]`).should('be.visible');
      });
    });

    it('should close menu when clicking outside', () => {
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="user-menu-dropdown"]').should('be.visible');
      
      cy.get('body').click(0, 0);
      cy.get('[data-testid="user-menu-dropdown"]').should('not.exist');
    });

    it('should navigate to change password', () => {
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="change-password-menu-item"]').click();
      
      cy.url().should('include', '/change-password');
      cy.checkPageTitle('Change Password');
    });

    it('should navigate to recovery email', () => {
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="recovery-email-menu-item"]').click();
      
      cy.url().should('include', '/recovery-email');
      cy.checkPageTitle('Recovery Email');
    });

    it('should logout user', () => {
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="logout-menu-item"]').click();
      
      cy.url().should('include', '/login');
      
      // Check session is cleared
      cy.window().then((win) => {
        expect(win.sessionStorage.getItem('authToken')).to.be.null;
      });
    });
  });

  describe('Dashboard Statistics', () => {
    it('should display dashboard statistics', () => {
      // Mock API call for statistics
      cy.intercept('GET', '/api/dashboard/stats', {
        body: {
          totalSlips: 150,
          totalReports: 75,
          pendingSlips: 12,
          recentActivity: 8
        }
      }).as('getDashboardStats');

      cy.wait('@getDashboardStats');

      // Check statistics cards
      cy.get('[data-testid="total-slips-stat"]').should('contain', '150');
      cy.get('[data-testid="total-reports-stat"]').should('contain', '75');
      cy.get('[data-testid="pending-slips-stat"]').should('contain', '12');
      cy.get('[data-testid="recent-activity-stat"]').should('contain', '8');
    });

    it('should handle statistics loading error', () => {
      cy.intercept('GET', '/api/dashboard/stats', {
        statusCode: 500,
        body: { error: 'Failed to load statistics' }
      }).as('getDashboardStatsError');

      cy.wait('@getDashboardStatsError');

      // Should show error message
      cy.get('[data-testid="stats-error"]').should('contain', 'Failed to load statistics');
    });
  });

  describe('Recent Activity', () => {
    it('should display recent activity feed', () => {
      // Mock API call for recent activity
      cy.intercept('GET', '/api/dashboard/recent-activity', {
        body: [
          {
            id: 1,
            type: 'slip',
            description: 'New admission slip created',
            timestamp: '2024-01-15T10:30:00Z',
            user: 'Test Counselor'
          },
          {
            id: 2,
            type: 'report',
            description: 'Student violation reported',
            timestamp: '2024-01-15T09:15:00Z',
            user: 'Test Counselor'
          }
        ]
      }).as('getRecentActivity');

      cy.wait('@getRecentActivity');

      // Check activity items
      cy.get('[data-testid="recent-activity-feed"]').should('be.visible');
      cy.get('[data-testid="activity-item"]').should('have.length', 2);
      cy.get('[data-testid="activity-item"]').first().should('contain', 'New admission slip created');
    });

    it('should show empty state when no recent activity', () => {
      cy.intercept('GET', '/api/dashboard/recent-activity', {
        body: []
      }).as('getRecentActivityEmpty');

      cy.wait('@getRecentActivityEmpty');

      cy.get('[data-testid="no-recent-activity"]').should('be.visible');
      cy.get('[data-testid="no-recent-activity"]').should('contain', 'No recent activity');
    });
  });

  describe('Quick Actions', () => {
    it('should provide quick action buttons', () => {
      const quickActions = [
        'quick-slip',
        'quick-report',
        'quick-search'
      ];

      quickActions.forEach(action => {
        cy.get(`[data-testid="${action}-button"]`).should('be.visible');
      });
    });

    it('should execute quick slip action', () => {
      cy.get('[data-testid="quick-slip-button"]').click();
      
      // Should open quick slip modal or navigate to slip page
      cy.url().should('include', '/print-slip');
    });

    it('should execute quick report action', () => {
      cy.get('[data-testid="quick-report-button"]').click();
      
      // Should open quick report modal or navigate to report page
      cy.url().should('include', '/report-student');
    });

    it('should execute quick search action', () => {
      cy.get('[data-testid="quick-search-button"]').click();
      
      // Should open quick search modal or navigate to search page
      cy.url().should('include', '/search');
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', () => {
      cy.viewport(375, 667); // iPhone 6/7/8
      
      // Check mobile layout
      cy.get('[data-testid="dashboard-grid"]').should('have.class', 'mobile-layout');
      cy.get('[data-testid="navigation-buttons"]').should('have.class', 'mobile-nav');
    });

    it('should adapt to tablet viewport', () => {
      cy.viewport(768, 1024); // iPad
      
      // Check tablet layout
      cy.get('[data-testid="dashboard-grid"]').should('have.class', 'tablet-layout');
    });

    it('should handle sidebar toggle on mobile', () => {
      cy.viewport(375, 667);
      
      // Check if sidebar toggle exists
      cy.get('[data-testid="sidebar-toggle"]').should('be.visible');
      
      // Toggle sidebar
      cy.get('[data-testid="sidebar-toggle"]').click();
      cy.get('[data-testid="sidebar"]').should('have.class', 'open');
      
      // Close sidebar
      cy.get('[data-testid="sidebar-close"]').click();
      cy.get('[data-testid="sidebar"]').should('not.have.class', 'open');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      // Check main navigation
      cy.get('[data-testid="main-navigation"]').should('have.attr', 'aria-label', 'Main navigation');
      
      // Check user menu
      cy.get('[data-testid="user-menu"]').should('have.attr', 'aria-label', 'User menu');
      
      // Check dashboard sections
      cy.get('[data-testid="dashboard-stats"]').should('have.attr', 'aria-label', 'Dashboard statistics');
      cy.get('[data-testid="recent-activity"]').should('have.attr', 'aria-label', 'Recent activity');
    });

    it('should support keyboard navigation', () => {
      // Tab through navigation elements
      cy.get('body').tab();
      cy.get('[data-testid="print-slip-button"]').should('be.focused');
      
      cy.get('body').tab();
      cy.get('[data-testid="complete-form-button"]').should('be.focused');
      
      cy.get('body').tab();
      cy.get('[data-testid="report-student-button"]').should('be.focused');
      
      // Test Enter key on focused button
      cy.get('[data-testid="report-student-button"]').type('{enter}');
      cy.url().should('include', '/report-student');
    });

    it('should have proper heading hierarchy', () => {
      cy.get('h1').should('have.length', 1);
      cy.get('h2').should('have.length.greaterThan', 0);
      
      // Check main heading
      cy.get('h1').should('contain', 'GuidanceOS Dashboard');
    });
  });

  describe('Performance', () => {
    it('should load dashboard quickly', () => {
      // Measure load time
      cy.window().then((win) => {
        const startTime = performance.now();
        
        cy.visit('/').then(() => {
          const endTime = performance.now();
          const loadTime = endTime - startTime;
          
          // Dashboard should load within 3 seconds
          expect(loadTime).to.be.lessThan(3000);
        });
      });
    });

    it('should handle large data sets efficiently', () => {
      // Mock large dataset
      cy.intercept('GET', '/api/dashboard/recent-activity', {
        body: Array(1000).fill().map((_, index) => ({
          id: index,
          type: 'slip',
          description: `Activity ${index}`,
          timestamp: new Date().toISOString(),
          user: 'Test Counselor'
        }))
      }).as('getLargeActivity');

      cy.wait('@getLargeActivity');

      // Should still load within reasonable time
      cy.get('[data-testid="recent-activity-feed"]').should('be.visible');
    });
  });
});
