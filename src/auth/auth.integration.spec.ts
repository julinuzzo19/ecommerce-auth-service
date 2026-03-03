/**
 * Integration test para AuthModule.
 *
 * - TypeORM con SQLite in-memory: testea queries reales contra la DB sin necesidad de MySQL
 * - Solo importa AuthModule + dependencias mínimas (sin AppModule completo)
 * - UsersService mockeado via overrideProvider (depende de HTTP externo al gateway)
 * - JwtModule con secret fijo para tests
 */
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthModule } from "./auth.module";
import { AuthCredentials } from "./auth-credentials.entity";
import { UsersService } from "@/services/users.service";
import { UserByEmailResponseDto } from "@/services/dtos/user-email.dto";

const existingUser: UserByEmailResponseDto = {
  userId: "integration-user-uuid",
  email: "existing@example.com",
  roles: "USER",
};

const newUser: UserByEmailResponseDto = {
  userId: "new-user-uuid",
  email: "nuevo@example.com",
  roles: "USER",
};

describe("AuthModule (integration)", () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let mockUsersService: jest.Mocked<Pick<UsersService, "findByEmail" | "create">>;

  beforeAll(async () => {
    mockUsersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: "integration-test-secret" })],
        }),
        // SQLite in-memory: testea queries reales de TypeORM sin MySQL
        TypeOrmModule.forRoot({
          type: "sqlite",
          database: ":memory:",
          entities: [AuthCredentials],
          synchronize: true,
          dropSchema: true,
          logging: false,
        }),
        AuthModule,
      ],
    })
      // UsersService depende de HTTP externo — lo mockeamos
      .overrideProvider(UsersService)
      .useValue(mockUsersService)
      .compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    jwtService = module.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /auth/signup → POST /auth/login (flujo completo con DB real)", () => {
    it("registra un usuario y luego puede hacer login con las credenciales guardadas en SQLite", async () => {
      // signup — inserta credenciales en SQLite
      mockUsersService.findByEmail.mockResolvedValueOnce(null);
      mockUsersService.create.mockResolvedValue(newUser.userId);

      const signupRes = await request(app.getHttpServer())
        .post("/auth/signup")
        .send({ email: newUser.email, password: "password123", name: "Nuevo Usuario" })
        .expect(201);

      expect(signupRes.body.access_token).toBeDefined();

      // login — lee el hash guardado en SQLite por el signup
      mockUsersService.findByEmail.mockResolvedValueOnce(newUser);

      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: newUser.email, password: "password123" })
        .expect(200);

      expect(loginRes.body).toEqual({ message: "Logged in successfully" });
      const cookie = loginRes.headers["set-cookie"] as unknown as string[];
      expect(cookie[0]).toContain("access_token");
      expect(cookie[0]).toContain("HttpOnly");
    });

    it("401 - login con contraseña incorrecta después de signup real", async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce(null);
      mockUsersService.create.mockResolvedValue("another-uuid");

      await request(app.getHttpServer())
        .post("/auth/signup")
        .send({ email: "otro@example.com", password: "correct-pass", name: "Otro" })
        .expect(201);

      mockUsersService.findByEmail.mockResolvedValueOnce({
        userId: "another-uuid",
        email: "otro@example.com",
        roles: "USER",
      });

      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "otro@example.com", password: "wrong-pass" })
        .expect(401);
    });
  });

  describe("POST /auth/login", () => {
    it("404 - usuario no encontrado", async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "ghost@example.com", password: "pass" })
        .expect(404);
    });

    it("400 - email con formato inválido", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "not-an-email", password: "pass" })
        .expect(400);
    });

    it("400 - body vacío", async () => {
      await request(app.getHttpServer()).post("/auth/login").send({}).expect(400);
    });
  });

  describe("POST /auth/signup", () => {
    it("400 - email ya registrado", async () => {
      mockUsersService.findByEmail.mockResolvedValue(existingUser);

      const res = await request(app.getHttpServer())
        .post("/auth/signup")
        .send({ email: existingUser.email, password: "pass123", name: "Test" })
        .expect(400);

      expect(res.body.message).toBe("Email already in use");
    });

    it("400 - falta campo name", async () => {
      await request(app.getHttpServer())
        .post("/auth/signup")
        .send({ email: "nuevo2@example.com", password: "pass123" })
        .expect(400);
    });
  });

  describe("GET /auth/validate", () => {
    it("valid:true con token válido via Bearer header", async () => {
      const token = await jwtService.signAsync({
        sub: existingUser.userId,
        email: existingUser.email,
        role: "USER",
      });

      const res = await request(app.getHttpServer())
        .get("/auth/validate")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.valid).toBe(true);
      expect(res.body.user).toMatchObject({ email: existingUser.email });
    });

    it("valid:false cuando no hay token", async () => {
      const res = await request(app.getHttpServer()).get("/auth/validate").expect(200);

      expect(res.body).toEqual({ valid: false, message: "No token provided" });
    });

    it("valid:false con token inválido", async () => {
      const res = await request(app.getHttpServer())
        .get("/auth/validate")
        .set("Authorization", "Bearer invalid.jwt.token")
        .expect(200);

      expect(res.body.valid).toBe(false);
    });
  });

  describe("GET /auth/logout", () => {
    it("200 - limpia cookie", async () => {
      const res = await request(app.getHttpServer()).get("/auth/logout").expect(200);

      expect(res.body).toEqual({ message: "Ok" });
    });
  });

  describe("GET /auth/me", () => {
    it("200 - retorna usuario autenticado con cookie válida (flujo signup → me)", async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce(null);
      mockUsersService.create.mockResolvedValue("me-user-uuid");

      const signupRes = await request(app.getHttpServer())
        .post("/auth/signup")
        .send({ email: "me@example.com", password: "pass123", name: "Me User" })
        .expect(201);

      const cookie = signupRes.headers["set-cookie"];

      const meRes = await request(app.getHttpServer()).get("/auth/me").set("Cookie", cookie).expect(200);

      expect(meRes.body).toMatchObject({
        email: "me@example.com",
        role: "USER",
      });
    });

    it("401 - sin cookie de autenticación", async () => {
      await request(app.getHttpServer()).get("/auth/me").expect(401);
    });
  });
});
