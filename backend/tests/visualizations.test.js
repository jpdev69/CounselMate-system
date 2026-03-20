const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');

describe('Visualizations Endpoints', () => {
  let authToken;

  beforeEach(() => {
    mockPool.query.mockReset();
    
    authToken = jwt.sign(
      { id: 1, email: 'test@example.com', role: 'counselor' },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );
  });

  describe('GET /api/visualizations/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/visualizations/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.message).toBe('Visualizations API is working');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/visualizations/health');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/visualizations/violations/by-student', () => {
    it('should return violations aggregated by student', async () => {
      const mockStudentData = [
        {
          id: 1,
          student_id: 'STU-001',
          full_name: 'John Doe',
          year: '3rd Year',
          section: 'C',
          violation_count: 5,
          violation_types: ['IMPROPER_UNIFORM', 'LITTERING'],
          courses: ['Computer Science']
        },
        {
          id: 2,
          student_id: 'STU-002',
          full_name: 'Jane Smith',
          year: '2nd Year',
          section: 'B',
          violation_count: 3,
          violation_types: ['PORNOGRAPHIC_MATERIALS'],
          courses: ['Psychology']
        }
      ];

      mockPool.query.mockResolvedValue({
        rows: mockStudentData
      });

      const response = await request(app)
        .get('/api/visualizations/violations/by-student')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].full_name).toBe('John Doe');
      expect(response.body.data[0].violation_count).toBe(5);
      expect(response.body.total).toBe(2);
    });

    it('should filter by school year and term', async () => {
      const mockFilteredData = [
        {
          id: 1,
          student_id: 'STU-001',
          full_name: 'John Doe',
          year: '3rd Year',
          section: 'C',
          violation_count: 2,
          violation_types: ['IMPROPER_UNIFORM'],
          courses: ['Computer Science']
        }
      ];

      mockPool.query.mockResolvedValue({
        rows: mockFilteredData
      });

      const response = await request(app)
        .get('/api/visualizations/violations/by-student?schoolYear=2024-2025&term=1st')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].violation_count).toBe(2);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/visualizations/violations/by-student');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/visualizations/violations/by-course', () => {
    it('should return violations aggregated by course', async () => {
      const mockCourseData = [
        {
          course: 'Computer Science',
          violation_count: 15,
          student_count: 8,
          violation_types: ['IMPROPER_UNIFORM', 'LITTERING', 'PORNOGRAPHIC_MATERIALS']
        },
        {
          course: 'Psychology',
          violation_count: 10,
          student_count: 5,
          violation_types: ['ASSAULT_VERBAL_ABUSE', 'DISRESPECT']
        }
      ];

      mockPool.query.mockResolvedValue({
        rows: mockCourseData
      });

      const response = await request(app)
        .get('/api/visualizations/violations/by-course')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].course).toBe('Computer Science');
      expect(response.body.data[0].violation_count).toBe(15);
      expect(response.body.total).toBe(2);
    });

    it('should filter by school year and term', async () => {
      const mockFilteredData = [
        {
          course: 'Computer Science',
          violation_count: 8,
          student_count: 4,
          violation_types: ['IMPROPER_UNIFORM']
        }
      ];

      mockPool.query.mockResolvedValue({
        rows: mockFilteredData
      });

      const response = await request(app)
        .get('/api/visualizations/violations/by-course?schoolYear=2024-2025&term=2nd')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].violation_count).toBe(8);
    });
  });

  describe('GET /api/visualizations/violations/by-type', () => {
    it('should return violations aggregated by type', async () => {
      const mockTypeData = [
        {
          id: 1,
          code: 'IMPROPER_UNIFORM',
          description: 'Improper uniform',
          violation_count: 20,
          student_count: 12
        },
        {
          id: 2,
          code: 'LITTERING',
          description: 'Littering',
          violation_count: 15,
          student_count: 8
        }
      ];

      mockPool.query.mockResolvedValue({
        rows: mockTypeData
      });

      const response = await request(app)
        .get('/api/visualizations/violations/by-type')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].code).toBe('IMPROPER_UNIFORM');
      expect(response.body.data[0].violation_count).toBe(20);
      expect(response.body.total).toBe(2);
    });

    it('should filter by school year and term', async () => {
      const mockFilteredData = [
        {
          id: 1,
          code: 'PORNOGRAPHIC_MATERIALS',
          description: 'Pornographic materials',
          violation_count: 5,
          student_count: 3
        }
      ];

      mockPool.query.mockResolvedValue({
        rows: mockFilteredData
      });

      const response = await request(app)
        .get('/api/visualizations/violations/by-type?schoolYear=2024-2025&term=1st')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].code).toBe('PORNOGRAPHIC_MATERIALS');
    });
  });

  describe('GET /api/visualizations/violations/by-year-section', () => {
    it('should return violations aggregated by year and section', async () => {
      const mockYearSectionData = [
        {
          year: '1st Year',
          section: 'A',
          violation_count: 10,
          student_count: 5,
          students: ['John Doe', 'Jane Smith']
        },
        {
          year: '2nd Year',
          section: 'B',
          violation_count: 8,
          student_count: 4,
          students: ['Bob Johnson', 'Alice Brown']
        }
      ];

      mockPool.query.mockResolvedValue({
        rows: mockYearSectionData
      });

      const response = await request(app)
        .get('/api/visualizations/violations/by-year-section')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].year).toBe('1st Year');
      expect(response.body.data[0].section).toBe('A');
      expect(response.body.total).toBe(2);
    });
  });

  describe('GET /api/visualizations/violations/summary', () => {
    it('should return comprehensive summary statistics', async () => {
      const mockSummaryData = {
        total_violations: 150,
        students_with_violations: 45,
        top_violator: {
          full_name: 'John Doe',
          year: '3rd Year',
          section: 'C',
          violation_count: 8
        },
        most_common_violation: {
          code: 'IMPROPER_UNIFORM',
          description: 'Improper uniform',
          violation_count: 25
        },
        most_violated_course: {
          course: 'Computer Science',
          violation_count: 30
        }
      };

      // Mock all the database calls
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: 150 }] }) // totalViolations
        .mockResolvedValueOnce({ rows: [{ total: 45 }] }) // studentsWithViolations
        .mockResolvedValueOnce({ rows: [mockSummaryData.top_violator] }) // topViolator
        .mockResolvedValueOnce({ rows: [mockSummaryData.most_common_violation] }) // mostCommonViolation
        .mockResolvedValueOnce({ rows: [mockSummaryData.most_violated_course] }); // mostViolatedCourse

      const response = await request(app)
        .get('/api/visualizations/violations/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.summary.total_violations).toBe(150);
      expect(response.body.summary.students_with_violations).toBe(45);
      expect(response.body.summary.top_violator.full_name).toBe('John Doe');
      expect(response.body.summary.most_common_violation.code).toBe('IMPROPER_UNIFORM');
      expect(response.body.summary.most_violated_course.course).toBe('Computer Science');
    });

    it('should handle empty data gracefully', async () => {
      // Mock empty results
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/visualizations/violations/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.summary.total_violations).toBe(0);
      expect(response.body.summary.top_violator).toBeNull();
      expect(response.body.summary.most_common_violation).toBeNull();
      expect(response.body.summary.most_violated_course).toBeNull();
    });
  });

  describe('GET /api/visualizations/dashboard/json', () => {
    it('should return dashboard data as JSON', async () => {
      const mockDashboardData = {
        total_slips: 50,
        pending_slips: 20,
        resolved_slips: 30
      };

      mockPool.query.mockResolvedValue({
        rows: [mockDashboardData]
      });

      const response = await request(app)
        .get('/api/visualizations/dashboard/json')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.total_slips).toBe(50);
      expect(response.body.data.summary.pending_slips).toBe(20);
      expect(response.body.data.summary.resolved_slips).toBe(30);
      expect(response.body.data.summary.date_range.start).toBe('2024-01-01');
      expect(response.body.data.summary.date_range.end).toBe('2024-12-31');
    });

    it('should filter dashboard data by date range', async () => {
      const mockFilteredData = {
        total_slips: 25,
        pending_slips: 10,
        resolved_slips: 15
      };

      mockPool.query.mockResolvedValue({
        rows: [mockFilteredData]
      });

      const response = await request(app)
        .get('/api/visualizations/dashboard/json?start_date=2024-01-01&end_date=2024-01-31')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.summary.total_slips).toBe(25);
      expect(response.body.data.summary.date_range.start).toBe('2024-01-01');
      expect(response.body.data.summary.date_range.end).toBe('2024-01-31');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/visualizations/dashboard/json');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/visualizations/dashboard', () => {
    it('should return HTML dashboard', async () => {
      const mockSummaryData = {
        total_violations: 100,
        students_with_violations: 30,
        courses_involved: 5
      };

      const mockStudentData = [
        { full_name: 'John Doe', violation_count: 5 },
        { full_name: 'Jane Smith', violation_count: 3 }
      ];

      const mockCourseData = [
        { course: 'Computer Science', violation_count: 15 },
        { course: 'Psychology', violation_count: 10 }
      ];

      const mockTypeData = [
        { description: 'Improper uniform', violation_count: 20 },
        { description: 'Littering', violation_count: 15 }
      ];

      // Mock all the database calls
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockSummaryData] }) // summary
        .mockResolvedValueOnce({ rows: mockStudentData }) // violationsByStudent
        .mockResolvedValueOnce({ rows: mockCourseData }) // violationsByCourse
        .mockResolvedValueOnce({ rows: mockTypeData }); // violationsByType

      const response = await request(app)
        .get('/api/visualizations/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Violation Analytics Dashboard');
      expect(response.text).toContain('100'); // total violations
      expect(response.text).toContain('30'); // students with violations
    });

    it('should handle dashboard errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/visualizations/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to generate dashboard');
    });
  });

  describe('GET /api/visualizations/violations/daily-trends', () => {
    it('should return daily violation trends', async () => {
      const mockDailyData = [
        { date: '2024-01-01', violation_count: 5, student_count: 3 },
        { date: '2024-01-02', violation_count: 3, student_count: 2 },
        { date: '2024-01-03', violation_count: 7, student_count: 4 }
      ];

      mockPool.query.mockResolvedValue({
        rows: mockDailyData
      });

      const response = await request(app)
        .get('/api/visualizations/violations/daily-trends')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.period).toBe('Last 30 days (Monthly)');
      expect(response.body.total_violations).toBeDefined();
    });

    it('should support custom day range', async () => {
      const mockDailyData = [
        { date: '2024-01-01', violation_count: 2, student_count: 1 },
        { date: '2024-01-02', violation_count: 1, student_count: 1 }
      ];

      mockPool.query.mockResolvedValue({
        rows: mockDailyData
      });

      const response = await request(app)
        .get('/api/visualizations/violations/daily-trends?days=7')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.period).toBe('Last 7 days (Weekly)');
    });

    it('should filter by school year and term', async () => {
      const mockFilteredData = [
        { date: '2024-01-01', violation_count: 3, student_count: 2 }
      ];

      mockPool.query.mockResolvedValue({
        rows: mockFilteredData
      });

      const response = await request(app)
        .get('/api/visualizations/violations/daily-trends?schoolYear=2024-2025&term=1st')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('GET /api/visualizations/filter-options', () => {
    it('should return available filter options', async () => {
      const mockSchoolYears = [
        { school_year: '2024-2025' },
        { school_year: '2023-2024' }
      ];

      const mockTerms = [
        { term: '1st-term' },
        { term: '2nd-term' },
        { term: 'Summer-term' }
      ];

      mockPool.query
        .mockResolvedValueOnce({ rows: mockSchoolYears })
        .mockResolvedValueOnce({ rows: mockTerms });

      const response = await request(app)
        .get('/api/visualizations/filter-options')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.schoolYears).toEqual(['2024-2025', '2023-2024']);
      expect(response.body.data.terms).toHaveLength(3);
      expect(response.body.data.terms[0].value).toBe('1st');
      expect(response.body.data.terms[0].label).toBe('1st Semester');
    });

    it('should filter terms by school year', async () => {
      const mockFilteredTerms = [
        { term: '1st-term' },
        { term: '2nd-term' }
      ];

      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // school years (not used when filtering)
        .mockResolvedValueOnce({ rows: mockFilteredTerms });

      const response = await request(app)
        .get('/api/visualizations/filter-options?schoolYear=2024-2025')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.terms).toHaveLength(2);
      expect(response.body.data.terms[0].value).toBe('1st');
      expect(response.body.data.terms[1].value).toBe('2nd');
    });

    it('should handle various term formats', async () => {
      const mockMixedTerms = [
        { term: '1st-term' },
        { term: 'first' },
        { term: '2nd' },
        { term: 'Summer-term' }
      ];

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: mockMixedTerms });

      const response = await request(app)
        .get('/api/visualizations/filter-options')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.terms).toHaveLength(3); // Should deduplicate and normalize
      expect(response.body.data.terms.find(t => t.value === '1st')).toBeDefined();
      expect(response.body.data.terms.find(t => t.value === '2nd')).toBeDefined();
      expect(response.body.data.terms.find(t => t.value === 'Summer')).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/visualizations/violations/by-student')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });

    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        '/api/visualizations/violations/by-student',
        '/api/visualizations/violations/by-course',
        '/api/visualizations/violations/by-type',
        '/api/visualizations/violations/by-year-section',
        '/api/visualizations/violations/summary',
        '/api/visualizations/dashboard/json',
        '/api/visualizations/dashboard',
        '/api/visualizations/violations/daily-trends',
        '/api/visualizations/filter-options'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBe(401);
      }
    });
  });
});
