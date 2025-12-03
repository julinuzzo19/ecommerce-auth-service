import { Request } from 'express';
import { User } from '../users/user.entity';

declare module 'express' {
  interface Request {
    user?: { sub: string; email: string }; // Puedes especificar el tipo exacto de tu objeto usuario
  }
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DB_HOST: string;
      DB_USER: string;
      DB_PASSWORD: string;
      DB_NAME: string;
      DB_PORT: number;
      NODE_ENV: 'development' | 'production';
      CLIENT_URL: string;
      PORT: number;
      JWT_SECRET: string;

      GATEWAY_SERVICE: string;
      GATEWAY_SECRET: string;
    }
  }
}
