import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { JwtService } from '@nestjs/jwt';
import { SignUpDto } from './dto/login.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UsersService } from '@/services/users.service';
import { CreateUserDto } from '@/services/dtos/user-create.dto';
import { Role } from '@/roles/role';
import { AuthCredentials } from '@/auth/auth-credentials.entity';
import { CreateCredentialsDto } from '@/auth/dto/create-credentials.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {
  private saltLength = 16;
  private scrypt = promisify(crypto.scrypt);

  constructor(
    @InjectRepository(AuthCredentials)
    private authCredentialsRepository: Repository<AuthCredentials>,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  private async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(this.saltLength);
    const hash = (await this.scrypt(password, salt, 64)) as Buffer;
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
  }

  async signIn(email: string, pass: string): Promise<{ access_token: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new NotFoundException();
    }

    const [saltHex, hashHex] = user.password.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const hash = Buffer.from(hashHex, 'hex');
    const derivedKey = (await this.scrypt(pass, salt, 64)) as Buffer;
    const isMatch = crypto.timingSafeEqual(hash, derivedKey);

    if (!isMatch) {
      throw new UnauthorizedException();
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    const access_token = await this.jwtService.signAsync(payload);

    return { access_token };
  }

  async signUp(signUpDto: SignUpDto): Promise<string> {
    const user = await this.usersService.findByEmail(signUpDto.email);

    if (user) {
      throw new BadRequestException('Email already in use');
    }

    const bodyUserCreate: CreateUserDto = {
      ...signUpDto,
      role: Role.USER,
    };
    // password: await this.hashPassword(signUpDto.password),

    const authCredentialsCreate: AuthCredentials = {
      id: '',
      userId: '',
      password: '',
      createdAt: new Date(),
    };

    const dtoAuthCredentials = plainToInstance(
      CreateCredentialsDto,
      authCredentialsCreate,
    );

    const errorsCredentials = await validate(dtoAuthCredentials);

    if (errorsCredentials.length > 0) {
      throw new BadRequestException(errorsCredentials);
    }

    const dtoUser = plainToInstance(CreateUserDto, bodyUserCreate);

    const errors = await validate(dtoUser);

    if (errors.length > 0) {
      // console.log({
      //   err: errors
      //     .map((item) => {
      //       return Object.values(item.constraints)?.join(', ');
      //     })
      //     .join(', '),
      // });
      throw new BadRequestException(errors);
    }

    const resultUserCreate = await this.usersService.create(bodyUserCreate);

    const authCredentialsToSave = this.authCredentialsRepository.create({
      ...authCredentialsCreate,
      userId: resultUserCreate.id,
      password: await this.hashPassword(signUpDto.password),
    });

    await this.authCredentialsRepository.save(authCredentialsToSave);

    // retornar token jwt con id usuario y roles

    return resultUserCreate.id;
  }

  async validateToken(token: string): Promise<{
    valid: boolean;
    user?: { id: string; email: string; role: string };
    message?: string;
  }> {
    try {
      const payload = await this.jwtService.verifyAsync(token);

      return {
        valid: true,
        user: {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        },
      };
    } catch (error) {
      return {
        valid: false,
        message: error.message || 'Invalid token',
      };
    }
  }
}
