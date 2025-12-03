import { IsEmail, IsIn, IsNotEmpty } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  name: string;
  @IsEmail()
  email: string;
  @IsIn(['USER', 'ADMIN'])
  role: 'USER' | 'ADMIN';
  avatar?: string;
}
