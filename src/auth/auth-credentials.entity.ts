import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class AuthCredentials {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column()
  password: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
