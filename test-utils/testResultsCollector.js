import fs from 'fs';
import path from 'path';

class TestResultsCollector {
  constructor() {
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  startTestSuite() {
    this.startTime = new Date().toISOString();
    this.results = [];
  }

  addTestResult(testData) {
    const result = {
      testId: this.generateTestId(),
      timestamp: new Date().toISOString(),
      ...testData
    };
    this.results.push(result);
  }

  generateTestId() {
    return `TEST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  endTestSuite() {
    this.endTime = new Date().toISOString();
  }

  exportToJson(filePath = 'test-results.json') {
    const suiteData = {
      suiteInfo: {
        startTime: this.startTime,
        endTime: this.endTime,
        totalTests: this.results.length,
        passedTests: this.results.filter(r => r.status === 'passed').length,
        failedTests: this.results.filter(r => r.status === 'failed').length,
        skippedTests: this.results.filter(r => r.status === 'skipped').length
      },
      results: this.results
    };

    try {
      fs.writeFileSync(filePath, JSON.stringify(suiteData, null, 2));
      console.log(`Test results exported to ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Error exporting test results:', error);
      throw error;
    }
  }

  categorizeTests() {
    const categories = {
      unit: [],
      integration: [],
      system: []
    };

    this.results.forEach(result => {
      if (categories[result.level]) {
        categories[result.level].push(result);
      }
    });

    return categories;
  }

  getSummary() {
    const categories = this.categorizeTests();
    return {
      total: this.results.length,
      byLevel: {
        unit: categories.unit.length,
        integration: categories.integration.length,
        system: categories.system.length
      },
      byStatus: {
        passed: this.results.filter(r => r.status === 'passed').length,
        failed: this.results.filter(r => r.status === 'failed').length,
        skipped: this.results.filter(r => r.status === 'skipped').length
      },
      averageDuration: this.results.reduce((sum, r) => sum + (r.duration || 0), 0) / this.results.length
    };
  }
}

export default TestResultsCollector;
