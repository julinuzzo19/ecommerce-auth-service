import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { promisify } from "util";
import { JwtService } from "@nestjs/jwt";
import { SignUpDto } from "./dto/login.dto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UsersService } from "@/services/users.service";
import { CreateUserDto } from "@/services/dtos/user-create.dto";
import { Role } from "@/roles/role";
import {
  AUTH_CREDENTIALS_REPO,
  IAuthCredentialsRepository,
} from "./repositories/auth-credentials.repository.interface";

@Injectable()
export class AuthService {
  private saltLength = 16;
  private scrypt = promisify(crypto.scrypt);

  constructor(
    @Inject(AUTH_CREDENTIALS_REPO)
    private authCredentialsRepository: IAuthCredentialsRepository,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  private async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(this.saltLength);
    const hash = (await this.scrypt(password, salt, 64)) as Buffer;
    return `${salt.toString("hex")}:${hash.toString("hex")}`;
  }

  async signIn(email: string, pass: string): Promise<{ access_token: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new NotFoundException();
    }

    const storedPassword = await this.authCredentialsRepository.findPasswordByUserId(user.userId);
    let isMatch;
    try {
      const [saltHex, hashHex] = storedPassword.split(":");
      const salt = Buffer.from(saltHex, "hex");
      const hash = Buffer.from(hashHex, "hex");
      const derivedKey = (await this.scrypt(pass, salt, 64)) as Buffer;
      isMatch = crypto.timingSafeEqual(hash, derivedKey);
    } catch (error) {
      console.log({ error });
    }

    if (!isMatch) {
      throw new UnauthorizedException();
    }

    const payload = {
      sub: user.userId,
      email: user.email,
      role: "USER",
    };

    const access_token = await this.jwtService.signAsync(payload);

    return { access_token };
  }

  async signUp(signUpDto: SignUpDto): Promise<{ access_token: string }> {
    const user = await this.usersService.findByEmail(signUpDto.email);

    if (user) {
      throw new BadRequestException("Email already in use");
    }

    const bodyUserCreate: CreateUserDto = {
      ...signUpDto,
      role: Role.USER,
    };

    const dtoUser = plainToInstance(CreateUserDto, bodyUserCreate);

    const errors = await validate(dtoUser);

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    const userCreatedId = await this.usersService.create(bodyUserCreate);

    if (!userCreatedId) {
      throw new BadRequestException("User could not be created");
    }

    await this.authCredentialsRepository.saveCredentials(
      userCreatedId,
      await this.hashPassword(signUpDto.password),
    );

    const payload = {
      sub: userCreatedId,
      email: bodyUserCreate.email,
      role: "USER",
    };

    const access_token = await this.jwtService.signAsync(payload);

    return { access_token };
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
        message: error.message || "Invalid token",
      };
    }
  }
}
