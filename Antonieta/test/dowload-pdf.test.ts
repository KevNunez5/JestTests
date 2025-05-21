import request from 'supertest';
import express from 'express';
import router from '../pdfLogic';
import { supabase } from '../../supabaseClient';

jest.mock('../../supabaseClient');

const app = express();
app.use('/', router);

describe('GET /download-bucket-zip/:bucketName', () => {
  const bucketName = 'test-bucket';

  const mockList = jest.fn();
  const mockDownload = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (supabase as any).storage = {
      from: () => ({
        list: mockList,
        download: mockDownload,
      }),
    };
  });

  it('debe descargar archivos como ZIP si hay archivos válidos', async () => {
    mockList.mockResolvedValue({
      data: [
        { name: 'archivo1.txt' },
        { name: 'archivo2.pdf' },
      ],
      error: null,
    });

    mockDownload.mockResolvedValue({
      data: new Blob(['Contenido del archivo']),
      error: null,
    });

    const response = await request(app).get(`/download-bucket-zip/${bucketName}`);

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe('application/zip');
    expect(response.header['content-disposition']).toContain(`${bucketName}.zip`);
  });

  it('debe responder con aviso si no hay archivos válidos', async () => {
    mockList.mockResolvedValue({
      data: [],
      error: null,
    });

    const response = await request(app).get(`/download-bucket-zip/${bucketName}`);

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe('application/zip');
  });

  it('debe responder con error 400 si no se proporciona bucketName', async () => {
    const response = await request(app).get(`/download-bucket-zip/%20 `); // %20 = espacio codificado
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Nombre del bucket no proporcionado');
  });

  it('debe responder con error 500 si falla al listar archivos', async () => {
    mockList.mockResolvedValue({
      data: null,
      error: { message: 'Fallo en listado' },
    });

    const response = await request(app).get(`/download-bucket-zip/${bucketName}`);

    // Debug para ver qué recibes realmente
    // console.log('Response headers:', response.headers);
    // console.log('Response body:', response.body);
    // console.log('Response text:', response.text);

    expect(response.status).toBe(500);

    // Si el content-type no es json, parsea manualmente el body
    if (!response.headers['content-type']?.includes('json')) {
      const body = JSON.parse(response.text);
      expect(body.error).toBe('Error al generar el archivo ZIP');
      expect(body.details).toBeDefined();
    } else {
      expect(response.body).toBeDefined();
      expect(response.body.error).toBe('Error al generar el archivo ZIP');
      expect(response.body.details).toBeDefined();
    }
  });
});
