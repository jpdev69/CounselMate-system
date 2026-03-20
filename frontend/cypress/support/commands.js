// Custom Cypress Commands

// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

// Custom command for API requests
Cypress.Commands.add('apiRequest', (method, endpoint, body = null) => {
  const requestOptions = {
    method: method,
    url: `${Cypress.env('apiUrl')}${endpoint}`,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    requestOptions.body = JSON.stringify(body);
  }

  return cy.request(requestOptions);
});

// Custom command for authenticated API requests
Cypress.Commands.add('apiRequestAuth', (method, endpoint, body = null) => {
  return cy.window().then((win) => {
    const token = win.sessionStorage.getItem('authToken');
    
    const requestOptions = {
      method: method,
      url: `${Cypress.env('apiUrl')}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    if (body) {
      requestOptions.body = JSON.stringify(body);
    }

    return cy.request(requestOptions);
  });
});

// Custom command to check element visibility with retry
Cypress.Commands.add('isVisible', { prevSubject: 'element' }, (subject, options = {}) => {
  const { timeout = 5000 } = options;
  
  return cy.wrap(subject, { timeout }).should('be.visible');
});

// Custom command to wait for loading to complete
Cypress.Commands.add('waitForLoading', () => {
  cy.get('[data-testid="loading-spinner"]', { timeout: 10000 }).should('not.exist');
  cy.get('.loading', { timeout: 10000 }).should('not.exist');
});

// Custom command to fill form with data
Cypress.Commands.add('fillForm', (formData) => {
  Object.entries(formData).forEach(([field, value]) => {
    cy.get(`[data-testid="${field}"]`).type(value);
  });
});

// Custom command to check form validation errors
Cypress.Commands.add('checkValidationErrors', (errors) => {
  errors.forEach(([field, message]) => {
    cy.get(`[data-testid="${field}-error"]`).should('contain', message);
  });
});

// Custom command to setup test data
Cypress.Commands.add('setupTestData', (dataType, data) => {
  return cy.apiRequest('POST', `/test/setup/${dataType}`, data);
});

// Custom command to cleanup test data
Cypress.Commands.add('cleanupTestData', (dataType, id) => {
  return cy.apiRequest('DELETE', `/test/cleanup/${dataType}/${id}`);
});

// Custom command for file upload
Cypress.Commands.add('uploadFile', (selector, fileName, mimeType = 'application/json') => {
  cy.get(selector).then((subject) => {
    cy.fixture(fileName).then((fileContent) => {
      const blob = new Blob([fileContent], { type: mimeType });
      const file = new File([blob], fileName, { type: mimeType });
      
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      subject[0].files = dataTransfer.files;
    });
  });
});

// Custom command for checking toast notifications
Cypress.Commands.add('checkToast', (message, type = 'success') => {
  cy.get(`[data-testid="toast-${type}"]`).should('contain', message);
});

// Custom command for navigating with loading check
Cypress.Commands.add('navigateTo', (path) => {
  cy.visit(path);
  cy.waitForLoading();
});

// Custom command for checking page title
Cypress.Commands.add('checkPageTitle', (title) => {
  cy.get('h1, h2').should('contain', title);
});
