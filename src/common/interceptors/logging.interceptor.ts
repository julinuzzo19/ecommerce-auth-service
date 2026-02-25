import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { logger } from '@/config/logger';

// Interceptor global que loguea cada request y response HTTP.
// Se registra en main.ts via app.useGlobalInterceptors().
// A diferencia del morgan middleware (que loguea al recibir el request),
// este loguea después de que el handler responde, permitiendo medir el tiempo real
// de procesamiento e incluir el status code y body de la respuesta.
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url } = request;
    const start = Date.now();

    logger.info(`→ ${method} ${url}`);

    // next.handle() ejecuta el route handler y devuelve un Observable con la respuesta.
    // tap(responseBody) recibe el valor retornado por el controller antes de serializarse.
    // Nota: si el controller usa @Res() sin passthrough, responseBody será undefined
    // porque el controller tomó control directo del response object.
    return next.handle().pipe(
      tap((responseBody) => {
        const ms = Date.now() - start;
        const status = response.statusCode;
        const body =
          responseBody !== undefined ? JSON.stringify(responseBody) : '-';
        logger.info(`← ${method} ${url} ${status} - ${ms}ms | body: ${body}`);
      }),
    );
  }
}
