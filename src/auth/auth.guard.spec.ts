import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

const createMockContext = (cookies: Record<string, string> = {}): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ cookies }),
    }),
  }) as ExecutionContext;

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    jwtService = {
      verifyAsync: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  afterEach(() => jest.clearAllMocks());

  it('retorna true y adjunta payload al request cuando el token es válido', async () => {
    const payload = { sub: 'user-uuid', email: 'user@example.com', role: 'USER' };
    jwtService.verifyAsync.mockResolvedValue(payload);

    const mockRequest: any = { cookies: { access_token: 'valid-token' } };
    const context: ExecutionContext = ({
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    }) as ExecutionContext;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token');
    expect(mockRequest.user).toEqual(payload);
  });

  it('lanza UnauthorizedException cuando no hay cookie access_token', async () => {
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('lanza UnauthorizedException cuando el token JWT es inválido', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
    const context = createMockContext({ access_token: 'invalid-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('lanza UnauthorizedException cuando el token JWT ha expirado', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const context = createMockContext({ access_token: 'expired-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
