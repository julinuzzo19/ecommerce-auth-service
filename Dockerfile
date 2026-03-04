FROM node:22-alpine AS builder

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar todas las dependencias (incluyendo devDependencies para poder compilar TS)
RUN npm ci
RUN npm cache clean --force

# Copiar código fuente
COPY . .

# Compilar TypeScript — genera /app/dist
RUN rm -rf dist && npm run build

# Eliminar devDependencies después del build para no copiarlas a producción
RUN npm prune --production

# ====================================
# Etapa de producción
# ====================================
FROM node:22-alpine AS production

WORKDIR /app

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copiar dependencias desde builder
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

# Crear directorio para avatars
RUN mkdir -p /app/public/avatars && \
    chown -R nestjs:nodejs /app/public

# Cambiar a usuario no-root
USER nestjs

# Definir ARG con valor por defecto
ARG PORT=3010

# Exponer puerto dinámico
EXPOSE ${PORT}
 
# Comando de inicio
CMD ["node", "dist/main.js"]