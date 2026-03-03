import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dtos/user-create.dto";

describe("UsersService", () => {
  let service: UsersService;
  let httpService: { axiosRef: { get: jest.Mock; post: jest.Mock } };
  let configService: jest.Mocked<ConfigService>;

  const createDto: CreateUserDto = {
    email: "test@example.com",
    name: "Test User",
    role: "USER",
  };

  beforeEach(async () => {
    httpService = {
      axiosRef: {
        get: jest.fn(),
        post: jest.fn(),
      },
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          GATEWAY_SERVICE: "http://gateway.test",
          GATEWAY_SECRET: "secret",
        };
        return config[key];
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("create", () => {
    it("retorna userId cuando la creación es exitosa", async () => {
      httpService.axiosRef.post.mockResolvedValue({ data: { userId: "new-uuid" } });

      const result = await service.create(createDto);

      expect(result).toBe("new-uuid");
      expect(httpService.axiosRef.post).toHaveBeenCalledWith(
        "/users",
        createDto,
        expect.objectContaining({
          baseURL: "http://gateway.test",
          headers: expect.objectContaining({ "x-gateway-secret": "secret" }),
        }),
      );
    });

    it("lanza BadRequestException cuando el gateway responde con error", async () => {
      httpService.axiosRef.post.mockRejectedValue({
        response: { data: { message: "Validation error" } },
      });

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it("lanza BadRequestException con mensaje por defecto cuando no hay response data", async () => {
      httpService.axiosRef.post.mockRejectedValue(new Error("Network error"));

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it("retorna undefined cuando la respuesta no tiene userId", async () => {
      httpService.axiosRef.post.mockResolvedValue({ data: {} });

      const result = await service.create(createDto);

      expect(result).toBeUndefined();
    });
  });

  describe("findByEmail", () => {
    const userResponse = { userId: "user-uuid", email: "test@example.com", roles: "USER" };

    it("retorna datos del usuario cuando es encontrado", async () => {
      httpService.axiosRef.get.mockResolvedValue({ data: userResponse });

      const result = await service.findByEmail("test@example.com");

      expect(result).toEqual(userResponse);
      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        "/users/by-email?email=test@example.com",
        expect.objectContaining({ baseURL: "http://gateway.test" }),
      );
    });

    it("retorna null cuando el usuario no existe (404)", async () => {
      httpService.axiosRef.get.mockRejectedValue({ response: { status: 404 } });

      const result = await service.findByEmail("noexiste@example.com");

      expect(result).toBeNull();
    });

    it("retorna undefined para otros errores del gateway", async () => {
      httpService.axiosRef.get.mockRejectedValue({ response: { status: 500 } });

      const result = await service.findByEmail("test@example.com");

      expect(result).toBeUndefined();
    });
  });
});
