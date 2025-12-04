import { Response, Request } from 'express';
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
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, SignUpDto } from './dto/login.dto';
import { cookieOptions } from '../config/cookies';
import { AuthGuard } from './auth.guard';
import './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async signIn(
    @Body() signInDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token } = await this.authService.signIn(
      signInDto.email,
      signInDto.password,
    );

    res.cookie('access_token', access_token, cookieOptions);

    return { message: 'Logged in successfully' };
  }
  @HttpCode(HttpStatus.OK)
  @Get('logout')
  logOut(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    return { message: 'Ok' };
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signUp(
    @Body() signUpDto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token } = await this.authService.signUp(signUpDto);

    res.cookie('access_token', access_token, cookieOptions);

    return { message: 'User created successfully', access_token };
  }

  // Endpoint para validar token (usado por API Gateway)
  @Get('validate')
  @HttpCode(HttpStatus.OK)
  async validateToken(
    @Headers('authorization') authorization: string,
    @Req() req: Request,
  ) {
    // Puede recibir el token desde header Authorization o cookie
    let token = req.cookies?.['access_token'];

    if (!token && authorization?.startsWith('Bearer ')) {
      token = authorization.substring(7);
    }

    if (!token) {
      return { valid: false, message: 'No token provided' };
    }

    const result = await this.authService.validateToken(token);
    return result;
  }

  // Endpoint para obtener info del usuario autenticado
  @Get('me')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getCurrentUser(@Req() req: Request) {
    // El AuthGuard ya validó el token y puso el payload en req.user
    const user = req['user'] as { sub: string; email: string; role: string };
    return {
      id: user.sub,
      email: user.email,
      role: user.role,
    };
  }
}
