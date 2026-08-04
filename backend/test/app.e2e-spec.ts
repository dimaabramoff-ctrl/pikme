/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from './../src/app.module';

const TEST_PASSWORD = 'TestPass123';

describe('Auth and RBAC (e2e)', () => {
  let app: INestApplication;
  const initialGeoProvider = process.env.GEO_PROVIDER;
  const initialMapboxToken = process.env.MAPBOX_SERVER_TOKEN;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    const httpAdapter = app.getHttpAdapter().getInstance() as {
      set: (key: string, value: number) => void;
    };
    httpAdapter.set('trust proxy', 1);
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    process.env.GEO_PROVIDER = initialGeoProvider;
    process.env.MAPBOX_SERVER_TOKEN = initialMapboxToken;
    await app.close();
  });

  it('GET /api/health returns ok', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });

  it('GET /api/catalog/nearby validates query and returns nearby places', async () => {
    process.env.GEO_PROVIDER = 'fake';

    const response = await request(app.getHttpServer())
      .get('/api/catalog/nearby')
      .query({ latitude: 52.52, longitude: 13.405, radius: 5000 })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const firstItem = response.body[0] as {
      id: unknown;
      source: unknown;
      name: unknown;
      isPickmeConnected: unknown;
    };
    expect(typeof firstItem.id).toBe('string');
    expect(typeof firstItem.source).toBe('string');
    expect(['PICKME', 'EXTERNAL']).toContain(firstItem.source);
    expect(typeof firstItem.name).toBe('string');
    expect(typeof firstItem.isPickmeConnected).toBe('boolean');
  });

  it('GET /api/catalog/nearby returns 400 for invalid radius/coordinates', async () => {
    await request(app.getHttpServer())
      .get('/api/catalog/nearby')
      .query({ latitude: 120, longitude: 13.405, radius: 200 })
      .expect(400);
  });

  it('GET /api/catalog/nearby returns provider configuration error when key is missing', async () => {
    process.env.GEO_PROVIDER = 'mapbox';
    delete process.env.MAPBOX_SERVER_TOKEN;

    const response = await request(app.getHttpServer())
      .get('/api/catalog/nearby')
      .query({ latitude: 52.52, longitude: 13.405, radius: 5000 })
      .expect(503);

    expect(response.body.code).toBe('CATALOG_PROVIDER_NOT_CONFIGURED');
  });

  it('register customer -> 201, duplicate email -> 409', async () => {
    const unique = Date.now();

    await request(app.getHttpServer())
      .post('/api/auth/register/customer')
      .send({
        name: `Customer ${unique}`,
        email: `newcustomer${unique}@example.test`,
        phone: `+49002${unique}`,
        password: 'Passw0rd123',
        passwordConfirmation: 'Passw0rd123',
      })
      .expect(201);

    const duplicate = await request(app.getHttpServer())
      .post('/api/auth/register/customer')
      .send({
        name: `Customer ${unique}`,
        email: `newcustomer${unique}@example.test`,
        phone: `+49003${unique}`,
        password: 'Passw0rd123',
        passwordConfirmation: 'Passw0rd123',
      })
      .expect(409);

    expect(duplicate.body.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('login -> me -> refresh rotation -> old refresh rejected -> logout', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.1')
      .send({ emailOrPhone: 'customer@example.test', password: TEST_PASSWORD })
      .expect(200);

    const accessToken = login.body.accessToken as string;
    const refreshCookie = login.headers['set-cookie'][0] as string;
    expect(accessToken).toBeDefined();
    expect(refreshCookie).toContain('refreshToken=');

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer()).get('/api/auth/me').expect(401);

    const refresh = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie)
      .send({})
      .expect(200);

    const rotatedCookie = refresh.headers['set-cookie'][0] as string;
    expect(rotatedCookie).toContain('refreshToken=');

    const reused = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie)
      .send({})
      .expect(401);

    expect(reused.body.code).toBe('REFRESH_TOKEN_REUSED');

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', rotatedCookie)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', rotatedCookie)
      .send({})
      .expect(401);
  });

  it('role protected endpoints', async () => {
    const customerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.2')
      .send({ emailOrPhone: 'customer@example.test', password: TEST_PASSWORD })
      .expect(200);

    const customerToken = customerLogin.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/master/profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    const masterLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.3')
      .send({ emailOrPhone: 'master@example.test', password: TEST_PASSWORD })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/master/profile')
      .set('Authorization', `Bearer ${masterLogin.body.accessToken as string}`)
      .expect(200);

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.4')
      .send({ emailOrPhone: 'admin@example.test', password: TEST_PASSWORD })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/salon-admin/profile')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken as string}`)
      .expect(200);

    const superAdminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.5')
      .send({
        emailOrPhone: 'superadmin@example.test',
        password: TEST_PASSWORD,
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/admin/profile')
      .set(
        'Authorization',
        `Bearer ${superAdminLogin.body.accessToken as string}`,
      )
      .expect(200);
  });

  it('change password revokes all sessions', async () => {
    const firstLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.6')
      .send({ emailOrPhone: 'customer2@example.test', password: TEST_PASSWORD })
      .expect(200);

    const accessToken = firstLogin.body.accessToken as string;

    await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: TEST_PASSWORD,
        newPassword: 'NewPass1234',
        newPasswordConfirmation: 'NewPass1234',
      })
      .expect(200);

    const refreshCookie = firstLogin.headers['set-cookie'][0] as string;
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie)
      .send({})
      .expect(401);
  });

  it('login throttling returns 429 when the limit is exceeded', async () => {
    for (let i = 0; i < 60; i += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('x-forwarded-for', '10.0.0.99')
        .send({
          emailOrPhone: 'nobody@example.test',
          password: 'wrongpass123',
        });
    }

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-forwarded-for', '10.0.0.99')
      .send({ emailOrPhone: 'nobody@example.test', password: 'wrongpass123' })
      .expect(429);
  });
});
