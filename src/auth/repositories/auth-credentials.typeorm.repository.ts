import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuthCredentials } from "@/auth/auth-credentials.entity";
import { IAuthCredentialsRepository } from "./auth-credentials.repository.interface";

// Implementación de IAuthCredentialsRepository usando TypeORM.
@Injectable()
export class TypeOrmAuthCredentialsRepository implements IAuthCredentialsRepository {
  constructor(
    @InjectRepository(AuthCredentials)
    private readonly repo: Repository<AuthCredentials>,
  ) {}

  async findPasswordByUserId(userId: string): Promise<string | null> {
    const record = await this.repo.findOne({
      select: ["password"],
      where: { userId },
    });
    return record?.password ?? null;
  }

  async saveCredentials(userId: string, hashedPassword: string): Promise<void> {
    const creds = this.repo.create({ userId, password: hashedPassword });
    await this.repo.save(creds);
  }
}
