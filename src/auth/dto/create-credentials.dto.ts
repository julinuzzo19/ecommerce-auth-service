import { IsUUID } from 'class-validator';

export class CreateCredentialsDto {
  @IsUUID()
  id: string;
  @IsUUID()
  userId: string;
  password: string;
}
