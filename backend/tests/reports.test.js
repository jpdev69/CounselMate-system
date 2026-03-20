const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');

describe('Reports Endpoints', () => {
  let authToken;

  beforeEach(() => {
    mockPool.query.mockReset();
    
    authToken = jwt.sign(
      { id: 1, email: 'test@example.com', role: 'counselor' },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );
  });

  describe('GET /api/reports', () => {
    it('should return all student reports', async () => {
      const mockReports = [
        {
          id: 1,
          student_id: 1,
          violation_type_id: 1,
          description: 'Student found sharing inappropriate materials',
          remarks: 'Counselling session scheduled',
          course: 'Bachelor of Science in Information Technology',
          school_year: '2024-2025',
          term: '1st Semester',
          year: '3rd Year',
          section: 'C',
          status: 'reported',
          created_at: new Date('2024-01-15T14:20:00Z'),
          updated_at: new Date('2024-01-15T14:20:00Z'),
          student_name: 'John Doe',
          violation_code: 'PORNOGRAPHIC_MATERIALS',
          violation_description: 'Pornographic materials',
          violation_category: 'minor'
        },
        {
          id: 2,
          student_id: 2,
          violation_type_id: 3,
          description: 'Student found possessing prohibited items',
          remarks: 'Serious offense - requires disciplinary action',
          course: 'Bachelor of Arts in Psychology',
          school_year: '2024-2025',
          term: '1st Semester',
          year: '2nd Year',
          section: 'B',
          status: 'investigating',
          created_at: new Date('2024-01-14T10:30:00Z'),
          updated_at: new Date('2024-01-15T09:15:00Z'),
          student_name: 'Jane Smith',
          violation_code: 'DRUGS_ALCOHOL_WEAPONS',
          violation_description: 'Drugs, alcohol, weapons',
          violation_category: 'major'
        }
      ];

      mockPool.query.mockResolvedValue({
        rows: mockReports
      });

      const response = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].student_name).toBe('John Doe');
      expect(response.body[0].violation_category).toBe('minor');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/reports');

      expect(response.status).toBe(401);
    });

    it('should handle database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/reports', () => {
    it('should create a new student report with existing student', async () => {
      const newReport = {
        student_id: 1,
        violation_type_id: 2,
        description: 'Student caught littering in the cafeteria',
        remarks: 'First offense - verbal warning given',
        course: 'Bachelor of Science in Computer Science',
        school_year: '2024-2025',
        term: '1st Semester',
        year: '1st Year',
        section: 'A'
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Student exists
        .mockResolvedValueOnce({ rows: [{ id: 3, ...newReport, status: 'reported' }] }) // Create report
        .mockResolvedValueOnce({ rows: [{ id: 3, student_name: 'Test Student', status: 'reported', ...newReport }] }); // Return joined report

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newReport);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.report.id).toBe(3);
      expect(response.body.report.status).toBe('reported');
    });

    it('should create a new student report with new student', async () => {
      const newReport = {
        studentName: 'John Doe',
        year: '1st Year',
        section: 'A',
        violation_type_id: 2,
        description: 'Student caught littering',
        course: 'Bachelor of Science',
        school_year: '2024-2025',
        term: '1st Semester'
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 3, student_id: 'STU-123' }] }) // Create student
        .mockResolvedValueOnce({ rows: [{ id: 1, ...newReport, status: 'reported' }] }) // Create report
        .mockResolvedValueOnce({ rows: [{ id: 1, student_name: 'John Doe', ...newReport }] }); // Return joined report

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newReport);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.report.student_name).toBe('John Doe');
    });

    it('should validate required fields', async () => {
      const incompleteReport = {
        student_id: 1,
        // Missing violation_type_id
        description: 'Test description'
      };

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteReport);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Violation type is required');
    });

    it('should validate description is required', async () => {
      const incompleteReport = {
        student_id: 1,
        violation_type_id: 1,
        // Missing description
      };

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteReport);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Violation description is required');
    });

    it('should validate student exists when student_id provided', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // Student not found

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          student_id: 999,
          violation_type_id: 1,
          description: 'Test description',
          course: 'Test Course',
          school_year: '2024-2025',
          term: '1st Semester',
          year: '1st Year',
          section: 'A'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Provided student_id not found');
    });

    it('should validate student name and section when no student_id', async () => {
      const incompleteReport = {
        violation_type_id: 1,
        description: 'Test description'
        // Missing studentName and section
      };

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteReport);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Student name and section are required');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/reports')
        .send({
          student_id: 1,
          violation_type_id: 1,
          description: 'Test description'
        });

      expect(response.status).toBe(401);
    });

    it('should handle database errors during creation', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          student_id: 1,
          violation_type_id: 1,
          description: 'Test description'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to create report');
    });
  });

  describe('PUT /api/reports/:id', () => {
    it('should update a report description', async () => {
      const updatedReport = {
        description: 'Updated description'
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Report exists
        .mockResolvedValueOnce({ rows: [{ id: 1, ...updatedReport }] }); // Updated

      const response = await request(app)
        .put('/api/reports/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedReport);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.report.description).toBe('Updated description');
    });

    it('should update a report remarks', async () => {
      const updatedReport = {
        remarks: 'Updated remarks'
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Report exists
        .mockResolvedValueOnce({ rows: [{ id: 1, ...updatedReport }] }); // Updated

      const response = await request(app)
        .put('/api/reports/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedReport);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.report.remarks).toBe('Updated remarks');
    });

    it('should update both description and remarks', async () => {
      const updatedReport = {
        description: 'Updated description',
        remarks: 'Updated remarks'
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Report exists
        .mockResolvedValueOnce({ rows: [{ id: 1, ...updatedReport }] }); // Updated

      const response = await request(app)
        .put('/api/reports/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedReport);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.report.description).toBe('Updated description');
      expect(response.body.report.remarks).toBe('Updated remarks');
    });

    it('should validate that description or remarks is provided', async () => {
      const response = await request(app)
        .put('/api/reports/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}); // Empty body

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Description or remarks is required for update');
    });

    it('should return 404 for non-existent report', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: []
      }); // Report not found

      const response = await request(app)
        .put('/api/reports/999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated description'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Report not found');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/reports/1')
        .send({
          description: 'Updated description'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/reports/:id/resolve', () => {
    it('should resolve a report with remarks', async () => {
      const resolveData = {
        remarks: 'Case resolved successfully'
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'resolved' }] }) // Update status
        .mockResolvedValueOnce({ rows: [{ id: 1, student_name: 'John Doe', status: 'resolved' }] }); // Return joined report

      const response = await request(app)
        .put('/api/reports/1/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send(resolveData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.report.status).toBe('resolved');
    });

    it('should resolve a report without remarks', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'resolved' }] }) // Update status
        .mockResolvedValueOnce({ rows: [{ id: 1, student_name: 'John Doe', status: 'resolved' }] }); // Return joined report

      const response = await request(app)
        .put('/api/reports/1/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.report.status).toBe('resolved');
    });

    it('should return 404 for non-existent report', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: []
      }); // Report not found

      const response = await request(app)
        .put('/api/reports/999/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          remarks: 'Test remarks'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Report not found');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/reports/1/resolve')
        .send({
          remarks: 'Test remarks'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/reports/:id', () => {
    it('should delete a report', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'reported' }] }) // Report exists
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Deleted

      const response = await request(app)
        .delete('/api/reports/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should return 404 for non-existent report', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: []
      }); // Report not found

      const response = await request(app)
        .delete('/api/reports/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Report not found');
    });

    it('should validate report id', async () => {
      const response = await request(app)
        .delete('/api/reports/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid report id');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/reports/1');

      expect(response.status).toBe(401);
    });
  });

  describe('Report Creation with Student Override', () => {
    it('should update existing student when override is enabled', async () => {
      const newReport = {
        student_id: 1,
        violation_type_id: 2,
        description: 'Test violation',
        year: '2nd Year',
        section: 'B',
        course: 'Updated Course',
        school_year: '2024-2025',
        term: '2nd Semester',
        updateExistingStudent: true
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Student exists
        .mockResolvedValueOnce({ rows: [{ value: 'true' }] }) // Override enabled
        .mockResolvedValueOnce({ rows: [] }) // Update student
        .mockResolvedValueOnce({ rows: [{ id: 3, ...newReport, status: 'reported' }] }) // Create report
        .mockResolvedValueOnce({ rows: [{ id: 3, student_name: 'Test Student', ...newReport }] }); // Return joined report

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newReport);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not update student when override is disabled', async () => {
      const newReport = {
        student_id: 1,
        violation_type_id: 2,
        description: 'Test violation',
        year: '2nd Year',
        section: 'B',
        course: 'Updated Course',
        school_year: '2024-2025',
        term: '2nd Semester',
        updateExistingStudent: true
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Student exists
        .mockResolvedValueOnce({ rows: [] }) // Override not enabled
        .mockResolvedValueOnce({ rows: [{ id: 3, ...newReport, status: 'reported' }] }) // Create report
        .mockResolvedValueOnce({ rows: [{ id: 3, student_name: 'Test Student', ...newReport }] }); // Return joined report

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newReport);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
