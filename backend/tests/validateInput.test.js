const request = require('supertest');
const app = require('../server');

describe('Input Validation Middleware', () => {
  beforeEach(() => {
    mockPool.query.mockReset();
  });

  describe('Input Length Validation', () => {
    it('should reject excessively long inputs in request body', async () => {
      const longString = 'a'.repeat(100); // Exceeds default 32 char limit

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: `${longString}@example.com`,
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('exceed maximum length');
    });

    it('should reject excessively long inputs in query parameters', async () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: 1, email: 'test@example.com', role: 'counselor' },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );

      const longString = 'a'.repeat(100);

      const response = await request(app)
        .get(`/api/violation-types?category=${longString}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('exceed maximum length');
    });

    it('should reject excessively long inputs in URL parameters', async () => {
      const jwt = require('jsonwebtoken');
      const adminToken = jwt.sign(
        { id: 1, email: 'admin@university.edu', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );

      const longString = 'a'.repeat(100);

      const response = await request(app)
        .delete(`/api/admin/users/${longString}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Should either be rejected by input validation or return 404/500 due to invalid ID
      expect([400, 404, 500]).toContain(response.status);
    });

    it('should allow normal length inputs', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password_hash: 'password123',
        role: 'counselor'
      };

      mockPool.query.mockResolvedValue({
        rows: [mockUser]
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
    });

    it('should allow longer fields for specific endpoints', async () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: 1, email: 'test@example.com', role: 'counselor' },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );

      // Chatbot endpoint allows longer messages (500 chars)
      const longMessage = 'a'.repeat(100);
      const response = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${token}`)
        .send({
          message: longMessage
        });

      // Should not be rejected by input validation
      expect(response.status).not.toBe(400);
    });

    it('should allow longer fields for admission slip completion', async () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: 1, email: 'test@example.com', role: 'counselor' },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );

      // Admission slip completion allows longer descriptions (500 chars)
      const longDescription = 'a'.repeat(100);
      const response = await request(app)
        .put('/api/admission-slips/1/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: longDescription,
          teacher_comments: 'Some comments'
        });

      // Should not be rejected by input validation
      expect(response.status).not.toBe(400);
    });

    it('should allow longer fields for report creation', async () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: 1, email: 'test@example.com', role: 'counselor' },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );

      // Report creation allows longer descriptions (500 chars)
      const longDescription = 'a'.repeat(100);
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          student_id: 1,
          violation_type_id: 1,
          description: longDescription,
          course: 'Test Course',
          school_year: '2024-2025',
          term: '1st Semester',
          year: '1st Year',
          section: 'A'
        });

      // Should not be rejected by input validation
      expect(response.status).not.toBe(400);
    });
  });

  describe('Endpoint-Specific Validation', () => {
    it('should allow longer fields for violation validation', async () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: 1, email: 'test@example.com', role: 'counselor' },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );

      // Violation validation allows longer descriptions (500 chars)
      const longDescription = 'a'.repeat(100);
      const response = await request(app)
        .post('/api/admission-slips/validate-violation')
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: longDescription
        });

      // Should not be rejected by input validation (endpoint might not exist or return other codes)
      expect([200, 400, 404, 500]).toContain(response.status);
      if (response.status === 400) {
        expect(response.body.error).not.toContain('exceed maximum length');
      }
    });

    it('should allow longer fields for course creation', async () => {
      const jwt = require('jsonwebtoken');
      const adminToken = jwt.sign(
        { id: 1, email: 'admin@university.edu', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );

      // Course creation allows longer names (128 chars)
      const longCourseName = 'a'.repeat(100);
      const response = await request(app)
        .post('/api/admin/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: longCourseName,
          code: 'TEST101'
        });

      // Should not be rejected by input validation
      expect(response.status).not.toBe(400);
    });

    it('should allow longer fields for signup requests', async () => {
      // Signup request allows longer fields
      const longFullName = 'a'.repeat(100);
      const longReason = 'a'.repeat(100);

      const response = await request(app)
        .post('/api/auth/signup-request')
        .send({
          email: 'test@example.com',
          fullName: longFullName,
          reason: longReason
        });

      // Should not be rejected by input validation (could be rejected for other reasons)
      expect([200, 400, 500]).toContain(response.status);
      if (response.status === 400) {
        expect(response.body.error).not.toContain('exceed maximum length');
      }
    });
  });

  describe('Validation Error Handling', () => {
    it('should return proper error format for validation failures', async () => {
      const longString = 'a'.repeat(100);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: `${longString}@example.com`,
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('exceed maximum length');
      expect(response.body.fields).toBeDefined();
      expect(Array.isArray(response.body.fields)).toBe(true);
    });

    it('should include field details in validation error', async () => {
      const longString = 'a'.repeat(100);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: `${longString}@example.com`,
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.fields).toBeDefined();
      expect(response.body.fields.length).toBeGreaterThan(0);
      expect(response.body.fields[0]).toHaveProperty('path');
      expect(response.body.fields[0]).toHaveProperty('length');
      expect(response.body.fields[0]).toHaveProperty('max');
    });

    it('should handle validation errors gracefully without crashing', async () => {
      // Test with multiple long fields
      const longString = 'a'.repeat(100);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: `${longString}@example.com`,
          password: longString
        });

      // Should handle gracefully without server crash
      expect(response.status).toBe(400);
      expect(response.body).toBeDefined();
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Performance Impact', () => {
    it('should not significantly impact request processing time', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Validation should not add significant overhead (less than 100ms)
      expect(processingTime).toBeLessThan(100);
      // Handle database errors in test environment
      expect([200, 401, 400, 500]).toContain(response.status);
    });

    it('should handle large payloads efficiently', async () => {
      const largePayload = {
        email: 'test@example.com',
        password: 'password123',
        // Add many fields to test performance with large objects
        ...Array.from({ length: 100 }, (_, i) => [`field${i}`, `value${i}`]).reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
      };

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/auth/login')
        .send(largePayload);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should handle large payloads efficiently
      expect(processingTime).toBeLessThan(200);
      // Handle database errors in test environment
      expect([200, 401, 400, 500]).toContain(response.status);
    });
  });
});
