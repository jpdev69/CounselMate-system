// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Add custom commands
Cypress.Commands.add('login', (email, password) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').type(email);
    cy.get('[data-testid="password-input"]').type(password);
    cy.get('[data-testid="login-button"]').click();
    cy.url().should('not.include', '/login');
  });
});

Cypress.Commands.add('loginAsAdmin', () => {
  cy.login('admin@university.edu', 'admin123');
});

Cypress.Commands.add('loginAsCounselor', () => {
  cy.login('counselor@example.com', 'password123');
});

// Global beforeEach hook
beforeEach(() => {
  // Clear localStorage before each test
  cy.clearLocalStorage();
  
  // Clear cookies before each test
  cy.clearCookies();
  
  // Handle uncaught exceptions
  Cypress.on('uncaught:exception', (err, runnable) => {
    // Prevent Cypress from failing the test on uncaught exceptions
    if (err.message.includes('ResizeObserver loop limit exceeded')) {
      return false;
    }
    return true;
  });
});

// Global afterEach hook
afterEach(() => {
  // Clean up any test data if needed
  cy.window().then((win) => {
    win.sessionStorage.clear();
  });
});
