/**
 * @level unit
 * @description Unit tests for authentication endpoints and JWT functionality
 */
const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');

describe('Authentication Endpoints', () => {
  beforeEach(() => {
    mockPool.query.mockReset();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        full_name: 'Test User',
        password_hash: 'password123',
        role: 'counselor'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser]
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.role).toBe('counselor');
    });

    it('should login admin user with admin role', async () => {
      const mockAdmin = {
        id: 2,
        email: 'admin@university.edu',
        full_name: 'Admin User',
        password_hash: 'admin123',
        role: 'user'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockAdmin]
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@university.edu',
          password: 'admin123'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('admin');
    });

    it('should reject login with invalid credentials', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'test@example.com',
          password_hash: 'correctpassword',
          role: 'counselor'
        }]
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid email or password');
    });

    it('should reject login with non-existent user', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should require email field', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email is required');
    });

    it('should require password field', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password is required');
    });
  });

  describe('POST /api/auth/change-password', () => {
    let authToken;

    beforeEach(() => {
      authToken = jwt.sign(
        { id: 1, email: 'test@example.com', role: 'counselor' },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );
    });

    it('should change password successfully', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password_hash: 'oldpassword'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser]
      });

      mockPool.query.mockResolvedValueOnce({});

      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'NewPass123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password changed successfully');
    });

    it('should reject password change with invalid current password', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password_hash: 'correctpassword'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser]
      });

      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'NewPass123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Current password is incorrect');
    });

    it('should validate new password requirements', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password_hash: 'oldpassword'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser]
      });

      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must include at least one letter and one number');
    });

    it('should require both current and new passwords', async () => {
      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'oldpassword'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Both current and new passwords are required');
    });
  });

  describe('POST /api/auth/verify-current-password', () => {
    let authToken;

    beforeEach(() => {
      authToken = jwt.sign(
        { id: 1, email: 'test@example.com', role: 'counselor' },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );
    });

    it('should verify current password successfully', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password_hash: 'correctpassword'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser]
      });

      const response = await request(app)
        .post('/api/auth/verify-current-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'correctpassword'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password verified successfully');
    });

    it('should reject invalid current password', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password_hash: 'correctpassword'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser]
      });

      const response = await request(app)
        .post('/api/auth/verify-current-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'wrongpassword'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid password');
    });

    it('should require current password', async () => {
      const response = await request(app)
        .post('/api/auth/verify-current-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Current password is required');
    });
  });
});
