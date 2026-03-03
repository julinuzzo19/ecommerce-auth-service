import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtPayload } from "@/auth/interfaces/jwt-payload.interface";

// Decorator de parámetro que extrae el usuario autenticado del request.
// El objeto user es inyectado por AuthGuard después de verificar el JWT.
// Uso: @CurrentUser() user: JwtPayload en lugar de @Req() req + casteo manual.
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
