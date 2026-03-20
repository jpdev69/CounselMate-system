const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');

describe('Admin Endpoints', () => {
  let adminToken;
  let counselorToken;

  beforeEach(() => {
    mockPool.query.mockReset();
    
    adminToken = jwt.sign(
      { id: 1, email: 'admin@university.edu', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    counselorToken = jwt.sign(
      { id: 2, email: 'counselor@example.com', role: 'counselor' },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );
  });

  describe('GET /api/admin/users', () => {
    it('should return all users for admin', async () => {
      const mockUsers = [
        {
          id: 1,
          email: 'admin@university.edu',
          full_name: 'Admin User',
          role: 'admin',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 2,
          email: 'counselor@example.com',
          full_name: 'Counselor User',
          role: 'counselor',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: mockUsers
      });

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.users).toHaveLength(2);
      expect(response.body.users[0].email).toBe('admin@university.edu');
    });

    it('should deny access for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${counselorToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Access denied');
    });

    it('should deny access without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/users');

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('should delete user successfully for admin', async () => {
      const mockUser = {
        id: 3,
        email: 'user@example.com',
        role: 'counselor'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser]
      });

      mockPool.query.mockResolvedValueOnce({});

      const response = await request(app)
        .delete('/api/admin/users/3')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should prevent deletion of main admin account', async () => {
      const mockAdmin = {
        id: 1,
        email: 'admin@university.edu',
        role: 'admin'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockAdmin]
      });

      const response = await request(app)
        .delete('/api/admin/users/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Cannot delete the main administrator account');
    });

    it('should return 404 for non-existent user', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .delete('/api/admin/users/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('User not found');
    });

    it('should deny access for non-admin users', async () => {
      const response = await request(app)
        .delete('/api/admin/users/3')
        .set('Authorization', `Bearer ${counselorToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/admin/users/:id/reset-password', () => {
    it('should reset user password successfully for admin', async () => {
      const mockUser = {
        id: 3,
        email: 'user@example.com'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser]
      });

      mockPool.query.mockResolvedValueOnce({});

      const response = await request(app)
        .put('/api/admin/users/3/reset-password')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password has been reset');
    });

    it('should return 404 for non-existent user', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .put('/api/admin/users/999/reset-password')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should deny access for non-admin users', async () => {
      const response = await request(app)
        .put('/api/admin/users/3/reset-password')
        .set('Authorization', `Bearer ${counselorToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/signup-requests', () => {
    it('should return all signup requests for admin', async () => {
      const mockRequests = [
        {
          id: 1,
          email: 'newuser@example.com',
          full_name: 'New User',
          reason: 'I need access to the system',
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: mockRequests
      });

      const response = await request(app)
        .get('/api/admin/signup-requests')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.requests).toHaveLength(1);
      expect(response.body.requests[0].email).toBe('newuser@example.com');
    });

    it('should deny access for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/signup-requests')
        .set('Authorization', `Bearer ${counselorToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/admin/signup-requests/:id', () => {
    it('should approve signup request and create user', async () => {
      const mockRequest = {
        id: 1,
        email: 'newuser@example.com',
        full_name: 'New User',
        reason: 'I need access',
        status: 'pending'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockRequest]
      });

      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      mockPool.query.mockResolvedValueOnce({});
      mockPool.query.mockResolvedValueOnce({});

      const response = await request(app)
        .put('/api/admin/signup-requests/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('approved successfully');
    });

    it('should reject signup request', async () => {
      const mockRequest = {
        id: 1,
        email: 'newuser@example.com',
        full_name: 'New User',
        reason: 'I need access',
        status: 'pending'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockRequest]
      });

      mockPool.query.mockResolvedValueOnce({});

      const response = await request(app)
        .put('/api/admin/signup-requests/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'rejected' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('rejected successfully');
    });

    it('should validate status value', async () => {
      const response = await request(app)
        .put('/api/admin/signup-requests/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Status must be either "approved" or "rejected"');
    });

    it('should return 404 for non-existent request', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .put('/api/admin/signup-requests/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
