import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { IncomingHttpHeaders } from 'http';
import request from 'supertest';
import { App } from 'supertest/types';
import { RoleType } from '../src/common/enums/role-type.enum';
import { JwtAuthGuard } from '../src/common/guards/jwt.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AdminAcademicController } from '../src/modules/admin/admin-academic.controller';
import { AdminController } from '../src/modules/admin/admin.controller';
import { AdminService } from '../src/modules/admin/admin.service';

const ADMIN_TOKEN = 'Bearer admin';
const STUDENT_TOKEN = 'Bearer student';
const ADMIN_ID = '64b390af8462fed8a3f93240';
const USER_ID = '64b390af8462fed8a3f93241';
const DECK_ID = '64b390af8462fed8a3f93242';
const SESSION_ID = '64b390af8462fed8a3f93243';
const DEPARTMENT_ID = '64b390af8462fed8a3f93244';
const SUBJECT_ID = '64b390af8462fed8a3f93245';
const DOCUMENT_ID = '64b390af8462fed8a3f93246';

interface TestRequest {
  headers: IncomingHttpHeaders;
  user?: {
    id: string;
    email: string;
    role: RoleType;
  };
}

describe('AdminController (e2e)', () => {
  let app: INestApplication<App>;
  let adminService: Record<string, jest.Mock>;

  const authGuard: CanActivate = {
    canActivate(context: ExecutionContext) {
      const httpRequest = context.switchToHttp().getRequest<TestRequest>();
      const authorization = httpRequest.headers.authorization;

      if (!authorization) {
        throw new UnauthorizedException();
      }

      httpRequest.user = {
        id: ADMIN_ID,
        email: 'admin@quizzy.local',
        role:
          authorization === STUDENT_TOKEN ? RoleType.STUDENT : RoleType.ADMIN,
      };

      return true;
    },
  };

  const rolesGuard: CanActivate = {
    canActivate(context: ExecutionContext) {
      const httpRequest = context.switchToHttp().getRequest<TestRequest>();
      if (httpRequest.user?.role !== RoleType.ADMIN) {
        throw new ForbiddenException();
      }
      return true;
    },
  };

  beforeEach(async () => {
    adminService = {
      getDashboardSummary: jest.fn().mockResolvedValue({ totalUsers: 1 }),
      getActivity: jest.fn().mockResolvedValue({ interval: 'day', series: [] }),
      findUsers: jest.fn().mockResolvedValue({ data: [], meta: pageMeta() }),
      findUser: jest.fn().mockResolvedValue({ id: USER_ID }),
      updateUserRole: jest
        .fn()
        .mockResolvedValue({ id: USER_ID, role: 'teacher' }),
      updateUserStatus: jest
        .fn()
        .mockResolvedValue({ id: USER_ID, status: 'suspended' }),
      revokeUserSessions: jest.fn().mockResolvedValue({ id: USER_ID }),
      deleteUser: jest.fn().mockResolvedValue({ id: USER_ID, isDeleted: true }),
      restoreUser: jest
        .fn()
        .mockResolvedValue({ id: USER_ID, isDeleted: false }),
      findDecks: jest.fn().mockResolvedValue({ data: [], meta: pageMeta() }),
      findDeck: jest.fn().mockResolvedValue({ id: DECK_ID }),
      moderateDeck: jest
        .fn()
        .mockResolvedValue({ id: DECK_ID, moderationStatus: 'hidden' }),
      deleteDeck: jest.fn().mockResolvedValue({ id: DECK_ID }),
      restoreDeck: jest.fn().mockResolvedValue({ id: DECK_ID }),
      getStudySummary: jest.fn().mockResolvedValue({ reviews: 1 }),
      findStudySessions: jest
        .fn()
        .mockResolvedValue({ data: [], meta: pageMeta() }),
      findStudySession: jest.fn().mockResolvedValue({ id: SESSION_ID }),
      findSessionReviews: jest
        .fn()
        .mockResolvedValue({ data: [], meta: pageMeta() }),
      findAuditLogs: jest
        .fn()
        .mockResolvedValue({ data: [], meta: pageMeta() }),
      findAcademicDepartments: jest
        .fn()
        .mockResolvedValue({ data: [], meta: pageMeta() }),
      createAcademicDepartment: jest
        .fn()
        .mockResolvedValue({ id: DEPARTMENT_ID }),
      updateAcademicDepartment: jest
        .fn()
        .mockResolvedValue({ id: DEPARTMENT_ID }),
      deleteAcademicDepartment: jest
        .fn()
        .mockResolvedValue({ id: DEPARTMENT_ID }),
      restoreAcademicDepartment: jest
        .fn()
        .mockResolvedValue({ id: DEPARTMENT_ID }),
      findAcademicSubjects: jest
        .fn()
        .mockResolvedValue({ data: [], meta: pageMeta() }),
      createAcademicSubject: jest.fn().mockResolvedValue({ id: SUBJECT_ID }),
      updateAcademicSubject: jest.fn().mockResolvedValue({ id: SUBJECT_ID }),
      deleteAcademicSubject: jest.fn().mockResolvedValue({ id: SUBJECT_ID }),
      restoreAcademicSubject: jest.fn().mockResolvedValue({ id: SUBJECT_ID }),
      findAcademicDocuments: jest
        .fn()
        .mockResolvedValue({ data: [], meta: pageMeta() }),
      findAcademicDocument: jest.fn().mockResolvedValue({ id: DOCUMENT_ID }),
      updateAcademicDocument: jest.fn().mockResolvedValue({ id: DOCUMENT_ID }),
      reviewAcademicDocument: jest
        .fn()
        .mockResolvedValue({ id: DOCUMENT_ID, status: 'active' }),
      deleteAcademicDocument: jest.fn().mockResolvedValue({ id: DOCUMENT_ID }),
      restoreAcademicDocument: jest.fn().mockResolvedValue({ id: DOCUMENT_ID }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminController, AdminAcademicController],
      providers: [
        { provide: AdminService, useValue: adminService },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .overrideGuard(RolesGuard)
      .useValue(rolesGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects missing token and non-admin users', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/dashboard/summary')
      .expect(401);

    await request(app.getHttpServer())
      .get('/v1/admin/dashboard/summary')
      .set('Authorization', STUDENT_TOKEN)
      .expect(403);
  });

  it('exposes all Admin V1 routes for admin users', async () => {
    const server = app.getHttpServer();

    await request(server)
      .get('/v1/admin/dashboard/summary')
      .set('Authorization', ADMIN_TOKEN)
      .expect(200)
      .expect({ success: true, data: { totalUsers: 1 } });

    await request(server)
      .get('/v1/admin/analytics/activity?interval=week')
      .set('Authorization', ADMIN_TOKEN)
      .expect(200)
      .expect({ success: true, data: { interval: 'day', series: [] } });

    await request(server)
      .get('/v1/admin/users?page=1&take=10')
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .get(`/v1/admin/users/${USER_ID}`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .patch(`/v1/admin/users/${USER_ID}/role`)
      .set('Authorization', ADMIN_TOKEN)
      .send({ role: 'teacher' })
      .expect(200);

    await request(server)
      .patch(`/v1/admin/users/${USER_ID}/status`)
      .set('Authorization', ADMIN_TOKEN)
      .send({ status: 'suspended', reason: 'Policy violation' })
      .expect(200);

    await request(server)
      .post(`/v1/admin/users/${USER_ID}/revoke-sessions`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .delete(`/v1/admin/users/${USER_ID}`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .post(`/v1/admin/users/${USER_ID}/restore`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .get('/v1/admin/decks?moderationStatus=hidden')
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .get(`/v1/admin/decks/${DECK_ID}`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .patch(`/v1/admin/decks/${DECK_ID}/moderation`)
      .set('Authorization', ADMIN_TOKEN)
      .send({ status: 'hidden', reason: 'Needs review' })
      .expect(200);

    await request(server)
      .delete(`/v1/admin/decks/${DECK_ID}`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .post(`/v1/admin/decks/${DECK_ID}/restore`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .get('/v1/admin/study-sessions')
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .get(`/v1/admin/study-sessions/${SESSION_ID}`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .get(`/v1/admin/study-sessions/${SESSION_ID}/reviews`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .get('/v1/admin/study/summary')
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .get('/v1/admin/audit-logs')
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .get('/v1/admin/academic/departments?status=all')
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .post('/v1/admin/academic/departments')
      .set('Authorization', ADMIN_TOKEN)
      .send({ code: 'SE', name: 'Software Engineering' })
      .expect(201);

    await request(server)
      .patch(`/v1/admin/academic/departments/${DEPARTMENT_ID}`)
      .set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Software Engineering Updated' })
      .expect(200);

    await request(server)
      .delete(`/v1/admin/academic/departments/${DEPARTMENT_ID}`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .post(`/v1/admin/academic/departments/${DEPARTMENT_ID}/restore`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .get(`/v1/admin/academic/subjects?departmentId=${DEPARTMENT_ID}`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .post('/v1/admin/academic/subjects')
      .set('Authorization', ADMIN_TOKEN)
      .send({
        code: 'SWE101',
        name: 'Software Engineering',
        departmentId: DEPARTMENT_ID,
        semester: 1,
      })
      .expect(201);

    await request(server)
      .patch(`/v1/admin/academic/subjects/${SUBJECT_ID}`)
      .set('Authorization', ADMIN_TOKEN)
      .send({ semester: 2 })
      .expect(200);

    await request(server)
      .delete(`/v1/admin/academic/subjects/${SUBJECT_ID}`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .post(`/v1/admin/academic/subjects/${SUBJECT_ID}/restore`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .get('/v1/admin/academic/documents?status=pending')
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .get(`/v1/admin/academic/documents/${DOCUMENT_ID}`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .patch(`/v1/admin/academic/documents/${DOCUMENT_ID}`)
      .set('Authorization', ADMIN_TOKEN)
      .send({ title: 'Reviewed material' })
      .expect(200);

    await request(server)
      .patch(`/v1/admin/academic/documents/${DOCUMENT_ID}/review`)
      .set('Authorization', ADMIN_TOKEN)
      .send({ status: 'active', note: 'Looks good' })
      .expect(200);

    await request(server)
      .delete(`/v1/admin/academic/documents/${DOCUMENT_ID}`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);

    await request(server)
      .post(`/v1/admin/academic/documents/${DOCUMENT_ID}/restore`)
      .set('Authorization', ADMIN_TOKEN)
      .expect(200);
  });
});

function pageMeta() {
  return {
    page: 1,
    take: 20,
    itemCount: 0,
    pageCount: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}
