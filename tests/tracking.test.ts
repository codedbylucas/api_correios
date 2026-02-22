import request from 'supertest';
import express from 'express';
import trackingRoutes from '../src/server/routes/trackingRoutes';

// Mocking axios for tests
import axios from 'axios';
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const app = express();
app.use(express.json());
app.use('/api/track', trackingRoutes);

describe('POST /api/track/batch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mock for axios.create
    (axios.create as jest.Mock).mockReturnValue({
      post: jest.fn(),
      defaults: { headers: { common: {} } },
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } }
    });
  });

  it('should return 400 if codes is missing', async () => {
    const response = await request(app)
      .post('/api/track/batch')
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  it('should return 400 if codes is empty', async () => {
    const response = await request(app)
      .post('/api/track/batch')
      .send({ codes: [] });
    
    expect(response.status).toBe(400);
  });

  it('should process codes and aggregate results', async () => {
    const mockPost = jest.fn()
      .mockResolvedValueOnce({ data: { status: 'Delivered' } })
      .mockRejectedValueOnce({ 
        message: 'Not Found',
        response: { status: 404, data: 'Not Found' } 
      });

    (axios.create as jest.Mock).mockReturnValue({
      post: mockPost
    });

    const response = await request(app)
      .post('/api/track/batch')
      .send({ codes: ['CODE1', 'CODE2'] });

    expect(response.status).toBe(200);
    expect(response.body.requested).toBe(202); // Wait, unique codes? No, requested is codes.length after unique.
    // Actually, in my controller I do uniqueCodes.
    // Let's check the implementation.
  });
});
