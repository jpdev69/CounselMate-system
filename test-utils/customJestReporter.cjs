const TestResultsCollector = require('./testResultsCollector.cjs');
const fs = require('fs');
const path = require('path');

class CustomJestReporter {
  constructor(globalConfig, options = {}) {
    this._globalConfig = globalConfig;
    this._options = options;
    this.collector = new TestResultsCollector();
    this.testSuitePath = options.outputPath || path.join(process.cwd(), 'test-results');
    this.ensureOutputDirectory();
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(this.testSuitePath)) {
      fs.mkdirSync(this.testSuitePath, { recursive: true });
    }
  }

  onRunStart(results, options) {
    console.log('🚀 Starting comprehensive test suite...');
    this.collector.startTestSuite();
  }

  onTestStart(test) {
    const testPath = test.path || '';
    const testName = test.title || '';
    
    // Determine test level based on file path and name patterns
    let level = 'unit'; // default
    if (testPath.includes('integration') || testName.includes('integration')) {
      level = 'integration';
    } else if (testPath.includes('e2e') || testName.includes('system') || testName.includes('end-to-end')) {
      level = 'system';
    }

    this.currentTest = {
      component: this.extractComponentName(testPath),
      level: level,
      objective: testName,
      startTime: Date.now()
    };
  }

  onTestResult(test, testResult, aggregatedResult) {
    const endTime = Date.now();
    const duration = endTime - (this.currentTest?.startTime || endTime);

    testResult.testResults.forEach((result) => {
      const testStatus = result.status === 'passed' ? 'passed' : 
                        result.status === 'pending' ? 'skipped' : 'failed';

      this.collector.addTestResult({
        testId: this.generateTestId(test.path, result.title),
        component: this.extractComponentName(test.path), // Extract directly from test path
        level: this.currentTest?.level || 'unit',
        objective: this.extractObjective(result),
        steps: this.extractTestSteps(result),
        expectedResult: this.extractExpectedResult(result),
        actualResult: this.extractActualResult(result),
        status: testStatus,
        duration: duration,
        remarks: this.extractRemarks(result),
        filePath: test.path,
        fullName: result.fullName
      });
    });
  }

  onRunComplete(contexts, results) {
    this.collector.endTestSuite();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonFileName = `test-results-${timestamp}.json`;
    const jsonFilePath = path.join(this.testSuitePath, jsonFileName);
    
    try {
      this.collector.exportToJson(jsonFilePath);
      
      const summary = this.collector.getSummary();
      console.log('\n📊 Test Suite Summary:');
      console.log(`Total Tests: ${summary.total}`);
      console.log(`Passed: ${summary.byStatus.passed} | Failed: ${summary.byStatus.failed} | Skipped: ${summary.byStatus.skipped}`);
      console.log(`Unit: ${summary.byLevel.unit} | Integration: ${summary.byLevel.integration} | System: ${summary.byLevel.system}`);
      console.log(`Average Duration: ${summary.averageDuration.toFixed(2)}ms`);
      console.log(`\n📄 Results saved to: ${jsonFilePath}`);
      
      // Generate categorized reports
      this.generateCategorizedReports();
      
    } catch (error) {
      console.error('Error completing test run:', error);
    }
  }

  generateTestId(filePath, testName) {
    const componentName = this.extractComponentName(filePath);
    const sanitizedName = testName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    return `${componentName}_${sanitizedName}_${Date.now()}`;
  }

  extractComponentName(filePath) {
    if (!filePath) return 'Unknown';
    const parts = filePath.split(path.sep);
    const fileName = parts[parts.length - 1];
    return fileName.replace(/\.(test|spec)\.(js|jsx|ts|tsx)$/, '');
  }

  extractObjective(result) {
    try {
      // Extract meaningful objective from test title without awkward prefixes
      if (result.title.includes('should')) {
        const match = result.title.match(/should (.+)/i);
        if (match) {
          return match[1]; // Return the action directly without "Verify"
        }
      } else if (result.title.includes('when')) {
        const match = result.title.match(/when (.+)/i);
        if (match) {
          return `Scenario: ${match[1]}`;
        }
      } else if (result.title.includes('if')) {
        const match = result.title.match(/if (.+)/i);
        if (match) {
          return `Condition: ${match[1]}`;
        }
      }
      
      // Fallback to clean title
      return result.title;
    } catch (error) {
      console.warn('Error extracting objective:', error);
      return result.title || 'Test objective';
    }
  }

  extractTestSteps(result) {
    try {
      // Extract meaningful test data from test title and context
      const title = result.title;
      
      if (title.includes('login')) {
        if (title.includes('valid credentials')) {
          return 'Email: test@example.com, Password: password123';
        } else if (title.includes('invalid credentials')) {
          return 'Email: invalid@example.com, Password: wrongpassword';
        } else if (title.includes('non-existent user')) {
          return 'Email: nonexistent@example.com, Password: anypassword';
        }
      } else if (title.includes('password')) {
        if (title.includes('change password')) {
          return 'Current: password123, New: newpassword123';
        } else if (title.includes('verify current password')) {
          return 'Email: test@example.com, Password: password123';
        }
      } else if (title.includes('email') || title.includes('password field')) {
        return 'Request body missing required field';
      }
      
      // Default fallback with action prefix
      if (title.includes('should')) {
        const match = title.match(/should (.+)/i);
        if (match) {
          return `Action: ${match[1]}`;
        }
      }
      
      return `Test: ${title}`;
    } catch (error) {
      console.warn('Error extracting test steps:', error);
      return result.title || 'Test execution';
    }
  }

  extractExpectedResult(result) {
    try {
      // Extract meaningful expected result from test title
      if (result.title.includes('should')) {
        const match = result.title.match(/should (.+)/i);
        if (match) {
          return match[1]; // Return the part after "should"
        }
      } else if (result.title.includes('when')) {
        const match = result.title.match(/when (.+)/i);
        if (match) {
          return match[1];
        }
      } else if (result.title.includes('if')) {
        const match = result.title.match(/if (.+)/i);
        if (match) {
          return match[1];
        }
      }
      
      // Fallback to cleaned title
      return result.title.replace(/^[^\w]+\s+/, '').trim() || 'Test should execute successfully';
    } catch (error) {
      console.warn('Error extracting expected result:', error);
      return result.title || 'Test should execute successfully';
    }
  }

  extractActualResult(result) {
    try {
      if (result.status === 'passed') {
        return this.extractExpectedResult(result);
      } else if (result.status === 'failed') {
        // Handle different failure message structures with shorter messages
        if (result.failureMessages && Array.isArray(result.failureMessages) && result.failureMessages.length > 0) {
          return this.shortenErrorMessage(result.failureMessages[0]);
        } else if (result.failureMessage) {
          return this.shortenErrorMessage(result.failureMessage);
        } else if (result.error) {
          return result.error.message || result.error;
        } else if (result.details) {
          return this.shortenErrorMessage(result.details);
        } else {
          return 'Test failed';
        }
      } else if (result.status === 'pending' || result.status === 'skipped') {
        return 'Test was skipped';
      } else if (result.status === 'todo' || result.status === 'disabled') {
        return 'Test was disabled';
      }
      
      // Handle any other unexpected status
      return `Test status: ${result.status || 'unknown'}`;
    } catch (error) {
      console.warn('Error extracting actual result:', error);
      return 'Error extracting result';
    }
  }

  shortenErrorMessage(errorMessage) {
    try {
      // Extract key information from error messages
      if (typeof errorMessage !== 'string') {
        return 'Test failed';
      }

      // Handle Jest assertion errors
      if (errorMessage.includes('expect(')) {
        const expectedMatch = errorMessage.match(/Expected:\s*(\d+|"[^"]*"|'[^']*'|true|false|null|undefined)/);
        const receivedMatch = errorMessage.match(/Received:\s*(\d+|"[^"]*"|'[^']*'|true|false|null|undefined)/);
        
        if (expectedMatch && receivedMatch) {
          return `Expected: ${expectedMatch[1]}, Received: ${receivedMatch[1]}`;
        }
        
        // Handle HTTP status errors
        const statusMatch = errorMessage.match(/Expected status (\d+).*Received (\d+)/);
        if (statusMatch) {
          return `Expected status ${statusMatch[1]}, Received ${statusMatch[2]}`;
        }
        
        // Handle property errors
        const propertyMatch = errorMessage.match(/Expected.*toHaveProperty.*Expected.*["']([^"']+)["']/);
        if (propertyMatch) {
          return `Missing property: ${propertyMatch[1]}`;
        }
        
        return 'Assertion failed';
      }

      // Handle HTTP errors
      if (errorMessage.includes('status') && errorMessage.includes('Expected')) {
        const statusMatch = errorMessage.match(/Expected.*?(\d+).*?Received.*?(\d+)/);
        if (statusMatch) {
          return `Status ${statusMatch[2]} (expected ${statusMatch[1]})`;
        }
      }

      // Handle database errors
      if (errorMessage.includes('database') || errorMessage.includes('query')) {
        return 'Database error';
      }

      // Handle timeout errors
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        return 'Test timeout';
      }

      // Handle network errors
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
        return 'Network error';
      }

      // Default: return first 50 characters
      return errorMessage.length > 50 
        ? errorMessage.substring(0, 47) + '...' 
        : errorMessage;
        
    } catch (error) {
      return 'Test failed';
    }
  }

  extractRemarks(result) {
    // Always return empty string for clean presentation
    return '';
  }

  generateCategorizedReports() {
    const categories = this.collector.categorizeTests();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    Object.entries(categories).forEach(([level, tests]) => {
      if (tests.length > 0) {
        const fileName = `test-results-${level}-${timestamp}.json`;
        const filePath = path.join(this.testSuitePath, fileName);
        
        const categorizedData = {
          level: level,
          timestamp: new Date().toISOString(),
          totalTests: tests.length,
          results: tests
        };
        
        try {
          fs.writeFileSync(filePath, JSON.stringify(categorizedData, null, 2));
          console.log(`📁 ${level.charAt(0).toUpperCase() + level.slice(1)} tests saved to: ${filePath}`);
        } catch (error) {
          console.error(`Error saving ${level} test results:`, error);
        }
      }
    });
  }
}

module.exports = CustomJestReporter;
