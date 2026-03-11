import { RefreshToken } from "../refresh-token.entity";

export interface IRefreshTokenRepository {
  save(token: Omit<RefreshToken, "id" | "createdAt">): Promise<RefreshToken>;
  findByHash(tokenHash: string): Promise<RefreshToken | null>;
  revokeById(id: string): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
}

export const REFRESH_TOKEN_REPO = Symbol("IRefreshTokenRepository");
