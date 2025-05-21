import request from 'supertest';
import express from 'express';
import router from '../pdfLogic';
import { supabase } from '../../supabaseClient';
import path from 'path';

jest.mock('../../supabaseClient');

const app = express();
app.use(express.json());
app.use('/', router);

// Ruta al archivo PDF dummy
const dummyPDFPath = path.resolve(__dirname, 'dummy.pdf');

// Mock de storage completo
const listBucketsMock = jest.fn();
const uploadMock = jest.fn();
const getPublicUrlMock = jest.fn();

(supabase as any).storage = {
  listBuckets: listBucketsMock,
  from: () => ({
    upload: uploadMock,
    getPublicUrl: getPublicUrlMock,
  }),
};

describe('POST /upload-pdf/:bucketName', () => {
  const bucketName = 'test-bucket';
  const fakeFileName = 'dummy.pdf';
  const fakeFilePath = `fake_path/${fakeFileName}`;
  const fakePublicUrl = `https://public-url/${fakeFileName}`;

  beforeEach(() => {
    jest.clearAllMocks();

    // Configurar mocks antes de cada test
    listBucketsMock.mockResolvedValue({
      data: [{ id: '1', name: bucketName }],
      error: null,
    });

    uploadMock.mockResolvedValue({
      data: { path: fakeFilePath },
      error: null,
    });

    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: fakePublicUrl },
    });
  });

  it('debe subir un PDF exitosamente y devolver la URL pública', async () => {
    const response = await request(app)
      .post(`/upload-pdf/${bucketName}`)
      .attach('pdf', dummyPDFPath);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.url).toBe(fakePublicUrl);
    expect(response.body.bucket).toBe(bucketName);
  });

  it('debe devolver error si no se envía archivo', async () => {
    const response = await request(app)
      .post(`/upload-pdf/${bucketName}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('No se subió ningún archivo');
  });

  it('debe devolver error si el bucket no existe', async () => {
    listBucketsMock.mockResolvedValue({
      data: [{ name: 'otro-bucket' }],
      error: null,
    });

    const response = await request(app)
      .post(`/upload-pdf/${bucketName}`)
      .attach('pdf', dummyPDFPath);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(`El bucket ${bucketName} no existe`);
  });

  it('debe manejar errores del Supabase al subir', async () => {
    uploadMock.mockResolvedValue({
      data: null,
      error: { message: 'Error de subida' },
    });

    const response = await request(app)
      .post(`/upload-pdf/${bucketName}`)
      .attach('pdf', dummyPDFPath);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Error al subir el archivo');
    expect(response.body.details).toBeDefined();
  });
});
