const { defineConfig } = require('cypress');
const path = require('path');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    env: {
      apiUrl: 'http://localhost:5000/api'
    },
    setupNodeEvents(on, config) {
      // Custom reporter for JSON export
      on('after:spec', (spec, results) => {
        const fs = require('fs');
        const TestResultsCollector = require('../../test-utils/testResultsCollector');
        
        const collector = new TestResultsCollector();
        collector.startTestSuite();
        
        // Process Cypress test results
        results.tests.forEach(test => {
          collector.addTestResult({
            testId: `CYPRESS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            component: 'e2e',
            level: 'system',
            objective: test.title,
            steps: spec.relativePath,
            expectedResult: 'Test should pass',
            actualResult: test.state === 'passed' ? 'Test passed as expected' : 
                         test.state === 'failed' ? test.err?.message || 'Test failed' : 
                         test.state === 'skipped' ? 'Test was skipped' : 'Unknown result',
            status: test.state === 'passed' ? 'passed' : 
                   test.state === 'failed' ? 'failed' : 
                   test.state === 'skipped' ? 'skipped' : 'unknown',
            duration: test.duration || 0,
            remarks: test.err?.message || '',
            filePath: spec.relativePath,
            fullName: `${spec.relativePath}: ${test.title}`
          });
        });
        
        collector.endTestSuite();
        
        // Save results with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultsDir = path.join(__dirname, '..', '..', 'test-results');
        
        if (!fs.existsSync(resultsDir)) {
          fs.mkdirSync(resultsDir, { recursive: true });
        }
        
        const jsonPath = path.join(resultsDir, `cypress-results-${timestamp}.json`);
        collector.exportToJson(jsonPath);
        
        console.log(`📊 Cypress results exported to: ${jsonPath}`);
      });
    },
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
  },
});
