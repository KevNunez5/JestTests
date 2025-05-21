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
          data: [{ id_sede: 1, nombre: 'Sede Testing', num_grupos: 3, fecha: '2025-05-20' }],
          error: null
        }))
      }))
    }))
  }
}));

describe('POST /sede - campos faltantes', () => {
  it('Debe regresar 500 si faltan varios campos', async () => {
    const res = await request(app)
      .post('/sede')
      .send({
        num_groups: 4
      });

    expect(res.statusCode).toEqual(500);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/Faltan campos obligatorios/i);
  });
});
