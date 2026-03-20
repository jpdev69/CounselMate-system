const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');

describe('API Endpoints', () => {
  let authToken;

  beforeEach(() => {
    mockPool.query.mockReset();
    
    authToken = jwt.sign(
      { id: 1, email: 'test@example.com', role: 'counselor' },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.message).toContain('GuidanceOS Backend Running');
    });
  });

  describe('GET /api/violation-types', () => {
    it('should return all violation types', async () => {
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

      const response = await request(app)
        .get('/api/violation-types')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].category).toBe('minor');
      expect(response.body[1].category).toBe('major');
    });

    it('should filter violation types by category', async () => {
      const mockMinorViolations = [
        {
          id: 1,
          code: 'IMPROPER_UNIFORM',
          description: 'Failure to wear proper/complete uniform',
          category: 'minor',
          section_ref: '2.1.1'
        }
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: mockMinorViolations
      });

      const response = await request(app)
        .get('/api/violation-types?category=minor')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].category).toBe('minor');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/violation-types');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/signup-request', () => {
    it('should create signup request with valid data', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({});

      const response = await request(app)
        .post('/api/auth/signup-request')
        .send({
          email: 'newuser@gmail.com',
          fullName: 'New User',
          reason: 'I need access to the counseling system'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('submitted successfully');
    });

    it('should reject non-Gmail addresses', async () => {
      const response = await request(app)
        .post('/api/auth/signup-request')
        .send({
          email: 'newuser@yahoo.com',
          fullName: 'New User',
          reason: 'I need access to the counseling system'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Only Gmail addresses are allowed');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/signup-request')
        .send({
          email: 'newuser@gmail.com',
          fullName: 'New User'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('All fields are required');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/signup-request')
        .send({
          email: 'invalid-email',
          fullName: 'New User',
          reason: 'I need access to the counseling system'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('valid email address');
    });

    it('should reject duplicate email requests', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ 
        rows: [{ email: 'newuser@gmail.com', status: 'pending' }] 
      });

      const response = await request(app)
        .post('/api/auth/signup-request')
        .send({
          email: 'newuser@gmail.com',
          fullName: 'New User',
          reason: 'I need access to the counseling system'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already pending');
    });
  });

  describe('GET /api/auth/me/gmail-settings', () => {
    it('should return Gmail settings', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ recovery_email: 'recovery@example.com' }]
      });

      const response = await request(app)
        .get('/api/auth/me/gmail-settings')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.gmailReady).toBeDefined();
      expect(response.body.recoveryEmail).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/auth/me/gmail-settings');

      expect(response.status).toBe(401);
    });
  });
});
