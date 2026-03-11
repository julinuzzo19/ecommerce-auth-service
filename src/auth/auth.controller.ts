import { Response, Request } from "express";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  Req,
  UseGuards,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto, SignUpDto } from "./dto/login.dto";
import { cookieOptions, refreshTokenCookieOptions } from "../config/cookies";
import { AuthGuard } from "./auth.guard";
import { CurrentUser } from "./decorators/current-user.decorator";
import { JwtPayload } from "./interfaces/jwt-payload.interface";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post("login")
  async signIn(@Body() signInDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { access_token, refresh_token } = await this.authService.signIn(
      signInDto.email,
      signInDto.password,
    );

    res.cookie("access_token", access_token, cookieOptions);
    res.cookie("refresh_token", refresh_token, refreshTokenCookieOptions);

    return { message: "Logged in successfully" };
  }

  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.["refresh_token"] as string | undefined;

    if (!rawRefreshToken) {
      throw new UnauthorizedException("Refresh token no proporcionado");
    }

    const { access_token, refresh_token } = await this.authService.refreshTokens(rawRefreshToken);

    res.cookie("access_token", access_token, cookieOptions);
    res.cookie("refresh_token", refresh_token, refreshTokenCookieOptions);
    return { message: "Tokens renovados exitosamente" };
  }

  @HttpCode(HttpStatus.OK)
  @Get("logout")
  async logOut(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.["refresh_token"] as string | undefined;

    // Revocar el refresh token en DB si existe (idempotente)
    if (rawRefreshToken) {
      await this.authService.revokeRefreshToken(rawRefreshToken);
    }

    res.clearCookie("access_token");
    // Al limpiar la cookie del refresh token hay que especificar el mismo path
    res.clearCookie("refresh_token", { path: refreshTokenCookieOptions.path });
    return { message: "Ok" };
  }

  @Post("signup")
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body() signUpDto: SignUpDto, @Res({ passthrough: true }) res: Response) {
    const { access_token, refresh_token } = await this.authService.signUp(signUpDto);

    res.cookie("access_token", access_token, cookieOptions);
    res.cookie("refresh_token", refresh_token, refreshTokenCookieOptions);

    return { message: "User created successfully", access_token };
  }

  // Endpoint para validar token (usado por API Gateway)
  @Get("validate")
  @HttpCode(HttpStatus.OK)
  async validateToken(@Headers("authorization") authorization: string, @Req() req: Request) {
    // Puede recibir el token desde header Authorization o cookie
    let token = req.cookies?.["access_token"] as string | undefined;

    if (!token && authorization?.startsWith("Bearer ")) {
      token = authorization.substring(7);
    }

    if (!token) {
      return { valid: false, message: "No token provided" };
    }

    const result = await this.authService.validateToken(token);
    return result;
  }

  // Endpoint para obtener info del usuario autenticado
  @Get("me")
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  getCurrentUser(@CurrentUser() user: JwtPayload) {
    return {
      id: user.sub,
      email: user.email,
      role: user.role,
    };
  }
}
