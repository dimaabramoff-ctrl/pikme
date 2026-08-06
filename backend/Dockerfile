FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json package-lock.json* ./
COPY packages/api-types/package.json ./packages/api-types/
COPY backend/package*.json ./backend/

RUN npm ci --workspace=backend --include-workspace-root

COPY packages/api-types ./packages/api-types
COPY backend ./backend

WORKDIR /app/backend
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
