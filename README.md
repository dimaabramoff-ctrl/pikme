# Пикми (PickMe)

Платформа для поиска парикмахерских и мастеров, онлайн-записи и вызова мастера на дом.

Текущий статус: реализован Этап 1 (основа проекта).

## Архитектура

- Monorepo на npm workspaces
- Frontend: React + TypeScript + Vite + Tailwind
- Backend: NestJS + TypeScript + Prisma + PostgreSQL
- Shared package: API контракты и realtime-тип

## Структура

```
pickme/
	frontend/
	backend/
	packages/
		api-types/
	docker-compose.yml
	package.json
	README.md
	.gitignore
```

## Установка

```bash
npm install
```

## Запуск разработки

```bash
npm run dev
```

Важно: в текущем Этапе 1 команды `dev` запускаются по workspace. Для стабильной ежедневной работы чаще используют отдельные терминалы:

```bash
npm run dev -w backend
npm run dev -w frontend
```

## Сборка

```bash
npm run build
```

## Линт и тесты

```bash
npm run lint
npm run test
npm run test:e2e
```

Frontend e2e (Playwright):

```bash
npm run test:e2e -w frontend
```

## Переменные окружения

Шаблоны:

- `frontend/.env.example`
- `backend/.env.example`

Локальные файлы:

- `frontend/.env`
- `backend/.env`

Они исключены из Git.

## Docker

Сервисы в `docker-compose.yml`:

- PostgreSQL
- backend
- frontend

Запуск:

```bash
docker compose up --build
```

## Prisma

Схема: `backend/prisma/schema.prisma`

Команды:

```bash
npm run prisma:generate -w backend
npm run prisma:migrate -w backend
npm run seed -w backend
```

## Swagger

- UI: `http://localhost:3000/api/docs`
- JSON: `http://localhost:3000/api/docs-json`

## API type generation

```bash
npm run api:generate -w frontend
npm run api:check -w frontend
```

## Realtime

В Этапе 1 добавлена инфраструктурная зависимость Socket.IO на backend/frontend и общий контракт `RealtimeEvent<T>` в `packages/api-types`.

## Карты и гео

В Этапе 1 подготовлены зависимости `mapbox-gl` и env-конфигурация токенов. Полная карта/nearby-логика будет реализована в следующих этапах.

## Quote flow и payment flow

Модели для quote/payment/refund/commission добавлены в Prisma-схему. Бизнес-логика и endpoint-ы будут добавлены по этапам 4-9.

## Тестовые аккаунты (seed)

- customer@example.test
- customer2@example.test
- master@example.test
- admin@example.test
- superadmin@example.test

На Этапе 1 auth-flow еще не реализован, поэтому эти аккаунты используются как тестовые сущности в БД.

## CI (план)

Подготовлены скрипты для локальных проверок. Полный pipeline (lint/unit/e2e/build/secret scan/audit) будет добавлен на этапе качества.

## Известные ограничения

- RBAC, JWT, refresh tokens: запланированы на Этап 2.
- Booking lifecycle, conflict protection, home-visit quote: запланированы на Этапы 4-6.
- Полный realtime с комнатами и дедупликацией: Этап 5.
- Stripe и вебхуки: Этап 9.

## Roadmap этапов

1. Основа проекта (выполнено)
2. Авторизация
3. Салоны и мастера
4. Запись
5. Realtime
6. Карта и выезд
7. Server-state и OpenAPI типы
8. Панели ролей
9. Платежи
10. Качество и полный e2e контур