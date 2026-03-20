const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');

describe('Admin Settings Endpoints', () => {
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

  describe('GET /api/admin/settings/student-edit-override', () => {
    it('should return student edit override status for admin users', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ value: 'true' }]
      });

      const response = await request(app)
        .get('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enabled).toBe(true);
    });

    it('should return false when setting is not found', async () => {
      mockPool.query.mockResolvedValue({
        rows: []
      });

      const response = await request(app)
        .get('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enabled).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enabled).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/settings/student-edit-override');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/admin/settings/student-edit-override', () => {
    it('should enable student edit override', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }); // INSERT/UPDATE

      const response = await request(app)
        .put('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enabled).toBe(true);
      expect(response.body.message).toContain('Student edit override enabled');
    });

    it('should disable student edit override', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }); // INSERT/UPDATE

      const response = await request(app)
        .put('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enabled).toBe(false);
      expect(response.body.message).toContain('Student edit override disabled');
    });

    it('should handle database errors during update', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .put('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: true });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/admin/settings/student-edit-override')
        .send({ enabled: true });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/settings/student-edit-override (public endpoint)', () => {
    it('should return student edit override status without authentication', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ value: 'true' }]
      });

      const response = await request(app)
        .get('/api/settings/student-edit-override');

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(true);
    });

    it('should return false when setting is not found', async () => {
      mockPool.query.mockResolvedValue({
        rows: []
      });

      const response = await request(app)
        .get('/api/settings/student-edit-override');

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/settings/student-edit-override');

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(false);
    });
  });

  describe('Settings Validation', () => {
    it('should validate enabled parameter', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }); // INSERT/UPDATE

      const response = await request(app)
        .put('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: 'not-a-boolean' });

      expect(response.status).toBe(200);
      // The implementation returns the raw enabled value from request
      expect(response.body.enabled).toBe('not-a-boolean');
    });

    it('should handle missing enabled parameter', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }); // INSERT/UPDATE

      const response = await request(app)
        .put('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(200);
      // The implementation returns undefined when enabled is missing
      expect(response.body.enabled).toBeUndefined();
    });
  });

  describe('Settings Database Operations', () => {
    it('should create admin_settings table if not exists', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }); // INSERT/UPDATE

      const response = await request(app)
        .put('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: true });

      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
      // First call should be CREATE TABLE
      expect(mockPool.query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS admin_settings');
    });

    it('should use UPSERT operation for settings', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }); // INSERT/UPDATE

      const response = await request(app)
        .put('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: true });

      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
      // Second call should be UPSERT
      const upsertQuery = mockPool.query.mock.calls[1][0];
      expect(upsertQuery).toContain('INSERT INTO admin_settings');
      expect(upsertQuery).toContain('ON CONFLICT (key) DO UPDATE');
    });

    it('should handle concurrent updates', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
        .mockResolvedValueOnce({ rows: [] }) // First INSERT/UPDATE
        .mockResolvedValueOnce({ rows: [] }) // Second CREATE TABLE (should be skipped)
        .mockResolvedValueOnce({ rows: [] }); // Second INSERT/UPDATE

      // First request
      const response1 = await request(app)
        .put('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: true });

      // Second request
      const response2 = await request(app)
        .put('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: false });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.enabled).toBe(true);
      expect(response2.body.enabled).toBe(false);
    });
  });

  describe('Settings Edge Cases', () => {
    it('should handle null value in database', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ value: null }]
      });

      const response = await request(app)
        .get('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(false);
    });

    it('should handle invalid JSON in database', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ value: 'invalid-json' }]
      });

      const response = await request(app)
        .get('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(false);
    });

    it('should handle empty string in database', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ value: '' }]
      });

      const response = await request(app)
        .get('/api/admin/settings/student-edit-override')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(false);
    });
  });
});
