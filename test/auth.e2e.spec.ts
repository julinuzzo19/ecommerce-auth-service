/**
 * E2E tests para el flujo de autenticación.
 *
 * - Importa solo los módulos necesarios (AuthModule, HealthModule) — sin AppModule completo
 * - TypeORM con SQLite in-memory: testea queries reales sin MySQL
 * - UsersService mockeado via overrideProvider (evita llamadas HTTP al gateway externo)
 * - Registra middleware/pipes/filters como lo haría la app real
 */
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AuthModule } from "@/auth/auth.module";
import { HealthModule } from "@/health/health.module";
import { AuthCredentials } from "@/auth/auth-credentials.entity";
import { UsersService } from "@/services/users.service";
import { GlobalExceptionFilter } from "@/config/exceptions.filter";
import { UserByEmailResponseDto } from "@/services/dtos/user-email.dto";

// Suprimir logs de Winston durante tests
jest.mock("@/config/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const existingUser: UserByEmailResponseDto = {
  userId: "e2e-existing-uuid",
  email: "e2e@example.com",
  roles: "USER",
};

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let mockUsersService: jest.Mocked<Pick<UsersService, "findByEmail" | "create">>;

  beforeAll(async () => {
    mockUsersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: "e2e-test-secret" })],
        }),
        // SQLite in-memory: queries reales de TypeORM sin depender de MySQL
        TypeOrmModule.forRoot({
          type: "sqlite",
          database: ":memory:",
          entities: [AuthCredentials],
          synchronize: true,
          dropSchema: true,
          logging: false,
        }),
        AuthModule,
        HealthModule,
      ],
      providers: [
        {
          provide: APP_FILTER,
          useClass: GlobalExceptionFilter,
        },
      ],
    })
      // UsersService depende de HTTP al gateway — lo mockeamos
      .overrideProvider(UsersService)
      .useValue(mockUsersService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe());
    app.setGlobalPrefix("api/v1", { exclude: ["health"] });

    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/auth/signup", () => {
    it("201 - registra usuario nuevo, setea cookie HttpOnly y retorna access_token", async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue("new-uuid-123");

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/signup")
        .send({ email: "nuevo@example.com", password: "password123", name: "Nuevo" })
        .expect(201);

      expect(res.body).toMatchObject({
        message: "User created successfully",
        access_token: expect.any(String),
      });
      const setCookie = res.headers["set-cookie"] as unknown as string[];
      expect(setCookie[0]).toContain("access_token");
      expect(setCookie[0]).toContain("HttpOnly");
    });

    it("400 - email ya en uso", async () => {
      mockUsersService.findByEmail.mockResolvedValue(existingUser);

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/signup")
        .send({ email: existingUser.email, password: "pass123", name: "Test" })
        .expect(400);

      expect(res.body.message).toBe("Email already in use");
    });

    it("400 - falta campo name", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/signup")
        .send({ email: "test@example.com", password: "pass123" })
        .expect(400);
    });

    it("400 - email con formato inválido", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/signup")
        .send({ email: "bad-email", password: "pass123", name: "Test" })
        .expect(400);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    // Primero hace signup real para que el hash exista en SQLite
    const loginEmail = "login@example.com";
    const loginPassword = "securepass123";
    let loginUserId: string;

    beforeAll(async () => {
      loginUserId = "login-user-uuid";
      mockUsersService.findByEmail.mockResolvedValueOnce(null);
      mockUsersService.create.mockResolvedValueOnce(loginUserId);

      await request(app.getHttpServer())
        .post("/api/v1/auth/signup")
        .send({ email: loginEmail, password: loginPassword, name: "Login User" });
    });

    it("200 - login exitoso con credenciales del signup real — setea cookie HttpOnly", async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        userId: loginUserId,
        email: loginEmail,
        roles: "USER",
      });

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: loginEmail, password: loginPassword })
        .expect(200);

      expect(res.body).toEqual({ message: "Logged in successfully" });
      const setCookie = res.headers["set-cookie"] as unknown as string[];
      expect(setCookie[0]).toContain("access_token");
      expect(setCookie[0]).toContain("HttpOnly");
    });

    it("401 - contraseña incorrecta (hash real en SQLite)", async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        userId: loginUserId,
        email: loginEmail,
        roles: "USER",
      });

      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: loginEmail, password: "wrong-password" })
        .expect(401);
    });

    it("404 - usuario no registrado", async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "ghost@example.com", password: "pass" })
        .expect(404);
    });

    it("400 - email con formato inválido", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "not-an-email", password: "pass" })
        .expect(400);
    });

    it("400 - body vacío", async () => {
      await request(app.getHttpServer()).post("/api/v1/auth/login").send({}).expect(400);
    });
  });

  describe("GET /api/v1/auth/validate", () => {
    it("200 valid:true - token válido via cookie (flujo signup → validate)", async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce(null);
      mockUsersService.create.mockResolvedValueOnce("validate-uuid");

      const signupRes = await request(app.getHttpServer())
        .post("/api/v1/auth/signup")
        .send({ email: "validate@example.com", password: "pass123", name: "Val" });

      const cookie = signupRes.headers["set-cookie"];

      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/validate")
        .set("Cookie", cookie)
        .expect(200);

      expect(res.body.valid).toBe(true);
      expect(res.body.user).toMatchObject({ email: "validate@example.com", role: "USER" });
    });

    it("200 valid:true - token válido via Bearer header", async () => {
      const token = await jwtService.signAsync({
        sub: existingUser.userId,
        email: existingUser.email,
        role: "USER",
      });

      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/validate")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.valid).toBe(true);
    });

    it("200 valid:false - sin token", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/auth/validate").expect(200);

      expect(res.body).toEqual({ valid: false, message: "No token provided" });
    });

    it("200 valid:false - token inválido", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/validate")
        .set("Authorization", "Bearer invalid.jwt.token")
        .expect(200);

      expect(res.body.valid).toBe(false);
    });
  });

  describe("GET /api/v1/auth/logout", () => {
    it("200 - limpia cookie y retorna Ok", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/auth/logout").expect(200);

      expect(res.body).toEqual({ message: "Ok" });
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("200 - retorna info del usuario (flujo signup → me)", async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce(null);
      mockUsersService.create.mockResolvedValueOnce("me-uuid");

      const signupRes = await request(app.getHttpServer())
        .post("/api/v1/auth/signup")
        .send({ email: "me@example.com", password: "pass123", name: "Me" });

      const cookie = signupRes.headers["set-cookie"];

      const res = await request(app.getHttpServer()).get("/api/v1/auth/me").set("Cookie", cookie).expect(200);

      expect(res.body).toMatchObject({
        email: "me@example.com",
        role: "USER",
        id: "me-uuid",
      });
    });

    it("401 - sin cookie", async () => {
      await request(app.getHttpServer()).get("/api/v1/auth/me").expect(401);
    });
  });

  describe("GET /health", () => {
    it("200 - health check responde correctamente", async () => {
      const res = await request(app.getHttpServer()).get("/health").expect(200);

      expect(res.body.status).toBe("ok");
    });
  });
});
