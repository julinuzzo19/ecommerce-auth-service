import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtModule } from "@nestjs/jwt";
import { AuthCredentials } from "@/auth/auth-credentials.entity";
import { RefreshToken } from "@/auth/refresh-token.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "@/services/users.module";
import { AUTH_CREDENTIALS_REPO } from "./repositories/auth-credentials.repository.interface";
import { TypeOrmAuthCredentialsRepository } from "./repositories/auth-credentials.typeorm.repository";
import { REFRESH_TOKEN_REPO } from "./repositories/refresh-token.repository.interface";
import { TypeOrmRefreshTokenRepository } from "./repositories/refresh-token.typeorm.repository";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    // registerAsync permite leer JWT_SECRET desde ConfigService en runtime
    // en lugar de en import-time. ConfigModule se importa acá aunque sea global
    // porque useFactory lo necesita en inject[].
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET"),
        signOptions: {
          // Access token de corta duración; el cliente renueva vía /auth/refresh
          expiresIn: config.get<string>("JWT_EXPIRES_IN") ?? "15m",
          issuer: "auth-service",
          audience: "api-gateway",
        },
        global: true,
      }),
      inject: [ConfigService],
    }),
    // Registra entities solo en el scope de este módulo
    TypeOrmModule.forFeature([AuthCredentials, RefreshToken]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Repositorio de credenciales de autenticación
    {
      provide: AUTH_CREDENTIALS_REPO,
      useClass: TypeOrmAuthCredentialsRepository,
    },
    // Repositorio de refresh tokens
    {
      provide: REFRESH_TOKEN_REPO,
      useClass: TypeOrmRefreshTokenRepository,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
