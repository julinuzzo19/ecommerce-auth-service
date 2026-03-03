import { Logger, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { APP_FILTER } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { GlobalExceptionFilter } from "./config/exceptions.filter";
import { HealthModule } from "@/health/health.module";
import { AuthCredentials } from "@/auth/auth-credentials.entity";
import { UsersModule } from "@/services/users.module";
import { envSchema } from "./config/configs";

@Module({
  imports: [
    // isGlobal: true → ConfigService se puede inyectar en cualquier módulo sin importar ConfigModule localmente.
    // validate: corre el schema Zod al arrancar. Si falta una variable o tiene tipo incorrecto, la app no levanta.
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),

    // forRootAsync permite inyectar ConfigService para leer las vars en runtime,
    // en lugar de resolverlas en import-time con process.env directo.
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "mysql",
        host: config.get<string>("DB_HOST"),
        port: config.get<number>("DB_PORT"),
        username: config.get<string>("DB_USER"),
        password: config.get<string>("DB_PASSWORD"),
        database: config.get<string>("DB_NAME"),
        entities: [AuthCredentials],
        // synchronize solo en desarrollo. En producción usar migraciones.
        synchronize: config.get<string>("NODE_ENV") === "development",
        autoLoadEntities: true,
        connectTimeout: 10000,
        extra: {
          connectionLimit: 10,
          queueLimit: 0,
          waitForConnections: true,
          connectTimeout: 10000,
        },
      }),
    }),
    AuthModule,
    UsersModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    // APP_FILTER registra el filtro globalmente a través del DI container de NestJS.
    // A diferencia de useGlobalFilters() en main.ts, este tiene acceso a la DI (puede inyectar servicios).
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    Logger,
  ],
})
export class AppModule {
  constructor(private dataSource: DataSource) {}
}
