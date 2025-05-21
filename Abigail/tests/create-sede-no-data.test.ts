import request from 'supertest';
import express from 'express';
import router from './sede';

const app = express();
app.use(express.json());
app.use('/sede', router);

jest.mock('axios', () => ({
  post: jest.fn(() => Promise.resolve({ data: {} }))
}));

jest.mock('../supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          data: [],
          error: null
        }))
      }))
    }))
  }
}));

describe('POST /sede with no data', () => {
  it('Debe regresar 500 si no se da información requerida.', async () => {
    const res = await request(app)
      .post('/sede')
      .send({}); // Sending empty body

    expect(res.statusCode).toEqual(500);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/faltan campos obligatorios/i);
  });
});
