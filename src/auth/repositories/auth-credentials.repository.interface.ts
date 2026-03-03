// Interfaz de dominio para el repositorio de credenciales.
// Esto permite swapear la implementación (TypeORM, in-memory, etc.) sin tocar la lógica de negocio,
// y facilita mockear el repositorio en unit tests sin necesidad de levantar una base de datos.
export interface IAuthCredentialsRepository {
  findPasswordByUserId(userId: string): Promise<string | null>;
  saveCredentials(userId: string, hashedPassword: string): Promise<void>;
}

// Token de inyección. Se usa un Symbol en lugar de la clase concreta para que
// NestJS resuelva la interfaz abstracta en el DI container.
// Uso: @Inject(AUTH_CREDENTIALS_REPO) en el constructor del service.
export const AUTH_CREDENTIALS_REPO = Symbol("IAuthCredentialsRepository");
