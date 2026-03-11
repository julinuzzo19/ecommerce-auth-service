import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  userId: string;

  @Column()
  tokenHash: string;

  @Column("uuid")
  familyId: string;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  revoked: boolean;

  @Column({ default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;
}
