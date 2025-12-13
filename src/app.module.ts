import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GlobalExceptionFilter } from './config/exceptions.filter';
import {
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_PORT,
  DB_USER,
  NODE_ENV,
} from './config/configs';
import { HealthModule } from '@/health/health.module';
import { AuthCredentials } from '@/auth/auth-credentials.entity';
import { UsersModule } from '@/services/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: DB_HOST,
      port: DB_PORT,
      username: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      entities: [AuthCredentials],
      synchronize: NODE_ENV === 'development' ? true : false,
      autoLoadEntities: true,

      connectTimeout: 10000, // 10 seconds
      extra: {
        connectionLimit: 10,
        queueLimit: 0,
        waitForConnections: true,
        connectTimeout: 10000, // También aquí para el driver mysql2
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    UsersModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
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
