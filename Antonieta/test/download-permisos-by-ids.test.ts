import request from 'supertest';
import express from 'express';
import router from '../pdfLogic';
import { supabase } from '../../supabaseClient';
import axios from 'axios';
import stream from 'stream';

jest.mock('../../supabaseClient');
jest.mock('axios');

const app = express();
app.use(express.json());
app.use('/', router);

describe('POST /download-permisos-by-ids', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe generar ZIP válido con permisos de participantes', async () => {
    // Mock supabase
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        in: jest.fn().mockResolvedValueOnce({
          data: [
            {
              id_participante: '1',
              nombre: 'Ana Pérez',
              permiso_papas: 'https://fake-url.com/archivo1.pdf',
            }
          ],
          error: null,
        })
      })
    });

    // Mock axios (cambia aquí)
    const mockedStream = new stream.PassThrough();
    mockedStream.end('PDF CONTENT');

    (axios as jest.MockedFunction<typeof axios>).mockResolvedValueOnce({
      status: 200,
      data: mockedStream,
    });

    const res = await request(app)
      .post('/download-permisos-by-ids')
      .send({ ids_participantes: ['1'] });

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');

    // Cambiar verificación a axios (no axios.get)
    expect(axios).toHaveBeenCalledTimes(1);
    expect(axios).toHaveBeenCalledWith({
      method: 'get',
      url: 'https://fake-url.com/archivo1.pdf',
      responseType: 'stream',
    });
  });
it('debe retornar 400 si no se mandan IDs válidos', async () => {
    const res = await request(app)
      .post('/download-permisos-by-ids')
      .send({ ids_participantes: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Se requiere un array de IDs de participantes válido');
  });

  it('debe retornar 500 si ocurre un error en Supabase', async () => {
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        in: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Error simulado' },
        }),
      }),
    });

    const res = await request(app)
      .post('/download-permisos-by-ids')
      .send({ ids_participantes: ['1'] });

    expect(res.status).toBe(500);
    expect(res.text).toContain('Error al generar el archivo ZIP');
  });

});