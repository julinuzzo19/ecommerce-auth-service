import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { JWT_SECRET } from '../config/configs';
import { AuthCredentials } from '@/auth/auth-credentials.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '@/services/users.module';

@Module({
  imports: [
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: {
        expiresIn: '1h',
        issuer: 'auth-service',
        audience: 'api-gateway',
      },
      global: true,
    }),
    TypeOrmModule.forFeature([AuthCredentials]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
