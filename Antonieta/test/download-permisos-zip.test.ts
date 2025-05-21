import request from 'supertest';
import express from 'express';
import router from '../pdfLogic'; // Ajusta si está en otra ruta
import { supabase } from '../../supabaseClient';
import axios from 'axios';
import stream from 'stream';

jest.mock('axios');

jest.mock('../../supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(),
      eq: jest.fn()
    }))
  }
}));

const app = express();
app.use(express.json());
app.use('/', router);

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /download-permisos-zip', () => {
  const sedes = [
    { id: 1, nombre: 'Sede A' },
    { id: 2, nombre: 'Sede B' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe generar ZIP con permisos por sede', async () => {
    // Stub de participantes válidos
    const participantesStub = [
      {
        nombre: 'Ana',
        permiso_papas: 'http://example.com/permiso1.pdf'
      },
      {
        nombre: 'Luis',
        permiso_papas: 'si' // debe ignorarse
      }
    ];

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: participantesStub, error: null })
    });

    // Mock de axios.get para cada permiso
    (axios.get as jest.Mock).mockImplementation(url => {
      const pass = new stream.PassThrough();
      process.nextTick(() => {
        pass.write('contenido de ' + url);
        pass.end();
      });
      return Promise.resolve({ data: pass });
    });

    const res = await request(app)
      .post('/download-permisos-zip')
      .send({ sedes });

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/zip');
    expect(res.header['content-disposition']).toContain('permisos_sedes.zip');
  });

  it('debe manejar error de Supabase por sede', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'error en consulta' } })
    });

    const res = await request(app)
      .post('/download-permisos-zip')
      .send({ sedes: [sedes[0]] });

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/zip');
  });

  it('debe agregar archivo de error si axios falla en descarga', async () => {
    const participantesStub = [
      {
        nombre: 'Ana',
        permiso_papas: 'http://example.com/falla.pdf'
      }
    ];

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: participantesStub, error: null })
    });

    (axios.get as jest.Mock).mockRejectedValue(new Error('Descarga fallida'));

    const res = await request(app)
      .post('/download-permisos-zip')
      .send({ sedes: [sedes[0]] });

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/zip');
  });

  it('debe devolver 400 si sedes no es válido', async () => {
    const res = await request(app)
      .post('/download-permisos-zip')
      .send({ sedes: 'no es un array' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Se requiere un array de sedes válido');
  });
});
