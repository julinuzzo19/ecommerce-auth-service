# 🔐 Ecommerce Auth Service

Servicio de autenticación y gestión de usuarios para plataforma de ecommerce, construido con NestJS, TypeScript y MySQL.

## ✨ Características

- ✅ Autenticación con JWT
- ✅ Registro e inicio de sesión de usuarios
- ✅ Gestión de perfiles de usuario
- ✅ Upload de avatares
- ✅ Sistema de roles y permisos (Guards)
- ✅ Validación de tokens (para API Gateway)
- ✅ Health checks
- ✅ Documentación con Swagger
- ✅ Manejo global de excepciones
- ✅ Logging con Winston
- ✅ Seguridad con Helmet
- ✅ CORS configurado
- ✅ Cookie-based authentication

## 🛠 Tecnologías

- **Framework:** NestJS 10.x
- **Lenguaje:** TypeScript 5.x
- **Base de Datos:** MySQL con TypeORM
- **Autenticación:** JWT (@nestjs/jwt)
- **Validación:** class-validator, class-transformer
- **Documentación:** Swagger/OpenAPI
- **Logging:** Winston (nest-winston)
- **Testing:** Jest
- **Seguridad:** Helmet, CORS
- **Upload de archivos:** Multer

## 📦 Requisitos Previos

- Node.js >= 18.x
- npm >= 9.x
- MySQL >= 8.x
- Docker (opcional)

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone https://github.com/julinuzzo19/ecommerce-auth-service.git

# Ingresar al directorio
cd ecommerce-auth-service

# Instalar dependencias
npm install
```

## ⚙️ Configuración

Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Base de datos
DB_HOST=localhost
DB_PORT=3306
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_NAME=ecommerce_auth

# Aplicación
NODE_ENV=development
PORT=3010
CLIENT_URL=http://localhost:3000

# JWT
JWT_SECRET=tu_secreto_jwt_super_seguro
```

## 🏃 Ejecución

### Desarrollo

```bash
# Modo watch
npm run dev

# Con debug
npm run start:debug
```

### Producción

```bash
# Build
npm run build

# Iniciar
npm run start:prod
```

La aplicación estará disponible en `http://localhost:3010`

## 📚 API Endpoints

### Autenticación

| Método | Endpoint             | Descripción             | Auth |
| ------ | -------------------- | ----------------------- | ---- |
| POST   | `/api/auth/signup`   | Registrar nuevo usuario | No   |
| POST   | `/api/auth/login`    | Iniciar sesión          | No   |
| GET    | `/api/auth/logout`   | Cerrar sesión           | No   |
| GET    | `/api/auth/validate` | Validar token (Gateway) | No   |
| GET    | `/api/auth/me`       | Obtener usuario actual  | Sí   |

### Usuarios

| Método | Endpoint                    | Descripción               | Auth      |
| ------ | --------------------------- | ------------------------- | --------- |
| GET    | `/api/users`                | Listar todos los usuarios | Sí (USER) |
| GET    | `/api/users/:id`            | Obtener usuario por ID    | Sí        |
| PATCH  | `/api/users/:id`            | Actualizar usuario        | Sí        |
| DELETE | `/api/users/:id`            | Eliminar usuario          | Sí        |
| POST   | `/api/users/profile/avatar` | Subir avatar              | Sí        |

### Health

| Método | Endpoint      | Descripción         | Auth |
| ------ | ------------- | ------------------- | ---- |
| GET    | `/api/health` | Estado del servicio | No   |

### Documentación

La documentación completa de Swagger está disponible en producción en `/swagger`

## 🧪 Testing

```bash
# Tests unitarios
npm test

# Tests en modo watch
npm run test:watch

# Tests con cobertura
npm run test:cov

# Tests e2e
npm run test:e2e
```

## 📁 Estructura del Proyecto

```
src/
├── auth/              # Módulo de autenticación
│   ├── dto/          # DTOs de login/signup
│   ├── guards/       # Guards de autenticación
│   └── interfaces/   # Interfaces JWT
├── users/            # Módulo de usuarios
│   ├── dto/          # DTOs de usuario
│   └── user.entity.ts
├── roles/            # Sistema de roles y permisos
│   ├── role.decorator.ts
│   ├── roles.guard.ts
│   └── role.ts
├── health/           # Health checks
├── config/           # Configuración global
│   ├── configs.ts
│   ├── cookies.ts
│   ├── exceptions.filter.ts
│   └── logger.ts
├── utils/            # Utilidades
└── main.ts           # Bootstrap
```

## 🔒 Seguridad

- **Helmet:** Protección de headers HTTP
- **CORS:** Configurado según entorno
- **JWT:** Tokens seguros con expiración
- **Validación:** DTOs validados con class-validator
- **Cookies:** HTTPOnly y Secure en producción
- **Upload:** Validación de tipo y tamaño de archivos
- **Guards:** Protección de rutas por roles

## 📝 Scripts Disponibles

```bash
npm run build          # Compilar TypeScript
npm run dev           # Desarrollo con watch
npm run start         # Iniciar aplicación
npm run start:prod    # Producción
npm run lint          # Linter
npm run format        # Formatear código
npm run test          # Tests unitarios
npm run test:cov      # Tests con cobertura
```
