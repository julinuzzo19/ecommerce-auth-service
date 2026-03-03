import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { Response, Request } from "express";

// Mock de AuthGuard para unit tests del controller — evita depender de JwtService
const mockAuthGuard = {
  canActivate: jest.fn((ctx: ExecutionContext) => true),
};

describe("AuthController", () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockResponse = (): Partial<Response> => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

  beforeEach(async () => {
    authService = {
      signIn: jest.fn(),
      signUp: jest.fn(),
      validateToken: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  describe("signIn (POST /auth/login)", () => {
    const loginDto = { email: "user@example.com", password: "password123" };

    it("setea cookie y retorna mensaje de éxito", async () => {
      authService.signIn.mockResolvedValue({ access_token: "jwt-token" });
      const res = mockResponse() as Response;

      const result = await controller.signIn(loginDto, res);

      expect(authService.signIn).toHaveBeenCalledWith(loginDto.email, loginDto.password);
      expect(res.cookie).toHaveBeenCalledWith("access_token", "jwt-token", expect.any(Object));
      expect(result).toEqual({ message: "Logged in successfully" });
    });

    it("propaga la excepción si authService.signIn falla", async () => {
      authService.signIn.mockRejectedValue(new Error("Unauthorized"));
      const res = mockResponse() as Response;

      await expect(controller.signIn(loginDto, res)).rejects.toThrow("Unauthorized");
    });
  });

  describe("logOut (GET /auth/logout)", () => {
    it("limpia la cookie y retorna Ok", () => {
      const res = mockResponse() as Response;

      const result = controller.logOut(res);

      expect(res.clearCookie).toHaveBeenCalledWith("access_token");
      expect(result).toEqual({ message: "Ok" });
    });
  });

  describe("signUp (POST /auth/signup)", () => {
    const signUpDto = { email: "nuevo@example.com", password: "pass123", name: "Nuevo" };

    it("setea cookie y retorna mensaje con access_token", async () => {
      authService.signUp.mockResolvedValue({ access_token: "jwt-token" });
      const res = mockResponse() as Response;

      const result = await controller.signUp(signUpDto, res);

      expect(authService.signUp).toHaveBeenCalledWith(signUpDto);
      expect(res.cookie).toHaveBeenCalledWith("access_token", "jwt-token", expect.any(Object));
      expect(result).toEqual({ message: "User created successfully", access_token: "jwt-token" });
    });

    it("propaga la excepción si authService.signUp falla", async () => {
      authService.signUp.mockRejectedValue(new Error("Email already in use"));
      const res = mockResponse() as Response;

      await expect(controller.signUp(signUpDto, res)).rejects.toThrow("Email already in use");
    });
  });

  describe("validateToken (GET /auth/validate)", () => {
    const mockRequest = (cookies: Record<string, string> = {}): Partial<Request> => ({
      cookies,
    });

    it("valida token desde cookie", async () => {
      authService.validateToken.mockResolvedValue({
        valid: true,
        user: { id: "u1", email: "a@b.com", role: "USER" },
      });
      const req = mockRequest({ access_token: "cookie-token" }) as Request;

      const result = await controller.validateToken(undefined, req);

      expect(authService.validateToken).toHaveBeenCalledWith("cookie-token");
      expect(result).toEqual({ valid: true, user: expect.any(Object) });
    });

    it("valida token desde header Authorization Bearer", async () => {
      authService.validateToken.mockResolvedValue({
        valid: true,
        user: { id: "u1", email: "a@b.com", role: "USER" },
      });
      const req = mockRequest() as Request;

      await controller.validateToken("Bearer header-token", req);

      expect(authService.validateToken).toHaveBeenCalledWith("header-token");
    });

    it("retorna valid:false cuando no hay token", async () => {
      const req = mockRequest() as Request;

      const result = await controller.validateToken(undefined, req);

      expect(authService.validateToken).not.toHaveBeenCalled();
      expect(result).toEqual({ valid: false, message: "No token provided" });
    });

    it("prefiere cookie sobre header Authorization", async () => {
      authService.validateToken.mockResolvedValue({
        valid: true,
        user: { id: "u1", email: "a@b.com", role: "USER" },
      });
      const req = mockRequest({ access_token: "cookie-token" }) as Request;

      await controller.validateToken("Bearer header-token", req);

      expect(authService.validateToken).toHaveBeenCalledWith("cookie-token");
    });
  });

  describe("getCurrentUser (GET /auth/me)", () => {
    it("retorna los datos del usuario autenticado desde el payload JWT", () => {
      const jwtPayload = { sub: "user-uuid", email: "user@example.com", role: "USER" };

      const result = controller.getCurrentUser(jwtPayload);

      expect(result).toEqual({
        id: jwtPayload.sub,
        email: jwtPayload.email,
        role: jwtPayload.role,
      });
    });
  });
});
