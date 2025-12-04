export class UserByEmailResponseDto {
  userId: string;
  email: string;
  roles: 'ADMIN' | 'USER';
}
