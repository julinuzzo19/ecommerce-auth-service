import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import * as express from "express";
import { WinstonModule } from "nest-winston";
import { logger } from "./config/logger";
import helmet from "helmet";
import * as cookieParser from "cookie-parser";
import * as morgan from "morgan";
import { ValidationPipe } from "@nestjs/common";
import { GlobalExceptionFilter } from "./config/exceptions.filter";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import type { Server } from "http";
import { join } from "path";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Leídos acá porque main.ts corre antes de que NestJS inicialice el DI container.
  // ConfigService no está disponible fuera del contexto de módulos.
  const nodeEnv = process.env.NODE_ENV ?? "production";
  const clientUrl = process.env.CLIENT_URL ?? "";

  // Agrega headers de seguridad HTTP (X-Frame-Options, CSP, etc.)
  app.use(helmet());

  // En producción solo permite el origen configurado. En desarrollo acepta cualquiera.
  app.enableCors({
    methods: ["POST", "GET", "PUT", "PATCH", "DELETE"],
    origin: nodeEnv === "production" ? clientUrl : "*",
    credentials: true,
  });

  // Necesario para leer req.cookies en guards y controllers
  app.use(cookieParser());

  // Prefijo global. Health y metrics quedan sin prefijo para los healthchecks del orquestador.
  app.setGlobalPrefix("api/v1", { exclude: ["health", "metrics"] });

  // Reemplaza el logger por defecto de NestJS con la instancia Winston configurada en logger.ts
  app.useLogger(WinstonModule.createLogger({ instance: logger }));

  // Log de cada request HTTP en stdout (formato 'dev': método, ruta, status, tiempo)
  app.use(morgan("dev"));

  // Valida automáticamente los DTOs en todos los endpoints. Rechaza payloads inválidos con 400.
  app.useGlobalPipes(new ValidationPipe());

  // Captura todas las excepciones no manejadas y devuelve una respuesta JSON consistente
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Loguea método, ruta y tiempo de respuesta de cada request vía Winston
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Sirve imágenes de avatars como archivos estáticos
  app.use("/avatars", express.static(join(process.cwd(), "public", "avatars")));

  // Swagger solo en producción para no exponer la documentación en desarrollo
  if (nodeEnv === "production") {
    const config = new DocumentBuilder()
      .setTitle("Users API")
      .setDescription("The users API with NestJS")
      .setVersion("1.0")
      .addTag("users")
      .addBearerAuth()
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("swagger", app, documentFactory);
  }

  // En producción escucha en 0.0.0.0 para ser accesible desde el host del contenedor
  const host = nodeEnv === "production" ? process.env.HOST || "0.0.0.0" : "0.0.0.0";

  const port = process.env.PORT;

  const server: Server = await app.listen(port, host);
  // Timeout de 30s para requests lentas (ej: queries pesadas al gateway)
  server.setTimeout(30000);
}
bootstrap();
