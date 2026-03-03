import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import {
  IAuthCredentialsRepository,
  AUTH_CREDENTIALS_REPO,
} from "./repositories/auth-credentials.repository.interface";
import { UsersService } from "@/services/users.service";
import { UserByEmailResponseDto } from "@/services/dtos/user-email.dto";
import * as crypto from "crypto";

// Helpers para generar un hash real de scrypt para tests de signIn
async function hashPassword(password: string): Promise<string> {
  const scrypt = require("util").promisify(crypto.scrypt);
  const salt = crypto.randomBytes(16);
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

describe("AuthService", () => {
  let service: AuthService;
  let authCredentialsRepo: jest.Mocked<IAuthCredentialsRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let usersService: jest.Mocked<UsersService>;

  const mockUser: UserByEmailResponseDto = {
    userId: "user-uuid-123",
    email: "test@example.com",
    roles: "USER",
  };

  beforeEach(async () => {
    authCredentialsRepo = {
      findPasswordByUserId: jest.fn(),
      saveCredentials: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue("signed-jwt-token"),
      verifyAsync: jest.fn(),
    } as any;

    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AUTH_CREDENTIALS_REPO, useValue: authCredentialsRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("signIn", () => {
    it("devuelve access_token cuando credenciales son válidas", async () => {
      const password = "password123";
      const hashedPassword = await hashPassword(password);

      usersService.findByEmail.mockResolvedValue(mockUser);
      authCredentialsRepo.findPasswordByUserId.mockResolvedValue(hashedPassword);

      const result = await service.signIn(mockUser.email, password);

      expect(result).toEqual({ access_token: "signed-jwt-token" });
      expect(usersService.findByEmail).toHaveBeenCalledWith(mockUser.email);
      expect(authCredentialsRepo.findPasswordByUserId).toHaveBeenCalledWith(mockUser.userId);
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.userId,
        email: mockUser.email,
        role: "USER",
      });
    });

    it("lanza NotFoundException cuando el usuario no existe", async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.signIn("noexiste@example.com", "pass")).rejects.toThrow(NotFoundException);
    });

    it("lanza UnauthorizedException cuando la contraseña es incorrecta", async () => {
      const hashedPassword = await hashPassword("correct-password");
      usersService.findByEmail.mockResolvedValue(mockUser);
      authCredentialsRepo.findPasswordByUserId.mockResolvedValue(hashedPassword);

      await expect(service.signIn(mockUser.email, "wrong-password")).rejects.toThrow(UnauthorizedException);
    });

    it("lanza UnauthorizedException cuando el hash almacenado es inválido", async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      authCredentialsRepo.findPasswordByUserId.mockResolvedValue("hash-malformado-sin-dos-puntos");

      await expect(service.signIn(mockUser.email, "cualquier-pass")).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("signUp", () => {
    const signUpDto = { email: "nuevo@example.com", password: "password123", name: "Nuevo Usuario" };

    it("crea usuario y retorna access_token cuando el email no existe", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue("new-user-uuid");
      authCredentialsRepo.saveCredentials.mockResolvedValue(undefined);

      const result = await service.signUp(signUpDto);

      expect(result).toEqual({ access_token: "signed-jwt-token" });
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: signUpDto.email, role: "USER" }),
      );
      expect(authCredentialsRepo.saveCredentials).toHaveBeenCalledWith(
        "new-user-uuid",
        expect.stringContaining(":"),
      );
    });

    it("lanza BadRequestException cuando el email ya está en uso", async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.signUp(signUpDto)).rejects.toThrow(BadRequestException);
      await expect(service.signUp(signUpDto)).rejects.toThrow("Email already in use");
    });

    it("lanza BadRequestException cuando el servicio de usuarios no puede crear el user", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(null);

      await expect(service.signUp(signUpDto)).rejects.toThrow(BadRequestException);
    });

    it("lanza BadRequestException cuando el DTO tiene datos inválidos", async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const invalidDto = { email: "no-es-email", password: "", name: "" };
      await expect(service.signUp(invalidDto as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe("validateToken", () => {
    it("retorna valid:true y payload del user cuando el token es válido", async () => {
      const payload = { sub: "user-uuid", email: "user@example.com", role: "USER" };
      jwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.validateToken("valid-token");

      expect(result).toEqual({
        valid: true,
        user: { id: payload.sub, email: payload.email, role: payload.role },
      });
    });

    it("retorna valid:false con mensaje cuando el token es inválido", async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error("jwt expired"));

      const result = await service.validateToken("expired-token");

      expect(result).toEqual({ valid: false, message: "jwt expired" });
    });

    it("retorna valid:false con mensaje por defecto cuando el error no tiene mensaje", async () => {
      jwtService.verifyAsync.mockRejectedValue({});

      const result = await service.validateToken("bad-token");

      expect(result).toEqual({ valid: false, message: "Invalid token" });
    });
  });
});
