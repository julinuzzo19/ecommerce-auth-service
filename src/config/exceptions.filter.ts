import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { Request, Response } from "express";
import { logger } from "./logger";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseData: string | { error: string; message: any; statusCode: number } =
      exception instanceof HttpException
        ? (exception.getResponse() as {
            error: string;
            message: any;
            statusCode: number;
          })
        : "Internal Server Error";

    const stack = exception instanceof Error && exception?.stack;

    logger.error(
      `${typeof responseData === "string" ? responseData : responseData?.message || responseData?.error} - ${request.url} - ${status}${stack ? " - " + stack : ""}`,
    );

    return response.status(status).json(responseData);
  }
}
