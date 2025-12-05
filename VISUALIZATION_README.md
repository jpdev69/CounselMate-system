# Violation Visualization & Analytics System

This documentation describes the new visualization and analytics system for the CounselMate backend, designed to provide insights into student violations, patterns, and trends.

## Overview

The visualization system provides multiple endpoints and utilities to analyze violation data:
- **Student violations**: Who has the most/least violations
- **Course analysis**: Which courses have the most violations
- **Violation types**: Distribution of violation types
- **Class/Year analysis**: Violations by year and section
- **Interactive dashboard**: Visual representation of all metrics

## API Endpoints

### 1. Violations by Student
**Endpoint**: `GET /api/visualizations/violations/by-student`

Returns violation count aggregated by student (sorted from most to least violations).

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "student_id": "STU-123456",
      "full_name": "John Doe",
      "year": "First Year",
      "section": "A",
      "violation_count": 5,
      "violation_types": ["Tardiness", "Incomplete Assignment"],
      "courses": ["Mathematics", "English"]
    }
  ],
  "total": 25
}
```

### 2. Violations by Course
**Endpoint**: `GET /api/visualizations/violations/by-course`

Returns violation count aggregated by course with affected students.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "course": "Mathematics",
      "violation_count": 15,
      "student_count": 8,
      "violation_types": ["Incomplete Assignment", "Cheating"]
    }
  ],
  "total": 10
}
```

### 3. Violations by Type
**Endpoint**: `GET /api/visualizations/violations/by-type`

Returns violation count aggregated by violation type.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "LATE",
      "description": "Tardiness",
      "violation_count": 25,
      "student_count": 12
    }
  ],
  "total": 8
}
```

### 4. Violations by Year & Section
**Endpoint**: `GET /api/visualizations/violations/by-year-section`

Returns violation count aggregated by year and section (class).

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "year": "First Year",
      "section": "A",
      "violation_count": 12,
      "student_count": 8,
      "students": ["John Doe", "Jane Smith"]
    }
  ],
  "total": 6
}
```

### 5. Summary Statistics
**Endpoint**: `GET /api/visualizations/violations/summary`

Returns comprehensive summary statistics including:
- Total violations
- Students with violations
- Top violator (most violations)
- Most common violation type
- Most violated course

**Response**:
```json
{
  "success": true,
  "summary": {
    "total_violations": 150,
    "students_with_violations": 45,
    "top_violator": {
      "full_name": "John Doe",
      "year": "First Year",
      "section": "A",
      "violation_count": 8
    },
    "most_common_violation": {
      "code": "LATE",
      "description": "Tardiness",
      "violation_count": 45
    },
    "most_violated_course": {
      "course": "Mathematics",
      "violation_count": 30
    }
  }
}
```

### 6. Interactive Dashboard
**Endpoint**: `GET /api/visualizations/dashboard`

Returns an HTML page with interactive charts and visualizations using Chart.js.

Features:
- Summary cards (total violations, students affected, courses involved)
- Bar chart: Top 10 violators
- Doughnut chart: Violations by course
- Polar area chart: Violation types distribution

Access via browser: `http://localhost:PORT/api/visualizations/dashboard`

## Utility Functions

The `backend/utils/visualizationUtils.js` module provides helper functions for data aggregation:

### Available Functions

```javascript
// Get violations sorted by student (most to least)
const students = await getViolationsByStudent();

// Get violations sorted by course
const courses = await getViolationsByCourse();

// Get violations sorted by type
const types = await getViolationsByType();

// Get violations by year and section
const classes = await getViolationsByYearSection();

// Get comprehensive summary statistics
const summary = await getSummaryStats();
// Returns: {
//   total_violations,
//   students_with_violations,
//   top_violator,
//   least_violator,
//   most_common_violation,
//   most_violated_course,
//   class_with_most_violations
// }

// Get violations trend over a date range (for trend analysis)
const trend = await getViolationsTrend('2024-01-01', '2024-12-31');

// Get detailed profile of a specific student's violations
const profile = await getStudentViolationProfile(studentId);

// Get percentile ranking of a student among all students
const percentile = await getStudentViolationPercentile(studentId);
```

## Usage Examples

### JavaScript/Node.js

```javascript
const utils = require('./utils/visualizationUtils');

// Get all violations by student
async function displayTopViolators() {
  try {
    const data = await utils.getViolationsByStudent();
    console.log('Top Violators:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Get summary statistics
async function displaySummary() {
  try {
    const summary = await utils.getSummaryStats();
    console.log(`Total Violations: ${summary.total_violations}`);
    console.log(`Top Violator: ${summary.top_violator.full_name} (${summary.top_violator.violation_count} violations)`);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Get student profile
async function getStudentStats(studentId) {
  try {
    const profile = await utils.getStudentViolationProfile(studentId);
    const percentile = await utils.getStudentViolationPercentile(studentId);
    console.log(`Student: ${profile.full_name}`);
    console.log(`Violations: ${profile.total_violations}`);
    console.log(`Percentile Rank: ${percentile.percentile_rank}%`);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Frontend (React/JavaScript)

```javascript
// Fetch violations by student
async function fetchViolationsByStudent() {
  try {
    const response = await fetch('/api/visualizations/violations/by-student');
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Fetch summary
async function fetchSummary() {
  try {
    const response = await fetch('/api/visualizations/violations/summary');
    const data = await response.json();
    return data.summary;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example usage in a component
async function displayAnalytics() {
  const summary = await fetchSummary();
  const violators = await fetchViolationsByStudent();
  
  console.log(`Total: ${summary.total_violations}`);
  console.log(`Top Violator: ${summary.top_violator.full_name}`);
  console.log(`Most Common: ${summary.most_common_violation.description}`);
}
```

## Database Requirements

The visualization system requires these tables (assumed to already exist):

1. **students** table:
   - id, student_id, full_name, year, section, ...

2. **admission_slips** table:
   - id, student_id, violation_type_id, course, created_at, ...

3. **violation_types** table:
   - id, code, description, ...

## Key Features

✅ **Comprehensive Analytics**: Multiple views of violation data
✅ **Interactive Dashboard**: Visual representation with Chart.js
✅ **RESTful API**: Easy integration with frontend
✅ **Utility Functions**: Reusable functions for data aggregation
✅ **Performance Optimized**: Efficient SQL queries with aggregation
✅ **Summary Statistics**: Quick overview of key metrics
✅ **Trend Analysis**: Track violations over time
✅ **Percentile Ranking**: Compare student performance

## Integration Steps

1. **Backend Setup**:
   - Files are already created:
     - `/backend/routes/visualizations.js`
     - `/backend/utils/visualizationUtils.js`
   - Routes are registered in `/backend/server.js`

2. **Access the Dashboard**:
   - Navigate to: `http://localhost:YOUR_PORT/api/visualizations/dashboard`

3. **Use API Endpoints**:
   - Call any of the endpoints from your frontend

4. **Use Utility Functions**:
   ```javascript
   const visualizationUtils = require('./utils/visualizationUtils');
   const data = await visualizationUtils.getViolationsByStudent();
   ```

## Query Performance

All queries use efficient PostgreSQL aggregations:
- Uses `COUNT()` for fast counting
- Uses `ARRAY_AGG()` for grouping related data
- Filters `WHERE` clauses to reduce result sets
- Uses indexes on commonly filtered columns

## Future Enhancements

- [ ] Export data to CSV/Excel
- [ ] Custom date range filtering
- [ ] Comparison between time periods
- [ ] Predictive analytics
- [ ] Heatmaps for violation patterns
- [ ] Email reports
- [ ] Mobile-friendly dashboard

## Troubleshooting

**Issue**: "Cannot find module 'visualizationUtils'"
**Solution**: Ensure `backend/utils/visualizationUtils.js` exists

**Issue**: Dashboard shows no data
**Solution**: Verify violation_types table has records and admission_slips are linked correctly

**Issue**: API returns 500 error
**Solution**: Check backend logs for SQL errors, verify database connection

## File Structure

```
backend/
├── routes/
│   ├── admissionSlips.js
│   └── visualizations.js          ← NEW
├── utils/
│   └── visualizationUtils.js       ← NEW
└── server.js                       ← UPDATED
```

---

**Version**: 1.0
**Last Updated**: 2024
**Status**: Production Ready
