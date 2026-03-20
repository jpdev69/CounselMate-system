# GuidanceOS - Comprehensive Test Suite

This guide provides comprehensive instructions for running and working with the advanced test suite for GuidanceOS, featuring JSON result export and CSV conversion capabilities.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (for backend tests)
- Chrome/Chromium (for Cypress tests)

### Installation

```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install

# Root test utilities
cd ..
npm install
```

### 🧪 Running Comprehensive Tests

#### **Method 1: Complete Test Suite (Recommended)**

```bash
# Run all tests with JSON export and CSV conversion
npm run test:report

# Run all tests (JSON only)
npm test
```

#### **Method 2: Individual Test Categories**

```bash
# Backend tests only
npm run test:backend

# Frontend tests only  
npm run test:frontend

# E2E tests only
npm run test:e2e

# Convert existing JSON results to CSV
npm run test:csv
```

#### Docker Testing

```bash
# Run all tests with Docker Compose
docker-compose -f docker-compose.test.yml up --abort-on-container-exit

# Run specific test services
docker-compose -f docker-compose.test.yml up backend-test
docker-compose -f docker-compose.test.yml up frontend-test
docker-compose -f docker-compose.test.yml up cypress-test
```

## 📊 Test Results & Reporting

### JSON Export Format

The comprehensive test suite automatically exports results to JSON with the following structure:

```json
{
  "suiteInfo": {
    "startTime": "2024-03-20T10:00:00.000Z",
    "endTime": "2024-03-20T10:05:30.000Z", 
    "totalTests": 150,
    "passedTests": 145,
    "failedTests": 5,
    "skippedTests": 0
  },
  "results": [
    {
      "testId": "TEST_1710918000_abc123def",
      "component": "auth",
      "level": "unit",
      "objective": "should login with valid credentials",
      "steps": "POST /api/auth/login with valid credentials",
      "expectedResult": "User should be authenticated successfully",
      "actualResult": "Test passed as expected",
      "status": "passed",
      "duration": 234,
      "remarks": "",
      "filePath": "/backend/tests/auth.test.js",
      "fullName": "Authentication POST /api/auth/login should login with valid credentials"
    }
  ]
}
```

### CSV Export Format

Results are automatically converted to CSV with these columns:

- **TEST ID**: Unique identifier for each test
- **Component**: Component/module being tested
- **Level**: Test level (unit/integration/system)
- **Objective**: Test objective/description
- **Steps/Test Data**: Test steps and test data used
- **Expected Result**: Expected outcome
- **Actual Result Status**: Actual result (pass/fail/skip)
- **Duration**: Test execution time in milliseconds
- **Remarks**: Additional notes or error messages

### Test Categorization

Tests are automatically categorized based on file patterns and annotations:

#### **Unit Tests** (`@level unit`)
- Individual component testing
- Function-level validation
- Mocked dependencies
- Fast execution (< 1s typical)

#### **Integration Tests** (`@level integration`)
- API endpoint testing
- Database interactions
- Multi-component workflows
- Medium execution time (1-5s typical)

#### **System Tests** (`@level system`)
- End-to-end workflows
- Full application testing
- Browser automation
- Longer execution time (5-30s typical)

### Result Files Location

```
test-results/
├── test-results-2024-03-20T10-05-30-000Z.json    # Main results file
├── test-results-unit-2024-03-20T10-05-30-000Z.json
├── test-results-integration-2024-03-20T10-05-30-000Z.json
├── test-results-system-2024-03-20T10-05-30-000Z.json
└── comprehensive-test-report-2024-03-20T10-05-30-000Z.json

test-results-csv/
├── test-results-all.csv                          # Master CSV file
├── test-results-unit.csv                         # Unit tests only
├── test-results-integration.csv                  # Integration tests only
├── test-results-system.csv                       # System tests only
└── conversion-summary.json                       # Conversion report
```

## 📈 Advanced Features

### Custom Test Reporter

The suite includes a custom Jest reporter that:
- Captures detailed test metadata
- Tracks execution timing
- Categorizes tests automatically
- Generates structured JSON output
- Provides real-time progress updates

### Comprehensive Test Runner

The `run-comprehensive-tests.js` script provides:
- Sequential test suite execution
- Progress monitoring
- Error handling and reporting
- Performance metrics
- Recommendations based on results

### CSV Conversion Utility

The `csvConverter.js` utility offers:
- JSON to CSV conversion
- Categorized report generation
- Excel-compatible formatting
- Batch processing capabilities
- Conversion summary reports

## 🔧 Configuration

### Backend Coverage Areas

- ✅ Authentication endpoints (`/api/auth/*`)
- ✅ Admin endpoints (`/api/admin/*`)
- ✅ API endpoints (`/api/*`)
- ✅ Security middleware
- ✅ Database operations
- ✅ Error handling

### Frontend Coverage Areas

- ✅ Authentication components
- ✅ Dashboard functionality
- ✅ Form validation
- ✅ Navigation and routing
- ✅ User interactions

### E2E Test Coverage

- ✅ Complete user workflows
- ✅ Admin panel functionality
- ✅ Cross-browser compatibility
- ✅ Performance testing
- ✅ Accessibility testing

## Test Structure

### Backend Tests

```
backend/tests/
├── auth.test.js          # Authentication tests
├── admin.test.js         # Admin functionality tests
├── middleware.test.js    # Security middleware tests
├── api.test.js           # General API tests
├── integration.test.js   # Integration workflow tests
├── fixtures/
│   └── database.js       # Test data fixtures
└── setup.js              # Test configuration
```

### Frontend Tests

```
frontend/
├── src/
│   ├── __tests__/        # Component tests
│   ├── __mocks__/        # Mock files
│   └── setupTests.js     # Test setup
├── cypress/
│   ├── e2e/              # E2E test specs
│   ├── fixtures/         # Test data
│   └── support/          # Custom commands
└── cypress.config.js     # Cypress configuration
```

## Key Features

### 🔒 Security Testing

- Authentication bypass prevention
- SQL injection protection
- XSS vulnerability testing
- CSRF protection validation
- Rate limiting verification

### 📊 Coverage Reporting

- 80% minimum coverage threshold
- Multiple report formats (HTML, LCOV, JSON)
- CI/CD integration with Codecov
- Visual coverage badges

### 🚀 Performance Testing

- Lighthouse CI integration
- API response time testing
- Frontend performance metrics
- Accessibility compliance checks

### 🔄 CI/CD Integration

- Automated test execution on commits
- Multi-environment testing
- Security vulnerability scanning
- Performance benchmarking
- Code quality gates

## Writing Tests

### Backend Test Example

```javascript
// backend/tests/auth.test.js
describe('Authentication', () => {
  it('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toBeDefined();
  });
});
```

### Frontend Test Example

```javascript
// frontend/src/components/__tests__/Login.test.jsx
describe('Login Component', () => {
  it('should handle successful login', async () => {
    render(<Login />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
```

### E2E Test Example

```javascript
// frontend/cypress/e2e/auth.cy.js
describe('Authentication Flow', () => {
  it('should allow user to login', () => {
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').type('counselor@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="login-button"]').click();
    
    cy.url().should('not.include', '/login');
    cy.get('[data-testid="user-name"]').should('contain', 'Test Counselor');
  });
});
```

## Troubleshooting

### Common Issues

1. **Test Database Connection**
   ```bash
   # Ensure PostgreSQL is running
   pg_isready -h localhost -p 5432
   
   # Create test database
   createdb guidanceos_test
   ```

2. **Cypress Browser Issues**
   ```bash
   # Install Cypress browsers
   cd frontend
   npx cypress install
   
   # Clear cache
   npx cypress cache clear
   ```

3. **Coverage Reports Missing**
   ```bash
   # Generate coverage reports
   npm run test:coverage
   
   # Check coverage directory
   ls -la coverage/
   ```

4. **Docker Test Failures**
   ```bash
   # Rebuild Docker images
   docker-compose -f docker-compose.test.yml build --no-cache
   
   # Check container logs
   docker-compose -f docker-compose.test.yml logs
   ```

### Debug Tips

- Use `console.log` in tests for debugging
- Run tests in watch mode for faster iteration
- Use browser dev tools for E2E test debugging
- Check coverage reports for untested code paths
- Review CI/CD logs for pipeline issues

## Best Practices

### Test Writing

1. **Isolation**: Each test should be independent
2. **Clarity**: Use descriptive test names
3. **Structure**: Follow Arrange-Act-Assert pattern
4. **Coverage**: Test both success and failure cases
5. **Maintenance**: Keep tests updated with code changes

### Performance

1. **Mocking**: Mock external dependencies
2. **Parallelization**: Run tests in parallel when possible
3. **Caching**: Use test data caching wisely
4. **Cleanup**: Clean up test data after each test
5. **Optimization**: Optimize slow-running tests

### Security

1. **Input Validation**: Test all input validation
2. **Authentication**: Verify security measures
3. **Authorization**: Test role-based access
4. **Data Protection**: Ensure sensitive data protection
5. **Error Handling**: Test error response security

## Contributing

When contributing to the test suite:

1. **Add Tests**: Include tests for new features
2. **Update Coverage**: Maintain coverage thresholds
3. **Documentation**: Update test documentation
4. **Review**: Ensure tests pass before submitting
5. **Quality**: Follow established testing patterns

## Support

For testing-related questions or issues:

1. Check the [TESTING.md](./TESTING.md) for detailed documentation
2. Review existing test files for examples
3. Check GitHub issues for known problems
4. Contact the development team for assistance

---

**Note**: This test suite is designed to ensure GuidanceOS maintains high quality, security, and reliability standards. Regular test execution and maintenance are essential for long-term success.
