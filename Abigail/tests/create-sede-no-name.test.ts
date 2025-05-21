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
  it('Debe regresar 500 al faltar el campo requerido "nombre".', async () => {
    const res = await request(app)
      .post('/sede')
      .send({
        convocatoria: 'Convocatoria X',
        num_grupos: 3,
        fecha: '2025-05-20'
      });

    expect(res.statusCode).toEqual(500);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/Faltan campos obligatorios/i);
  });

  it('Debe regresar 500 si varios campos requeridos faltan.', async () => {
    const res = await request(app)
      .post('/sede')
      .send({
        convocatoria: 'Convocatoria X' // faltan num_grupos, fecha, nombre
      });

    expect(res.statusCode).toEqual(500);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/Faltan campos obligatorios/i);
  });

  it('Debe regresar 500 si no se envía ningún dato.', async () => {
    const res = await request(app)
      .post('/sede')
      .send({}); // vacío

    expect(res.statusCode).toEqual(500);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/Faltan campos obligatorios/i);
  });
});
