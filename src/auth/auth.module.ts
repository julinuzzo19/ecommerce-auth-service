import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtModule } from "@nestjs/jwt";
import { AuthCredentials } from "@/auth/auth-credentials.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "@/services/users.module";
import { AUTH_CREDENTIALS_REPO } from "./repositories/auth-credentials.repository.interface";
import { TypeOrmAuthCredentialsRepository } from "./repositories/auth-credentials.typeorm.repository";
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
          expiresIn: "1h",
          issuer: "auth-service",
          audience: "api-gateway",
        },
        global: true,
      }),
      inject: [ConfigService],
    }),
    // Registra AuthCredentials entity solo en el scope de este módulo
    TypeOrmModule.forFeature([AuthCredentials]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Registro del repositorio usando el token de la interfaz.
    // AuthService inyecta IAuthCredentialsRepository via @Inject(AUTH_CREDENTIALS_REPO)
    {
      provide: AUTH_CREDENTIALS_REPO,
      useClass: TypeOrmAuthCredentialsRepository,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
