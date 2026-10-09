# backend (Fastify + Prisma) pro docker-compose.producao.yml. O src/ vira um arquivo só (dist/app.js);
# as dependências continuam no node_modules
FROM node:24-slim

# o Prisma (migrate) precisa do OpenSSL, que a imagem slim não traz
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma7.config.ts ./
# o prisma7.config.ts exige DATABASE_URL, mas gerar o client não conecta em nada
RUN DATABASE_URL=postgres://gerar@localhost/gerar npx prisma generate --config prisma7.config.ts

COPY src ./src
COPY lib ./lib
RUN npx esbuild src/app.ts --bundle --platform=node --format=esm --target=node24 --packages=external --outfile=dist/app.js

ENV NODE_ENV=production
EXPOSE 3000

# aplica as migrations que faltam no banco e sobe
CMD ["sh", "-c", "npx prisma migrate deploy --config prisma7.config.ts && exec node dist/app.js"]
