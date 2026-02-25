import { z } from 'zod';

// Schema de validación de variables de entorno.
// Se ejecuta una vez al arrancar la app via ConfigModule.forRoot({ validate }).
// Si falta una variable o tiene tipo incorrecto, Zod lanza un error descriptivo
// antes de que NestJS termine de inicializar, evitando errores silenciosos en runtime.
export const envSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  // z.coerce.number() convierte el string del .env a número automáticamente
  DB_PORT: z.coerce.number().int().positive(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  CLIENT_URL: z.url(),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(1),
  GATEWAY_SERVICE: z.url(),
  GATEWAY_SECRET: z.string().min(1),
});

// Tipo inferido del schema. Usado para tipar ConfigService<EnvConfig>
// y obtener autocompletado al hacer config.get('DB_HOST')
export type EnvConfig = z.infer<typeof envSchema>;
