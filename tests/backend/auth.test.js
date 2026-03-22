// tests/backend/auth.test.js
const request = require('supertest');
const app = require('../../backend/src/app');

describe('POST /api/auth/login', () => {
  it('returns 401 for bad credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@x.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns token for valid admin credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@examflow.dev', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('admin');
  });
});

describe('GET /api/exams/available', () => {
  let token;
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'arjun@student.dev', password: 'student123' });
    token = res.body.token;
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/exams/available');
    expect(res.status).toBe(401);
  });

  it('returns exam list for authenticated student', async () => {
    const res = await request(app)
      .get('/api/exams/available')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
