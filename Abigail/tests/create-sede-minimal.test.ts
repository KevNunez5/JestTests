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

describe('POST /sede - campos válidos', () => {
  it('Debe regresar 201 y crear la sede con los campos requeridos.', async () => {
    const res = await request(app)
      .post('/sede')
      .send({
        convocatoria: 'Convocatoria X',
        num_grupos: 3,
        fecha: '2025-05-20',
        nombre: 'Sede Testing'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message');
    expect(res.body.sede).toHaveProperty('id_sede');
  });
});