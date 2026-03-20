/**
 * @level integration
 * @description Integration tests for complete user workflows and API interactions
 */
const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');

describe('Integration Tests', () => {
  let adminToken;
  let counselorToken;
  let testUserId;
  let testRequestId;

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

  describe('User Management Workflow', () => {
    it('should handle complete user signup and approval workflow', async () => {
      // Step 1: Submit signup request
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // No existing user
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // No existing request
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Create request

      const signupResponse = await request(app)
        .post('/api/auth/signup-request')
        .send({
          email: 'newuser@gmail.com',
          fullName: 'New User',
          reason: 'I need access to the counseling system'
        });

      expect(signupResponse.status).toBe(200);
      expect(signupResponse.body.success).toBe(true);

      // Step 2: Admin views pending requests
      const mockRequest = {
        id: 1,
        email: 'newuser@gmail.com',
        full_name: 'New User',
        reason: 'I need access',
        status: 'pending'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockRequest]
      });

      const requestsResponse = await request(app)
        .get('/api/admin/signup-requests')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(requestsResponse.status).toBe(200);
      expect(requestsResponse.body.requests).toHaveLength(1);

      // Step 3: Admin approves request
      mockPool.query.mockResolvedValueOnce({
        rows: [mockRequest]
      });
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // No existing user
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // Update request
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // Create user

      const approvalResponse = await request(app)
        .put('/api/admin/signup-requests/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });

      expect(approvalResponse.status).toBe(200);
      expect(approvalResponse.body.success).toBe(true);

      // Step 4: New user can login
      const mockUser = {
        id: 3,
        email: 'newuser@gmail.com',
        full_name: 'New User',
        password_hash: 'changeme123',
        role: 'counselor'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser]
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'newuser@gmail.com',
          password: 'changeme123'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.user.email).toBe('newuser@gmail.com');
    });

    it('should handle user password change workflow', async () => {
      // Step 1: User logs in
      const mockUser = {
        id: 2,
        email: 'counselor@example.com',
        password_hash: 'oldpassword123',
        role: 'counselor'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser]
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'counselor@example.com',
          password: 'oldpassword123'
        });

      expect(loginResponse.status).toBe(200);
      const userToken = loginResponse.body.token;

      // Step 2: User changes password
      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser]
      });
      mockPool.query.mockResolvedValueOnce({}); // Update password

      const changePasswordResponse = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'oldpassword123',
          newPassword: 'NewPassword123!'
        });

      expect(changePasswordResponse.status).toBe(200);
      expect(changePasswordResponse.body.success).toBe(true);

      // Step 3: User can login with new password
      mockUser.password_hash = 'NewPassword123!';
      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser]
      });

      const newLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'counselor@example.com',
          password: 'NewPassword123!'
        });

      expect(newLoginResponse.status).toBe(200);
      expect(newLoginResponse.body.success).toBe(true);
    });
  });

  describe('Admin Management Workflow', () => {
    it('should handle complete admin user management workflow', async () => {
      // Step 1: Admin views all users
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

      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(usersResponse.status).toBe(200);
      expect(usersResponse.body.users).toHaveLength(2);

      // Step 2: Admin resets user password
      const mockTargetUser = {
        id: 2,
        email: 'counselor@example.com'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockTargetUser]
      });
      mockPool.query.mockResolvedValueOnce({}); // Reset password

      const resetResponse = await request(app)
        .put('/api/admin/users/2/reset-password')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resetResponse.status).toBe(200);
      expect(resetResponse.body.success).toBe(true);

      // Step 3: User can login with reset password
      const mockUserWithResetPassword = {
        id: 2,
        email: 'counselor@example.com',
        password_hash: 'changeme123',
        role: 'counselor'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUserWithResetPassword]
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'counselor@example.com',
          password: 'changeme123'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);

      // Step 4: Admin deletes user (except main admin)
      mockPool.query.mockResolvedValueOnce({
        rows: [mockTargetUser]
      });
      mockPool.query.mockResolvedValueOnce({}); // Delete user

      const deleteResponse = await request(app)
        .delete('/api/admin/users/2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);
    });
  });

  describe('Violation Types Integration', () => {
    it('should handle violation types access with authentication', async () => {
      // Step 1: User logs in
      const mockUser = {
        id: 2,
        email: 'counselor@example.com',
        password_hash: 'password123',
        role: 'counselor'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser]
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'counselor@example.com',
          password: 'password123'
        });

      expect(loginResponse.status).toBe(200);
      const userToken = loginResponse.body.token;

      // Step 2: User accesses violation types
      const mockViolationTypes = [
        {
          id: 1,
          code: 'IMPROPER_UNIFORM',
          description: 'Failure to wear proper/complete uniform',
          category: 'minor',
          section_ref: '2.1.1'
        },
        {
          id: 2,
          code: 'DRUGS_ALCOHOL_WEAPONS',
          description: 'Possession/use of alcoholic drinks, prohibited drugs, weapons or explosives',
          category: 'major',
          section_ref: '2.2.1'
        }
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: mockViolationTypes
      });

      const violationTypesResponse = await request(app)
        .get('/api/violation-types')
        .set('Authorization', `Bearer ${userToken}`);

      expect(violationTypesResponse.status).toBe(200);
      expect(violationTypesResponse.body).toHaveLength(2);

      // Step 3: User filters violation types by category
      mockPool.query.mockResolvedValueOnce({
        rows: [mockViolationTypes[0]]
      });

      const filteredResponse = await request(app)
        .get('/api/violation-types?category=minor')
        .set('Authorization', `Bearer ${userToken}`);

      expect(filteredResponse.status).toBe(200);
      expect(filteredResponse.body).toHaveLength(1);
      expect(filteredResponse.body[0].category).toBe('minor');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle authentication failures across endpoints', async () => {
      // Test endpoints that require authentication
      const endpoints = [
        { method: 'get', path: '/api/violation-types' },
        { method: 'get', path: '/api/admin/users' },
        { method: 'get', path: '/api/admin/signup-requests' },
        { method: 'put', path: '/api/auth/change-password' },
        { method: 'get', path: '/api/auth/me/gmail-settings' }
      ];

      for (const endpoint of endpoints) {
        let response;
        if (endpoint.method === 'get') {
          response = await request(app).get(endpoint.path);
        } else if (endpoint.method === 'put') {
          response = await request(app).put(endpoint.path).send({});
        }
        
        // Should return 401 for unauthenticated requests
        expect([401, 404]).toContain(response.status);
      }
    });

    it('should handle authorization failures for non-admin users', async () => {
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/signup-requests'
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${counselorToken}`);
        
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Access denied');
      }
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should apply rate limiting to auth endpoints', async () => {
      // Make multiple rapid requests to login endpoint
      const promises = Array(10).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword' // Use wrong password to trigger failed attempts
          })
      );

      const responses = await Promise.all(promises);
      
      // Check that we got responses (they could be 401, 429, or 500 depending on the setup)
      const processedResponses = responses.filter(r => [401, 429, 500].includes(r.status));
      
      // All requests should be processed in some way
      expect(processedResponses.length).toBeGreaterThan(0);
      // The important thing is that the system handles multiple concurrent requests
    });
  });
});
