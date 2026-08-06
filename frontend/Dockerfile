FROM node:22-alpine
WORKDIR /app

COPY package*.json package-lock.json* ./
COPY packages/api-types/package.json ./packages/api-types/
COPY frontend/package*.json ./frontend/

RUN npm ci --workspace=frontend --include-workspace-root

COPY packages/api-types ./packages/api-types
COPY frontend ./frontend

WORKDIR /app/frontend
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
