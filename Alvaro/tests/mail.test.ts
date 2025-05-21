import { Router } from 'express';
import mailRouter from './mail';
import { supabase } from '../supabaseClient';
import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

// Configura dotenv
dotenv.config();

// Mock de nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ response: '250 OK' }) // <- usa mockResolvedValue para async/await
  })
}));


// Mock de supabase
jest.mock('../supabaseClient', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    rpc: jest.fn().mockResolvedValue({ data: 'decryptedPassword123' })
  }
}));

describe('Endpoints de Correo', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let responseObject: any;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((result) => {
        responseObject = result;
        return mockResponse;
      })
    };
    mockNext = jest.fn();
    responseObject = null;
  });

  // Función helper para ejecutar un handler de ruta específico
  const executeRouteHandler = async (path: string, method: 'get' | 'post' | 'put' | 'delete') => {
    // Buscar la ruta en el router
    const layer = mailRouter.stack.find(
      (layer) => layer.route?.path === path && (layer.route && (layer.route as any).methods[method])
    );
    
    if (!layer) {
      throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
    }

    // Ejecutar el handler de la ruta
    if (!layer.route) {
      throw new Error(`Route object is undefined for path ${path}`);
    }
    const handler = layer.route.stack[0].handle;
    await handler(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );
  };

    describe('POST /enviar-correo-multiple', () => {
    it('debería enviar correos a múltiples destinatarios de diferentes tablas', async () => {
        // Configurar mocks para diferentes tablas
        (supabase.from as jest.Mock).mockImplementation((tableName: string) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
            data: {
            correo: `${tableName}@example.com`,
            nombre: `Usuario ${tableName}`,
            username: `user_${tableName}`,
            password: `encrypted_${tableName}`
            },
            error: null
        })
        }));

        mockRequest.body = {
        destinatarios: [
            { id: 1, tabla: 'facilitadora' },
            { id: 2, tabla: 'participante' },
            { id: 3, tabla: 'mentora' }
        ],
        asunto: 'Mensaje múltiple',
        contenido: 'Este es un correo para varios tipos de usuarios'
        };

        await executeRouteHandler('/enviar-correo-multiple', 'post');

        expect(responseObject.success).toBe(true);
        expect(responseObject.resultados).toHaveLength(3);
        expect(responseObject.resultados[0].destinatario).toBe('facilitadora@example.com');
        expect(responseObject.resultados[1].destinatario).toBe('participante@example.com');
        expect(responseObject.resultados[2].destinatario).toBe('mentora@example.com');
    });

    it('debería manejar errores cuando no se encuentra un destinatario', async () => {
        (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: 'No encontrado'
        })
        }));

        mockRequest.body = {
        destinatarios: [{ id: 99, tabla: 'participante' }],
        asunto: 'Correo no enviado',
        contenido: 'Este correo no debería llegar'
        };

        await executeRouteHandler('/enviar-correo-multiple', 'post');

        expect(responseObject.success).toBe(true);
        expect(responseObject.resultados[0].success).toBe(false);
        expect(responseObject.resultados[0].error).toBe('No se encontró el destinatario en la base de datos');
    });
    });

    describe('POST /enviar-correo-multiple/tablas/superusuario', () => {

    it('debería manejar tablas vacías correctamente', async () => {
        (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        mockResolvedValue: jest.fn().mockResolvedValue({
            data: [],
            error: null
        })
        }));

        mockRequest.body = {
        destinatarios: [{ tabla: 'staff' }],
        asunto: 'Mensaje para staff',
        contenido: 'Este correo no debería enviarse a nadie'
        };

        await executeRouteHandler('/enviar-correo-multiple/tablas/superusuario', 'post');

        expect(responseObject.success).toBe(true);
        expect(responseObject.resultados[0].success).toBe(false);
        expect(responseObject.resultados[0].error).toBe('No se encontraron registros en esta tabla');
    });
    });

    describe('POST /enviar-correo-multiple/tablas/coordinadora', () => {

    it('debería manejar errores de validación', async () => {
        mockRequest.body = {
        destinatarios: [{ tabla: 'facilitadora' }],
        // Faltan asunto y contenido
        idsede: 1
        };

        await executeRouteHandler('/enviar-correo-multiple/tablas/coordinadora', 'post');

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(responseObject.error).toBe('Faltan asunto o contenido');
    });
    });

    describe('POST /enviar-correo-simple', () => {
    it('debería enviar un correo simple correctamente', async () => {
        mockRequest.body = {
        correo: 'test@example.com',
        asunto: 'Asunto de prueba',
        contenido: 'Contenido de prueba',
        nombre: 'Usuario Test'
        };

        await executeRouteHandler('/enviar-correo-simple', 'post');

        expect(responseObject.success).toBe(true);
        expect(responseObject.destinatario).toBe('test@example.com');
        expect(responseObject.asunto).toBe('Asunto de prueba');
    });

    it('debería devolver error 400 si faltan campos requeridos', async () => {
        // Falta el campo 'contenido'
        mockRequest.body = {
        correo: 'test@example.com',
        asunto: 'Asunto de prueba'
        };

        await executeRouteHandler('/enviar-correo-simple', 'post');

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(responseObject.error).toContain('Faltan campos requeridos');
    });

    it('debería funcionar sin el campo nombre', async () => {
        mockRequest.body = {
        correo: 'test@example.com',
        asunto: 'Asunto sin nombre',
        contenido: 'Contenido sin nombre'
        };

        await executeRouteHandler('/enviar-correo-simple', 'post');

        expect(responseObject.success).toBe(true);
        expect(responseObject.message).toBe('Correo enviado exitosamente');
    });
    });

    describe('POST /enviar-correo-coordinadora-aceptado', () => {
    it('debería enviar correos a múltiples destinatarios exitosamente', async () => {
    // Mismo retorno simulado para todos los destinatarios
    (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
        data: {
            correo: 'multi@example.com',
            nombre: 'Destinatario',
            username: 'usuarioX',
            password: 'encryptedPasswordX'
        },
        error: null
        })
    });

    (supabase.rpc as jest.Mock).mockResolvedValue({
        data: 'passDesencriptada',
        error: null
    });

    mockRequest.body = {
        destinatarios: [
        { id: 1, tabla: 'coordinador' },
        { id: 2, tabla: 'coordinador' },
        { id: 3, tabla: 'coordinador' }
        ],
        asunto: 'Bienvenida múltiple',
        contenido: 'Este es un correo de prueba para varios'
    };

    await executeRouteHandler('/enviar-correo-coordinadora-aceptado', 'post');

    expect(responseObject.success).toBe(true);
    expect(responseObject.resultados).toHaveLength(3);
    expect(
    responseObject.resultados.every((r: { success: boolean }) => r.success)
    ).toBe(true);
    });
    });


  describe('POST /enviar-correo-coordinadora-rechazado', () => {
    it('debería devolver error 400 si faltan parámetros', async () => {
      mockRequest.body = {};
      
      await executeRouteHandler('/enviar-correo-coordinadora-rechazado', 'post');

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseObject.error).toBe('Se requiere una lista de destinatarios');
    });

    it('debería enviar correo correctamente', async () => {
      // Configurar mock de Supabase
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            correo: 'test@example.com',
            nombre: 'Test User'
          },
          error: null
        })
      }));

      mockRequest.body = {
        destinatarios: [{ id: 1, tabla: 'coordinador' }],
        asunto: 'Test Subject',
        contenido: 'Test Content'
      };

      await executeRouteHandler('/enviar-correo-coordinadora-rechazado', 'post');

      expect(mockResponse.json).toHaveBeenCalled();
      expect(responseObject.success).toBe(true);
      expect(responseObject.resultados[0].success).toBe(true);
    });
  });
});


