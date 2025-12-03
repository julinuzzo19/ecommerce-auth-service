import { IsEmail, IsIn } from "class-validator";

export class UpdateUserDto {
  name?: string;
  @IsEmail()
  email?: string;
  @IsIn(['USER', 'ADMIN'])
  role?: 'USER' | 'ADMIN';
  avatar?: string;
}
