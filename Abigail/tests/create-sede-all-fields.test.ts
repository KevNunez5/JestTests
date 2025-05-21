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
          data: [{
            id_sede: 42, // mock ID
            nombre: 'Sede Completa',
            num_grupos: 5,
            fecha: '2025-05-20',
          }],
          error: null
        }))
      }))
    }))
  }
}));

describe('POST /sede with all fields', () => {
  it('Debe regresar 201 y crear la sede con los datos de sede.', async () => {
    const res = await request(app)
      .post('/sede')
      .send({
        convocatoria: 'Convocatoria Y',
        num_grupos: 5,
        fecha: '2025-05-20',
        nombre: 'Sede Completa',
        coordinadornombre: 'Coordinador Test',
        coordinadorcorreo: 'coordinador@test.com',
        mentoranombre: 'Mentora Test',
        mentoracorreo: 'mentora@test.com',
        informantenombre: 'Informante Test',
        informantecorreo: 'informante@test.com',
        asociadanombre: 'Asociada Test',
        asociadacorreo: 'asociada@test.com'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/Sede creada con 5 grupos/i);
    expect(res.body).toHaveProperty('sede');
    expect(res.body.sede).toHaveProperty('id_sede');
    expect(res.body.sede.nombre).toBe('Sede Completa');
  });
});
