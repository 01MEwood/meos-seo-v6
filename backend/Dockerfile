FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --production && npm cache clean --force

FROM node:20-alpine AS prisma
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 meos && adduser -u 1001 -G meos -s /bin/sh -D meos

COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma /app/node_modules/@prisma ./node_modules/@prisma

COPY package*.json ./
COPY prisma ./prisma
COPY src ./src

USER meos
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "src/index.js"]
