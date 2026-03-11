import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RefreshToken } from "../refresh-token.entity";
import { IRefreshTokenRepository } from "./refresh-token.repository.interface";

@Injectable()
export class TypeOrmRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

  async save(token: Omit<RefreshToken, "id" | "createdAt">): Promise<RefreshToken> {
    const entity = this.repo.create(token);
    return this.repo.save(entity);
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.repo.findOne({ where: { tokenHash } });
  }

  async revokeById(id: string): Promise<void> {
    await this.repo.update(id, { revoked: true });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.repo.update({ familyId }, { revoked: true });
  }
}
