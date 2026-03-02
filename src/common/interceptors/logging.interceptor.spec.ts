import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

// Mock del logger de Winston para evitar escritura a disco en tests
jest.mock('@/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const createMockContext = (method = 'GET', url = '/test/path', statusCode = 200): ExecutionContext => ({
  switchToHttp: () => ({
    getRequest: () => ({ method, url }),
    getResponse: () => ({ statusCode }),
  }),
}) as unknown as ExecutionContext;

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    jest.clearAllMocks();
  });

  it('loguea el request entrante y retorna la respuesta sin modificarla', (done) => {
    const { logger } = require('@/config/logger');
    const responseBody = { message: 'ok' };
    const next: CallHandler = { handle: () => of(responseBody) };
    const context = createMockContext('POST', '/api/v1/auth/login', 201);

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual(responseBody);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('POST'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('/api/v1/auth/login'));
      done();
    });
  });

  it('loguea la respuesta con status code y body serializado', (done) => {
    const { logger } = require('@/config/logger');
    const responseBody = { access_token: 'jwt' };
    const next: CallHandler = { handle: () => of(responseBody) };
    const context = createMockContext('POST', '/api/v1/auth/signup', 201);

    interceptor.intercept(context, next).subscribe(() => {
      const logCall = (logger.info as jest.Mock).mock.calls[1][0];
      expect(logCall).toContain('201');
      expect(logCall).toContain(JSON.stringify(responseBody));
      done();
    });
  });

  it('loguea "-" en el body cuando la respuesta es undefined', (done) => {
    const { logger } = require('@/config/logger');
    const next: CallHandler = { handle: () => of(undefined) };
    const context = createMockContext('GET', '/api/v1/auth/logout');

    interceptor.intercept(context, next).subscribe(() => {
      const logCall = (logger.info as jest.Mock).mock.calls[1][0];
      expect(logCall).toContain('| body: -');
      done();
    });
  });

  it('incluye el tiempo de respuesta en ms en el log', (done) => {
    const { logger } = require('@/config/logger');
    const next: CallHandler = { handle: () => of({ ok: true }) };
    const context = createMockContext();

    interceptor.intercept(context, next).subscribe(() => {
      const logCall = (logger.info as jest.Mock).mock.calls[1][0];
      expect(logCall).toMatch(/\d+ms/);
      done();
    });
  });
});
