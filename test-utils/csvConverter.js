const fs = require('fs');
const path = require('path');

class CSVConverter {
  constructor() {
    this.headers = [
      'TEST ID',
      'Component',
      'Level',
      'Objective',
      'Steps/Test Data',
      'Expected Result',
      'Actual Result',
      'Status',
      'Duration',
      'Remarks'
    ];
  }

  generateDescriptiveFilename(jsonData, originalJsonFile) {
    try {
      // Extract timestamp from original filename for uniqueness
      const timestampMatch = originalJsonFile.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
      const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString().replace(/[:.]/g, '-');
      
      // Determine if this is backend or frontend based on file path
      const isBackend = originalJsonFile.includes('backend') || originalJsonFile.includes('server');
      const isFrontend = originalJsonFile.includes('frontend') || originalJsonFile.includes('client');
      
      // Determine the main component from test results
      let mainComponent = 'mixed';
      
      if (jsonData.results && jsonData.results.length > 0) {
        // Count components to find the most common one
        const componentCounts = {};
        jsonData.results.forEach(test => {
          const component = test.component || 'unknown';
          componentCounts[component] = (componentCounts[component] || 0) + 1;
        });
        
        // Find the most frequent component
        const sortedComponents = Object.entries(componentCounts)
          .sort(([,a], [,b]) => b - a);
        
        if (sortedComponents.length > 0) {
          const [component, count] = sortedComponents[0];
          // If this component makes up more than 50% of tests, use it as the main component
          if (count / jsonData.results.length > 0.5) {
            mainComponent = component;
          } else if (sortedComponents.length === 1) {
            // If only one component, use it
            mainComponent = component;
          }
          // Otherwise keep as 'mixed'
        }
      }
      
      // Generate descriptive filename based on backend/frontend
      const prefix = isBackend ? 'backend' : (isFrontend ? 'frontend' : 'tests');
      return `${prefix}-${mainComponent}-tests-${timestamp}.csv`;
    } catch (error) {
      // Fallback to timestamp-based name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      return 'tests-' + timestamp + '.csv';
    }
  }

  convertJsonToCsv(jsonFilePath, csvFilePath) {
    try {
      // Read JSON file
      const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
      
      // Extract test results
      let testResults = [];
      
      if (jsonData.results && Array.isArray(jsonData.results)) {
        testResults = jsonData.results;
      } else if (jsonData.suites && Array.isArray(jsonData.suites)) {
        // Handle comprehensive report format
        jsonData.suites.forEach(suite => {
          if (suite.testResults && Array.isArray(suite.testResults)) {
            testResults = testResults.concat(suite.testResults);
          }
        });
      } else if (jsonData.testResults && Array.isArray(jsonData.testResults)) {
        testResults = jsonData.testResults;
      }

      if (testResults.length === 0) {
        throw new Error('No test results found in JSON file');
      }

      // Convert to CSV
      const csvContent = this.generateCSV(testResults);
      
      // Write CSV file
      fs.writeFileSync(csvFilePath, csvContent, 'utf8');
      
      console.log(`✅ CSV file created: ${csvFilePath}`);
      console.log(`📊 Converted ${testResults.length} test results to CSV format`);
      
      return csvFilePath;
    } catch (error) {
      console.error('❌ Error converting JSON to CSV:', error.message);
      throw error;
    }
  }

  generateCSV(testResults) {
    // Add BOM for Excel compatibility
    let csvContent = '\uFEFF';
    
    // Add headers
    csvContent += this.headers.join(',') + '\n';
    
    // Add test data rows
    testResults.forEach(test => {
      const row = [
        this.escapeCSVField(test.testId || ''),
        this.escapeCSVField(test.component || ''),
        this.escapeCSVField(test.level || ''),
        this.escapeCSVField(test.objective || ''),
        this.escapeCSVField(test.steps || ''),
        this.escapeCSVField(test.expectedResult || ''),
        this.escapeCSVField(test.actualResult || ''),
        this.escapeCSVField(test.status || ''),
        this.escapeCSVField(test.duration ? test.duration.toString() : ''),
        this.escapeCSVField(test.remarks || '')
      ];
      
      csvContent += row.join(',') + '\n';
    });
    
    return csvContent;
  }

  escapeCSVField(field) {
    if (field === null || field === undefined) {
      return '';
    }
    
    let stringField = field.toString();
    
    // Replace newlines with spaces to prevent multiline CSV entries
    stringField = stringField.replace(/\r?\n/g, ' ');
    
    // If field contains comma, or quotes, wrap in quotes and escape quotes
    if (stringField.includes(',') || stringField.includes('"')) {
      return '"' + stringField.replace(/"/g, '""') + '"';
    }
    
    return stringField;
  }

  convertMultipleJsonFiles(jsonDirectory, csvDirectory, options = {}) {
    try {
      // Ensure output directory exists
      if (!fs.existsSync(csvDirectory)) {
        fs.mkdirSync(csvDirectory, { recursive: true });
      }

      // Find all JSON files
      const jsonFiles = fs.readdirSync(jsonDirectory)
        .filter(file => file.endsWith('.json'))
        .filter(file => file.includes('test-results'));

      let filesToProcess = jsonFiles;
      
      // Options for file selection
      if (options.latestOnly) {
        // Process only the most recent file
        if (jsonFiles.length === 0) {
          console.log(`📁 No JSON files found in ${jsonDirectory}`);
          return [];
        }
        filesToProcess = [jsonFiles.sort().pop()];
        console.log(`📁 Processing latest file only: ${filesToProcess[0]}`);
      } else if (options.specificFiles) {
        // Process only specified files
        filesToProcess = jsonFiles.filter(file => 
          options.specificFiles.some(spec => file.includes(spec))
        );
        console.log(`📁 Processing specific files: ${filesToProcess.join(', ')}`);
      } else {
        console.log(`📁 Found ${jsonFiles.length} JSON test result files`);
      }

      const conversions = [];

      filesToProcess.forEach(jsonFile => {
        const jsonFilePath = path.join(jsonDirectory, jsonFile);
        
        try {
          // Read JSON data to determine descriptive filename
          const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
          const descriptiveCsvFile = this.generateDescriptiveFilename(jsonData, jsonFile);
          const csvFilePath = path.join(csvDirectory, descriptiveCsvFile);

          this.convertJsonToCsv(jsonFilePath, csvFilePath);
          conversions.push({
            jsonFile: jsonFile,
            csvFile: descriptiveCsvFile,
            status: 'success'
          });
        } catch (error) {
          console.error(`❌ Failed to convert ${jsonFile}:`, error.message);
          // Fallback to original naming
          const csvFile = jsonFile.replace('.json', '.csv');
          const csvFilePath = path.join(csvDirectory, csvFile);
          conversions.push({
            jsonFile: jsonFile,
            csvFile: csvFile,
            status: 'failed',
            error: error.message
          });
        }
      });

      // Generate summary report
      this.generateConversionSummary(conversions, csvDirectory);
      
      // Clean up JSON files after successful conversion
      this.cleanupJsonFiles(jsonDirectory, filesToProcess, conversions);
      
      return conversions;
    } catch (error) {
      console.error('❌ Error converting multiple JSON files:', error.message);
      throw error;
    }
  }

  generateConversionSummary(conversions, csvDirectory) {
    const successful = conversions.filter(c => c.status === 'success');
    const failed = conversions.filter(c => c.status === 'failed');

    const summary = {
      timestamp: new Date().toISOString(),
      totalFiles: conversions.length,
      successfulConversions: successful.length,
      failedConversions: failed.length,
      conversions: conversions
    };

    const summaryPath = path.join(csvDirectory, 'conversion-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log('\n📈 Conversion Summary:');
    console.log(`Total files: ${conversions.length}`);
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📄 Summary saved to: ${summaryPath}`);

    if (failed.length > 0) {
      console.log('\n❌ Failed conversions:');
      failed.forEach(failure => {
        console.log(`  - ${failure.jsonFile}: ${failure.error}`);
      });
    }
  }

  cleanupJsonFiles(jsonDirectory, filesToProcess, conversions) {
    try {
      let cleanedCount = 0;
      
      filesToProcess.forEach(jsonFile => {
        const conversion = conversions.find(c => c.jsonFile === jsonFile);
        const jsonFilePath = path.join(jsonDirectory, jsonFile);
        
        // Only remove JSON files that were successfully converted
        if (conversion && conversion.status === 'success') {
          try {
            fs.unlinkSync(jsonFilePath);
            cleanedCount++;
            console.log(`🗑️  Cleaned up: ${jsonFile}`);
          } catch (error) {
            console.warn(`⚠️  Could not delete ${jsonFile}:`, error.message);
          }
        }
      });
      
      if (cleanedCount > 0) {
        console.log(`\n🧹 Cleanup completed: Removed ${cleanedCount} JSON file(s)`);
      }
      
      // Also clean up the unit test JSON files if they exist
      const unitFiles = fs.readdirSync(jsonDirectory)
        .filter(file => file.endsWith('.json'))
        .filter(file => file.includes('test-results-unit'));
      
      unitFiles.forEach(unitFile => {
        const unitFilePath = path.join(jsonDirectory, unitFile);
        try {
          fs.unlinkSync(unitFilePath);
          cleanedCount++;
          console.log(`🗑️  Cleaned up unit file: ${unitFile}`);
        } catch (error) {
          console.warn(`⚠️  Could not delete unit file ${unitFile}:`, error.message);
        }
      });
      
      if (cleanedCount > 0) {
        console.log(`🧹 Total cleanup: Removed ${cleanedCount} JSON file(s) from test-results`);
      }
      
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error.message);
    }
  }

  createCategorizedCSVs(jsonDirectory, csvDirectory) {
    try {
      // Ensure output directory exists
      if (!fs.existsSync(csvDirectory)) {
        fs.mkdirSync(csvDirectory, { recursive: true });
      }

      // Find the most recent comprehensive test results
      const jsonFiles = fs.readdirSync(jsonDirectory)
        .filter(file => file.endsWith('.json'))
        .filter(file => file.includes('comprehensive-test-report'))
        .sort()
        .reverse();

      if (jsonFiles.length === 0) {
        console.log('⚠️  No comprehensive test reports found');
        return;
      }

      const latestReport = jsonFiles[0];
      const reportPath = path.join(jsonDirectory, latestReport);
      const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

      // Categorized CSVs
      const categories = {
        unit: [],
        integration: [],
        system: []
      };

      // Collect all test results and categorize them
      if (reportData.testResults && Array.isArray(reportData.testResults)) {
        reportData.testResults.forEach(test => {
          const level = test.level || 'unit';
          if (categories[level]) {
            categories[level].push(test);
          }
        });
      }

      // Create separate CSV files for each category
      Object.entries(categories).forEach(([level, tests]) => {
        if (tests.length > 0) {
          const csvFileName = `test-results-${level}.csv`;
          const csvFilePath = path.join(csvDirectory, csvFileName);
          
          const csvContent = this.generateCSV(tests);
          fs.writeFileSync(csvFilePath, csvContent, 'utf8');
          
          console.log(`📁 Created ${level} test CSV: ${csvFileName} (${tests.length} tests)`);
        }
      });

      // Create master CSV with all tests
      const allTests = Object.values(categories).flat();
      if (allTests.length > 0) {
        const masterCsvPath = path.join(csvDirectory, 'test-results-all.csv');
        const csvContent = this.generateCSV(allTests);
        fs.writeFileSync(masterCsvPath, csvContent, 'utf8');
        console.log(`📁 Created master CSV: test-results-all.csv (${allTests.length} tests)`);
      }

    } catch (error) {
      console.error('❌ Error creating categorized CSVs:', error.message);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const converter = new CSVConverter();
  const backendResultsDir = path.join(__dirname, '..', 'backend', 'test-results');
  const frontendResultsDir = path.join(__dirname, '..', 'frontend', 'test-results');
  const csvDir = path.join(__dirname, '..', 'test-results-csv');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {};
  
  if (args.includes('--latest-only')) {
    options.latestOnly = true;
  }
  
  const specificIndex = args.indexOf('--specific');
  if (specificIndex !== -1 && args[specificIndex + 1]) {
    options.specificFiles = args[specificIndex + 1].split(',');
  }

  try {
    console.log('🔄 Converting JSON test results to CSV...');
    
    // Convert backend results
    if (fs.existsSync(backendResultsDir)) {
      await converter.convertMultipleJsonFiles(backendResultsDir, csvDir, options);
    }
    
    // Convert frontend results
    if (fs.existsSync(frontendResultsDir)) {
      await converter.convertMultipleJsonFiles(frontendResultsDir, csvDir, options);
    }
    
    // Create categorized CSVs from both directories
    const allResultDirs = [];
    if (fs.existsSync(backendResultsDir)) allResultDirs.push(backendResultsDir);
    if (fs.existsSync(frontendResultsDir)) allResultDirs.push(frontendResultsDir);
    
    for (const resultsDir of allResultDirs) {
      await converter.createCategorizedCSVs(resultsDir, csvDir);
    }
    
    console.log('\n✅ CSV conversion completed successfully!');
    
  } catch (error) {
    console.error('❌ CSV conversion failed:', error.message);
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = CSVConverter;

// Run if called directly
if (require.main === module) {
  main();
}
