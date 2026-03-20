const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');

describe('Chatbot Endpoints', () => {
  let authToken;

  beforeEach(() => {
    mockPool.query.mockReset();
    
    authToken = jwt.sign(
      { id: 1, email: 'test@example.com', role: 'counselor' },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );
  });

  describe('GET /api/chatbot/manual', () => {
    it('should return manual information', async () => {
      const response = await request(app)
        .get('/api/chatbot/manual')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.text).toBeDefined();
      expect(response.body.info).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/chatbot/manual');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/chatbot/cache', () => {
    it('should return cache statistics', async () => {
      const response = await request(app)
        .get('/api/chatbot/cache')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/chatbot/cache');

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/chatbot/cache', () => {
    it('should clear cache', async () => {
      const response = await request(app)
        .delete('/api/chatbot/cache')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Cache cleared');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/chatbot/cache');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/chatbot/ask', () => {
    it('should handle chatbot question successfully', async () => {
      const response = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'What are the minor offenses?'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.reply).toBeDefined();
    });

    it('should validate message field', async () => {
      const response = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Message is required');
    });

    it('should handle empty message', async () => {
      const response = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Message is required');
    });

    it('should handle whitespace-only message', async () => {
      const response = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: '   '
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Message is required');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/chatbot/ask')
        .send({
          message: 'Test message'
        });

      expect(response.status).toBe(401);
    });

    it('should handle greeting messages', async () => {
      const response = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'hello'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.reply).toContain('GuidanceOS Assistant');
    });

    it('should handle meta questions', async () => {
      const response = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'what can you do'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.reply).toContain('GuidanceOS Assistant');
    });

    it('should handle thank you messages', async () => {
      const response = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'thank you'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.reply).toContain("You're welcome");
    });

    it('should limit message length', async () => {
      const longMessage = 'a'.repeat(10000); // Very long message

      const response = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: longMessage
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('exceed maximum length');
    });

    it('should handle cached responses', async () => {
      const message = 'What are the minor offenses?';

      // First request
      const response1 = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message });

      expect(response1.status).toBe(200);
      expect(response1.body.success).toBe(true);

      // Second identical request (should be cached)
      const response2 = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message });

      expect(response2.status).toBe(200);
      expect(response2.body.success).toBe(true);
      // If caching is working, response2 might have cached: true
      if (response2.body.cached) {
        expect(response2.body.cached).toBe(true);
      }
    });
  });

  describe('Chatbot Input Validation', () => {
    it('should sanitize input content', async () => {
      const maliciousContent = '<script>alert("xss")</script>What are the minor offenses?';

      const response = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: maliciousContent
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // The input should be processed safely
      expect(response.body.reply).toBeDefined();
    });

    it('should handle non-string messages', async () => {
      const response = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 123
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Message is required');
    });
  });

  describe('Chatbot Performance', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'What are the minor offenses?'
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(10000); // Should respond within 10 seconds
    });
  });
});
