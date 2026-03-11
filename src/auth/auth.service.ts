import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { promisify } from "util";
import { JwtService } from "@nestjs/jwt";
import { SignUpDto } from "./dto/login.dto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UsersService } from "@/services/users.service";
import { CreateUserDto } from "@/services/dtos/user-create.dto";
import { Role } from "@/roles/role";
import {
  AUTH_CREDENTIALS_REPO,
  IAuthCredentialsRepository,
} from "./repositories/auth-credentials.repository.interface";
import {
  REFRESH_TOKEN_REPO,
  IRefreshTokenRepository,
} from "./repositories/refresh-token.repository.interface";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

@Injectable()
export class AuthService {
  private saltLength = 16;
  private scrypt = promisify(crypto.scrypt);

  constructor(
    @Inject(AUTH_CREDENTIALS_REPO)
    private authCredentialsRepository: IAuthCredentialsRepository,
    @Inject(REFRESH_TOKEN_REPO)
    private refreshTokenRepository: IRefreshTokenRepository,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  private async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(this.saltLength);
    const hash = (await this.scrypt(password, salt, 64)) as Buffer;
    return `${salt.toString("hex")}:${hash.toString("hex")}`;
  }

  /**
   * Genera un token de refresh opaco (UUID), lo hashea con SHA-256 y lo persiste en DB.
   *
   * @param userId   ID del usuario dueño del token.
   * @param familyId ID de familia para detección de robo por reutilización.
   *                 Si no se proporciona se genera uno nuevo (primera emisión).
   * @returns El token en crudo — se retorna una sola vez, el hash se guarda en DB.
   */
  async generateRefreshToken(userId: string, familyId?: string): Promise<string> {
    const rawToken = crypto.randomUUID();
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const resolvedFamilyId = familyId ?? crypto.randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.refreshTokenRepository.save({
      userId,
      tokenHash,
      familyId: resolvedFamilyId,
      expiresAt,
      revoked: false,
    });

    return rawToken;
  }

  /**
   * Rota un refresh token:
   *  1. Valida que exista en DB.
   *  2. Detecta reutilización (token revocado → posible robo → revoca familia entera).
   *  3. Verifica expiración.
   *  4. Revoca el token actual y emite un nuevo par (access + refresh).
   */
  async refreshTokens(rawRefreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    const stored = await this.refreshTokenRepository.findByHash(tokenHash);

    if (!stored) {
      throw new UnauthorizedException("Refresh token inválido");
    }

    // Detección de robo: el token existe pero ya fue revocado → alguien lo está reutilizando
    if (stored.revoked) {
      await this.refreshTokenRepository.revokeFamily(stored.familyId);
      throw new UnauthorizedException(
        "Refresh token ya utilizado — posible robo detectado. Por favor inicie sesión nuevamente.",
      );
    }

    if (stored.expiresAt < new Date()) {
      await this.refreshTokenRepository.revokeById(stored.id);
      throw new UnauthorizedException("Refresh token expirado");
    }

    // Revocar el token actual: one-time use
    await this.refreshTokenRepository.revokeById(stored.id);

    // Obtener datos del usuario para el nuevo JWT
    const user = await this.usersService.findById(stored.userId);
    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    const payload = {
      sub: user.userId,
      email: user.email,
      role: user.roles ?? Role.USER,
    };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload),
      // Nuevo token en la misma familia para mantener historial de detección
      this.generateRefreshToken(stored.userId, stored.familyId),
    ]);

    return { access_token, refresh_token };
  }

  /**
   * Revoca el refresh token del usuario (logout).
   * Es idempotente: si el token no existe o ya está revocado no falla.
   */
  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    const stored = await this.refreshTokenRepository.findByHash(tokenHash);
    if (stored && !stored.revoked) {
      await this.refreshTokenRepository.revokeById(stored.id);
    }
  }

  async signIn(email: string, pass: string): Promise<{ access_token: string; refresh_token: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new NotFoundException();
    }

    const storedPassword = await this.authCredentialsRepository.findPasswordByUserId(user.userId);
    let isMatch: boolean | undefined;
    try {
      const [saltHex, hashHex] = storedPassword.split(":");
      const salt = Buffer.from(saltHex, "hex");
      const hash = Buffer.from(hashHex, "hex");
      const derivedKey = (await this.scrypt(pass, salt, 64)) as Buffer;
      isMatch = crypto.timingSafeEqual(hash, derivedKey);
    } catch (error) {
      console.log({ error });
    }

    if (!isMatch) {
      throw new UnauthorizedException();
    }

    const payload = {
      sub: user.userId,
      email: user.email,
      role: user.roles ?? Role.USER,
    };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.generateRefreshToken(user.userId),
    ]);

    return { access_token, refresh_token };
  }

  async signUp(signUpDto: SignUpDto): Promise<{ access_token: string; refresh_token: string }> {
    const user = await this.usersService.findByEmail(signUpDto.email);

    if (user) {
      throw new BadRequestException("Email already in use");
    }

    const bodyUserCreate: CreateUserDto = {
      ...signUpDto,
      role: Role.USER,
    };

    const dtoUser = plainToInstance(CreateUserDto, bodyUserCreate);

    const errors = await validate(dtoUser);

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    const userCreatedId = await this.usersService.create(bodyUserCreate);

    if (!userCreatedId) {
      throw new BadRequestException("User could not be created");
    }

    await this.authCredentialsRepository.saveCredentials(
      userCreatedId,
      await this.hashPassword(signUpDto.password),
    );

    const payload = {
      sub: userCreatedId,
      email: bodyUserCreate.email,
      role: Role.USER,
    };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.generateRefreshToken(userCreatedId),
    ]);

    return { access_token, refresh_token };
  }

  async validateToken(token: string): Promise<{
    valid: boolean;
    user?: { id: string; email: string; role: string };
    message?: string;
  }> {
    try {
      const payload = await this.jwtService.verifyAsync(token);

      return {
        valid: true,
        user: {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        },
      };
    } catch (error) {
      return {
        valid: false,
        message: (error as Error).message || "Invalid token",
      };
    }
  }
}
