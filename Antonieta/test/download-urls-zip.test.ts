import request from 'supertest';
import express from 'express';
import router from '../pdfLogic'; // Ajusta la ruta a donde esté tu router
import axios from 'axios';
import stream from 'stream';

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});


jest.mock('axios');

const app = express();
app.use(express.json());
app.use('/', router);

describe('POST /download-urls-zip', () => {
  const validUrls = [
    'http://example.com/file1.txt',
    'http://example.com/file2.jpg'
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe devolver ZIP con archivos descargados', async () => {
    // Mock/Stub axios para simular stream de archivo
    (axios.get as jest.Mock).mockImplementation((url: string) => {
      const passThrough = new stream.PassThrough();
      process.nextTick(() => {
        passThrough.write('contenido de ' + url);
        passThrough.end();
      });

      return Promise.resolve({
        status: 200,
        data: passThrough,
        headers: {},
        config: {},
        statusText: 'OK',
      });
    });

    const response = await request(app)
      .post('/download-urls-zip')
      .send({ urls: validUrls });

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe('application/zip');
    expect(response.header['content-disposition']).toContain('descargas.zip');
  });

  it('debe manejar URLs inválidas y agregarlas como archivo de error en ZIP', async () => {
    (axios.get as jest.Mock).mockImplementation((url: string) => {
    if (url === validUrls[0]) {
        const passThrough = new stream.PassThrough();
        process.nextTick(() => {
          passThrough.write('contenido válido');
          passThrough.end();
        });
        return Promise.resolve({
          status: 200,
          data: passThrough,
          headers: {},
          config: {},
          statusText: 'OK',
        });
      } else {
        return Promise.reject(new Error('URL inválida simulada'));
      }
    });

    const response = await request(app)
      .post('/download-urls-zip')
      .send({ urls: [validUrls[0], '', null, 'http://bad.url/file.txt'] });

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe('application/zip');
  });

  it('debe devolver error 400 si urls no es un array válido', async () => {
    const response = await request(app)
      .post('/download-urls-zip')
      .send({ urls: '' });  // No es un array válido

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Se requiere un array de URLs válido');
  });

  it('debe devolver ZIP con archivo de error si falla la descarga (simulación error axios)', async () => {
    (axios.get as jest.Mock).mockRejectedValue(new Error('Error en descarga simulada'));

    const response = await request(app)
      .post('/download-urls-zip')
      .send({ urls: validUrls });

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe('application/zip');
  });
});
