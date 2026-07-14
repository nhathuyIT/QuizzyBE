import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection, Types } from 'mongoose';
import { RoleType } from '../../common/enums/role-type.enum';
import type { AcademicDocumentStatus } from '../academic/schemas/academic-document.schema';
import { AdminRepository } from './admin.repository';
import {
  AdminAcademicDepartmentQueryDto,
  AdminAcademicDocumentQueryDto,
  AdminAcademicSubjectQueryDto,
  CreateAdminDepartmentDto,
  CreateAdminSubjectDto,
  ReviewAdminAcademicDocumentDto,
  UpdateAdminAcademicDocumentDto,
  UpdateAdminDepartmentDto,
  UpdateAdminSubjectDto,
} from './dto/admin-academic.dto';
import {
  AdminActivityQueryDto,
  AdminAuditLogQueryDto,
  AdminDateRangeDto,
  AdminDeckDetailQueryDto,
  AdminDeckQueryDto,
  AdminStudySessionQueryDto,
  AdminStudySummaryQueryDto,
  AdminUserQueryDto,
  CreateAdminDeckDto,
  ModerateDeckDto,
  UpdateAdminDeckDto,
  UpdateAdminUserRoleDto,
  UpdateAdminUserStatusDto,
} from './dto/admin.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_MS = 365 * DAY_MS;

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  getDashboardSummary(query: AdminDateRangeDto) {
    const { from, to } = this.resolveDateRange(query.from, query.to);
    return this.adminRepository.getDashboardSummary(from, to);
  }

  async getActivity(query: AdminActivityQueryDto) {
    const { from, to } = this.resolveDateRange(query.from, query.to);
    return {
      interval: query.interval,
      from,
      to,
      series: await this.adminRepository.getActivity(from, to, query.interval),
    };
  }

  async findUsers(query: AdminUserQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.keyword?.trim()) {
      const keyword = new RegExp(this.escapeRegex(query.keyword.trim()), 'i');
      filter.$or = [{ name: keyword }, { email: keyword }];
    }
    if (query.role) filter.role = query.role;
    if (query.status === 'deleted') {
      filter.isDeleted = true;
    } else {
      filter.isDeleted = { $ne: true };
      if (query.status) filter.status = query.status;
    }

    const result = await this.adminRepository.findUsers(
      filter,
      query.page,
      query.take,
    );
    return this.toPage(result, query.page, query.take);
  }

  async findUser(userId: string) {
    const user = await this.adminRepository.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');
    const metrics = await this.adminRepository.getUserMetrics(userId);
    return { ...user, metrics };
  }

  async updateUserRole(
    userId: string,
    dto: UpdateAdminUserRoleDto,
    adminId: string,
  ) {
    if (userId === adminId && dto.role !== RoleType.ADMIN) {
      throw new ForbiddenException('You cannot remove your own admin role');
    }
    const current = await this.requireUser(userId);
    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateUser(
        userId,
        { $set: { role: dto.role }, $inc: { tokenVersion: 1 } },
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'user.role_updated',
          targetType: 'user',
          targetId: userId,
          metadata: { from: current.role, to: dto.role },
        },
        session,
      );
      return updated;
    });
  }

  async updateUserStatus(
    userId: string,
    dto: UpdateAdminUserStatusDto,
    adminId: string,
  ) {
    if (userId === adminId && dto.status === 'suspended') {
      throw new ForbiddenException('You cannot suspend your own account');
    }
    const current = await this.requireUser(userId);
    const now = new Date();
    const update =
      dto.status === 'suspended'
        ? {
            $set: {
              status: 'suspended',
              suspendedAt: now,
              suspendedReason: dto.reason?.trim() || 'Suspended by admin',
            },
            $inc: { tokenVersion: 1 },
          }
        : {
            $set: { status: 'active' },
            $unset: { suspendedAt: 1, suspendedReason: 1 },
          };

    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateUser(
        userId,
        update,
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'user.status_updated',
          targetType: 'user',
          targetId: userId,
          metadata: {
            from: current.status ?? 'active',
            to: dto.status,
            reason: dto.reason,
          },
        },
        session,
      );
      return updated;
    });
  }

  async revokeUserSessions(userId: string, adminId: string) {
    await this.requireUser(userId);
    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateUser(
        userId,
        { $inc: { tokenVersion: 1 } },
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'user.sessions_revoked',
          targetType: 'user',
          targetId: userId,
        },
        session,
      );
      return updated;
    });
  }

  async deleteUser(userId: string, adminId: string) {
    if (userId === adminId) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    await this.requireUser(userId);
    const now = new Date();
    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateUser(
        userId,
        {
          $set: {
            isDeleted: true,
            status: 'suspended',
            suspendedAt: now,
            suspendedReason: 'Deleted by admin',
          },
          $inc: { tokenVersion: 1 },
        },
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'user.deleted',
          targetType: 'user',
          targetId: userId,
        },
        session,
      );
      return updated;
    });
  }

  async restoreUser(userId: string, adminId: string) {
    const current = await this.requireUser(userId);
    if (!current.isDeleted) {
      throw new BadRequestException('User is not deleted');
    }
    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateUser(
        userId,
        {
          $set: { isDeleted: false, status: 'active' },
          $unset: { suspendedAt: 1, suspendedReason: 1 },
        },
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'user.restored',
          targetType: 'user',
          targetId: userId,
        },
        session,
      );
      return updated;
    });
  }

  async findDecks(query: AdminDeckQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.keyword?.trim()) {
      const keyword = new RegExp(this.escapeRegex(query.keyword.trim()), 'i');
      filter.$or = [{ title: keyword }, { description: keyword }];
    }
    if (query.visibility) filter.visibility = query.visibility;
    if (query.ownerId) filter.createdBy = new Types.ObjectId(query.ownerId);
    if (query.moderationStatus === 'deleted') {
      filter.deletedAt = { $exists: true };
    } else {
      filter.deletedAt = { $exists: false };
      if (query.moderationStatus) {
        filter.moderationStatus = query.moderationStatus;
      }
    }

    const result = await this.adminRepository.findDecks(
      filter,
      query.page,
      query.take,
    );
    return this.toPage(result, query.page, query.take);
  }

  async createDeck(dto: CreateAdminDeckDto, adminId: string) {
    await this.requireUser(dto.ownerId);

    return this.connection.transaction(async (session) => {
      const deck = await this.adminRepository.createDeck(
        {
          title: dto.title.trim(),
          description: dto.description?.trim(),
          visibility: dto.visibility ?? 'private',
          createdBy: new Types.ObjectId(dto.ownerId),
          sourceType: 'manual',
          tags: this.normalizeTags(dto.tags ?? []),
        },
        session,
      );

      const deckId = this.getRecordId(deck);
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'deck.created',
          targetType: 'deck',
          targetId: deckId,
          metadata: { ownerId: dto.ownerId },
        },
        session,
      );

      return deck;
    });
  }

  async findDeck(deckId: string, query: AdminDeckDetailQueryDto) {
    const deck = await this.adminRepository.findDeckById(deckId);
    if (!deck) throw new NotFoundException('Deck not found');
    const [metrics, cards] = await Promise.all([
      this.adminRepository.getDeckMetrics(deckId),
      this.adminRepository.findDeckCards(
        deckId,
        query.cardPage,
        query.cardTake,
      ),
    ]);
    return {
      ...deck,
      metrics,
      cards: this.toPage(cards, query.cardPage, query.cardTake),
    };
  }

  async updateDeck(
    deckId: string,
    dto: UpdateAdminDeckDto,
    adminId: string,
  ) {
    const current = await this.requireDeck(deckId);

    if (dto.ownerId) {
      await this.requireUser(dto.ownerId);
    }

    const update = this.buildSetUpdate({
      title: dto.title?.trim(),
      description: dto.description?.trim(),
      visibility: dto.visibility,
      tags: dto.tags ? this.normalizeTags(dto.tags) : undefined,
      createdBy: dto.ownerId ? new Types.ObjectId(dto.ownerId) : undefined,
    });

    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateDeck(
        deckId,
        update,
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'deck.updated',
          targetType: 'deck',
          targetId: deckId,
          metadata: { before: current, after: update.$set },
        },
        session,
      );
      return updated;
    });
  }

  async moderateDeck(deckId: string, dto: ModerateDeckDto, adminId: string) {
    const current = await this.requireDeck(deckId);
    const now = new Date();
    const update: Record<string, unknown> = {
      $set: {
        moderationStatus: dto.status,
        moderatedAt: now,
        moderatedBy: new Types.ObjectId(adminId),
      },
      $unset: { moderationReason: 1 },
    };

    if (dto.reason?.trim()) {
      (update.$set as Record<string, unknown>).moderationReason =
        dto.reason.trim();
      delete update.$unset;
    }

    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateDeck(
        deckId,
        update,
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'deck.moderated',
          targetType: 'deck',
          targetId: deckId,
          metadata: {
            from: current.moderationStatus ?? 'active',
            to: dto.status,
            reason: dto.reason,
          },
        },
        session,
      );
      return updated;
    });
  }

  async deleteDeck(deckId: string, adminId: string) {
    await this.requireDeck(deckId);
    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateDeck(
        deckId,
        { $set: { deletedAt: new Date() } },
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'deck.deleted',
          targetType: 'deck',
          targetId: deckId,
        },
        session,
      );
      return updated;
    });
  }

  async restoreDeck(deckId: string, adminId: string) {
    const current = await this.requireDeck(deckId);
    if (!current.deletedAt) {
      throw new BadRequestException('Deck is not deleted');
    }
    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateDeck(
        deckId,
        { $unset: { deletedAt: 1 } },
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'deck.restored',
          targetType: 'deck',
          targetId: deckId,
        },
        session,
      );
      return updated;
    });
  }

  async findStudySessions(query: AdminStudySessionQueryDto) {
    const { from, to } = this.resolveDateRange(query.from, query.to);
    const filter: Record<string, unknown> = {
      startedAt: { $gte: from, $lte: to },
    };
    if (query.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query.deckId) filter.deckId = new Types.ObjectId(query.deckId);
    if (query.mode) filter.mode = query.mode;
    if (query.status === 'finished') filter.finishedAt = { $ne: null };
    if (query.status === 'unfinished') filter.finishedAt = null;
    const result = await this.adminRepository.findStudySessions(
      filter,
      query.page,
      query.take,
    );
    return this.toPage(result, query.page, query.take);
  }

  async findStudySession(sessionId: string) {
    const session = await this.adminRepository.findStudySessionById(sessionId);
    if (!session) throw new NotFoundException('Study session not found');
    return session;
  }

  async findSessionReviews(sessionId: string, page: number, take: number) {
    await this.findStudySession(sessionId);
    const result = await this.adminRepository.findSessionReviews(
      sessionId,
      page,
      take,
    );
    return this.toPage(result, page, take);
  }

  getStudySummary(query: AdminStudySummaryQueryDto) {
    const { from, to } = this.resolveDateRange(query.from, query.to);
    return this.adminRepository.getStudySummary(from, to, query.mode);
  }

  async findAuditLogs(query: AdminAuditLogQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.adminId) filter.adminId = new Types.ObjectId(query.adminId);
    if (query.action) filter.action = query.action;
    if (query.from || query.to) {
      const { from, to } = this.resolveDateRange(query.from, query.to);
      filter.createdAt = { $gte: from, $lte: to };
    }
    const result = await this.adminRepository.findAuditLogs(
      filter,
      query.page,
      query.take,
    );
    return this.toPage(result, query.page, query.take);
  }

  async findAcademicDepartments(query: AdminAcademicDepartmentQueryDto) {
    const filter: Record<string, unknown> = {};

    if (query.keyword?.trim()) {
      const keyword = new RegExp(this.escapeRegex(query.keyword.trim()), 'i');
      filter.$or = [
        { code: keyword },
        { name: keyword },
        { description: keyword },
      ];
    }

    if (query.status === 'active') filter.isActive = true;
    if (query.status === 'inactive') filter.isActive = false;

    const result = await this.adminRepository.findAcademicDepartments(
      filter,
      query.page,
      query.take,
    );
    return this.toPage(result, query.page, query.take);
  }

  async createAcademicDepartment(
    dto: CreateAdminDepartmentDto,
    adminId: string,
  ) {
    return this.withDuplicateKeyMessage(
      () =>
        this.connection.transaction(async (session) => {
          const department =
            await this.adminRepository.createAcademicDepartment(
              {
                code: dto.code.toUpperCase(),
                name: dto.name,
                description: dto.description,
                isActive: dto.isActive ?? true,
              },
              session,
            );
          await this.adminRepository.createAuditLog(
            {
              adminId,
              action: 'academic.department_created',
              targetType: 'academic_department',
              targetId: this.getRecordId(department),
              metadata: { code: dto.code.toUpperCase() },
            },
            session,
          );
          return department;
        }),
      'Department code already exists',
    );
  }

  async updateAcademicDepartment(
    departmentId: string,
    dto: UpdateAdminDepartmentDto,
    adminId: string,
  ) {
    const current = await this.requireAcademicDepartment(departmentId);
    const update = this.buildSetUpdate({
      code: dto.code?.toUpperCase(),
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive,
    });

    return this.withDuplicateKeyMessage(
      () =>
        this.connection.transaction(async (session) => {
          const updated = await this.adminRepository.updateAcademicDepartment(
            departmentId,
            update,
            session,
          );
          await this.adminRepository.createAuditLog(
            {
              adminId,
              action: 'academic.department_updated',
              targetType: 'academic_department',
              targetId: departmentId,
              metadata: { before: current, after: update.$set },
            },
            session,
          );
          return updated;
        }),
      'Department code already exists',
    );
  }

  async deleteAcademicDepartment(departmentId: string, adminId: string) {
    const current = await this.requireAcademicDepartment(departmentId);

    if (current.isActive === false) {
      return current;
    }

    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateAcademicDepartment(
        departmentId,
        { $set: { isActive: false } },
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'academic.department_deactivated',
          targetType: 'academic_department',
          targetId: departmentId,
        },
        session,
      );
      return updated;
    });
  }

  async restoreAcademicDepartment(departmentId: string, adminId: string) {
    const current = await this.requireAcademicDepartment(departmentId);

    if (current.isActive !== false) {
      return current;
    }

    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateAcademicDepartment(
        departmentId,
        { $set: { isActive: true } },
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'academic.department_restored',
          targetType: 'academic_department',
          targetId: departmentId,
        },
        session,
      );
      return updated;
    });
  }

  async findAcademicSubjects(query: AdminAcademicSubjectQueryDto) {
    const filter: Record<string, unknown> = {};

    if (query.keyword?.trim()) {
      const keyword = new RegExp(this.escapeRegex(query.keyword.trim()), 'i');
      filter.$or = [{ code: keyword }, { name: keyword }];
    }

    if (query.departmentId) {
      filter.departmentId = new Types.ObjectId(query.departmentId);
    }

    if (query.semester) filter.semester = query.semester;
    if (query.status === 'active') filter.isActive = true;
    if (query.status === 'inactive') filter.isActive = false;

    const result = await this.adminRepository.findAcademicSubjects(
      filter,
      query.page,
      query.take,
    );
    return this.toPage(result, query.page, query.take);
  }

  async createAcademicSubject(dto: CreateAdminSubjectDto, adminId: string) {
    await this.requireActiveAcademicDepartment(dto.departmentId);

    return this.withDuplicateKeyMessage(
      () =>
        this.connection.transaction(async (session) => {
          const subject = await this.adminRepository.createAcademicSubject(
            {
              code: dto.code.toUpperCase(),
              name: dto.name,
              departmentId: new Types.ObjectId(dto.departmentId),
              semester: dto.semester,
              isActive: dto.isActive ?? true,
            },
            session,
          );
          await this.adminRepository.createAuditLog(
            {
              adminId,
              action: 'academic.subject_created',
              targetType: 'academic_subject',
              targetId: this.getRecordId(subject),
              metadata: {
                code: dto.code.toUpperCase(),
                departmentId: dto.departmentId,
                semester: dto.semester,
              },
            },
            session,
          );
          return subject;
        }),
      'Subject code already exists in this department',
    );
  }

  async updateAcademicSubject(
    subjectId: string,
    dto: UpdateAdminSubjectDto,
    adminId: string,
  ) {
    const current = await this.requireAcademicSubject(subjectId);
    const nextDepartmentId = dto.departmentId;

    if (nextDepartmentId) {
      await this.requireActiveAcademicDepartment(nextDepartmentId);
    }

    const update = this.buildSetUpdate({
      code: dto.code?.toUpperCase(),
      name: dto.name,
      departmentId: nextDepartmentId
        ? new Types.ObjectId(nextDepartmentId)
        : undefined,
      semester: dto.semester,
      isActive: dto.isActive,
    });

    return this.withDuplicateKeyMessage(
      () =>
        this.connection.transaction(async (session) => {
          const updated = await this.adminRepository.updateAcademicSubject(
            subjectId,
            update,
            session,
          );
          await this.adminRepository.createAuditLog(
            {
              adminId,
              action: 'academic.subject_updated',
              targetType: 'academic_subject',
              targetId: subjectId,
              metadata: { before: current, after: update.$set },
            },
            session,
          );
          return updated;
        }),
      'Subject code already exists in this department',
    );
  }

  async deleteAcademicSubject(subjectId: string, adminId: string) {
    const current = await this.requireAcademicSubject(subjectId);

    if (current.isActive === false) {
      return current;
    }

    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateAcademicSubject(
        subjectId,
        { $set: { isActive: false } },
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'academic.subject_deactivated',
          targetType: 'academic_subject',
          targetId: subjectId,
        },
        session,
      );
      return updated;
    });
  }

  async restoreAcademicSubject(subjectId: string, adminId: string) {
    const current = await this.requireAcademicSubject(subjectId);
    await this.requireActiveAcademicDepartment(
      this.getObjectIdString(current.departmentId),
    );

    if (current.isActive !== false) {
      return current;
    }

    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateAcademicSubject(
        subjectId,
        { $set: { isActive: true } },
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'academic.subject_restored',
          targetType: 'academic_subject',
          targetId: subjectId,
        },
        session,
      );
      return updated;
    });
  }

  async findAcademicDocuments(query: AdminAcademicDocumentQueryDto) {
    const filter: Record<string, unknown> = {};

    if (query.keyword?.trim()) {
      const keyword = new RegExp(this.escapeRegex(query.keyword.trim()), 'i');
      filter.$or = [
        { title: keyword },
        { description: keyword },
        { fileName: keyword },
        { tags: keyword },
      ];
    }

    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    } else if (!query.status) {
      filter.status = { $ne: 'archived' };
    }

    if (query.subjectId) filter.subjectId = new Types.ObjectId(query.subjectId);
    if (query.uploaderId)
      filter.uploadedBy = new Types.ObjectId(query.uploaderId);
    if (query.fileType) filter.fileType = query.fileType;

    const result = await this.adminRepository.findAcademicDocuments(
      filter,
      query.page,
      query.take,
      query.departmentId,
    );
    return this.toPage(result, query.page, query.take);
  }

  async findAcademicDocument(documentId: string) {
    return this.requireAcademicDocument(documentId);
  }

  async updateAcademicDocument(
    documentId: string,
    dto: UpdateAdminAcademicDocumentDto,
    adminId: string,
  ) {
    const current = await this.requireAcademicDocument(documentId);
    const currentSubjectId = this.getObjectIdString(current.subjectId);
    const nextSubjectId = dto.subjectId ?? currentSubjectId;

    if (dto.subjectId && dto.subjectId !== currentSubjectId) {
      await this.requireActiveAcademicSubject(dto.subjectId);
    }

    const update = this.buildSetUpdate({
      title: dto.title,
      description: dto.description,
      subjectId: dto.subjectId ? new Types.ObjectId(dto.subjectId) : undefined,
      tags: dto.tags ? this.normalizeTags(dto.tags) : undefined,
    });

    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateAcademicDocument(
        documentId,
        update,
        session,
      );

      if (
        current.status === 'active' &&
        dto.subjectId &&
        dto.subjectId !== currentSubjectId
      ) {
        await this.adminRepository.incrementAcademicSubjectDocumentCount(
          currentSubjectId,
          -1,
          session,
        );
        await this.adminRepository.incrementAcademicSubjectDocumentCount(
          nextSubjectId,
          1,
          session,
        );
      }

      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'academic.document_updated',
          targetType: 'academic_document',
          targetId: documentId,
          metadata: { before: current, after: update.$set },
        },
        session,
      );
      return updated;
    });
  }

  async reviewAcademicDocument(
    documentId: string,
    dto: ReviewAdminAcademicDocumentDto,
    adminId: string,
  ) {
    const current = await this.requireAcademicDocument(documentId);

    if (current.status === 'archived') {
      throw new BadRequestException('Archived document cannot be reviewed');
    }

    const subjectId = this.getObjectIdString(current.subjectId);
    if (dto.status === 'active') {
      await this.requireActiveAcademicSubject(subjectId);
    }

    const setUpdate: Record<string, unknown> = {
      status: dto.status,
      reviewedBy: new Types.ObjectId(adminId),
      reviewedAt: new Date(),
    };
    const update: Record<string, unknown> = { $set: setUpdate };

    if (dto.note?.trim()) {
      setUpdate.reviewNote = dto.note.trim();
    } else {
      update.$unset = { reviewNote: 1 };
    }

    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateAcademicDocument(
        documentId,
        update,
        session,
      );
      await this.adjustSubjectDocumentCount(
        current.status,
        dto.status,
        subjectId,
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'academic.document_reviewed',
          targetType: 'academic_document',
          targetId: documentId,
          metadata: {
            from: current.status,
            to: dto.status,
            note: dto.note,
          },
        },
        session,
      );
      return updated;
    });
  }

  async deleteAcademicDocument(documentId: string, adminId: string) {
    const current = await this.requireAcademicDocument(documentId);

    if (current.status === 'archived') {
      return current;
    }

    const subjectId = this.getObjectIdString(current.subjectId);

    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateAcademicDocument(
        documentId,
        { $set: { status: 'archived' } },
        session,
      );

      if (current.status === 'active') {
        await this.adminRepository.incrementAcademicSubjectDocumentCount(
          subjectId,
          -1,
          session,
        );
      }

      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'academic.document_archived',
          targetType: 'academic_document',
          targetId: documentId,
          metadata: { from: current.status },
        },
        session,
      );
      return updated;
    });
  }

  async restoreAcademicDocument(documentId: string, adminId: string) {
    const current = await this.requireAcademicDocument(documentId);

    if (current.status !== 'archived') {
      return current;
    }

    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateAcademicDocument(
        documentId,
        {
          $set: { status: 'pending' },
          $unset: { reviewedBy: 1, reviewedAt: 1, reviewNote: 1 },
        },
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'academic.document_restored',
          targetType: 'academic_document',
          targetId: documentId,
          metadata: { to: 'pending' },
        },
        session,
      );
      return updated;
    });
  }

  private async requireUser(userId: string) {
    const user = await this.adminRepository.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async requireDeck(deckId: string) {
    const deck = await this.adminRepository.findDeckById(deckId);
    if (!deck) throw new NotFoundException('Deck not found');
    return deck;
  }

  private async requireAcademicDepartment(departmentId: string) {
    const department =
      await this.adminRepository.findAcademicDepartmentById(departmentId);
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return department;
  }

  private async requireActiveAcademicDepartment(departmentId: string) {
    const department = await this.requireAcademicDepartment(departmentId);
    if (department.isActive === false) {
      throw new BadRequestException('Department is inactive');
    }
    return department;
  }

  private async requireAcademicSubject(subjectId: string) {
    const subject =
      await this.adminRepository.findAcademicSubjectById(subjectId);
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    return subject;
  }

  private async requireActiveAcademicSubject(subjectId: string) {
    const subject = await this.requireAcademicSubject(subjectId);
    if (subject.isActive === false) {
      throw new BadRequestException('Subject is inactive');
    }
    await this.requireActiveAcademicDepartment(
      this.getObjectIdString(subject.departmentId),
    );
    return subject;
  }

  private async requireAcademicDocument(documentId: string) {
    const document =
      await this.adminRepository.findAcademicDocumentById(documentId);
    if (!document) {
      throw new NotFoundException('Academic document not found');
    }
    return document;
  }

  private buildSetUpdate(set: Record<string, unknown>) {
    const normalizedSet = Object.fromEntries(
      Object.entries(set).filter(([, value]) => value !== undefined),
    );

    if (!Object.keys(normalizedSet).length) {
      throw new BadRequestException('No changes provided');
    }

    return { $set: normalizedSet };
  }

  private getRecordId(record: Record<string, unknown>) {
    return this.getObjectIdString(record._id);
  }

  private getObjectIdString(value: unknown) {
    if (value instanceof Types.ObjectId) {
      return value.toString();
    }

    if (typeof value === 'string') {
      return value;
    }

    throw new BadRequestException('Invalid object id reference');
  }

  private normalizeTags(tags: string[]) {
    return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
  }

  private async adjustSubjectDocumentCount(
    fromStatus: AcademicDocumentStatus | undefined,
    toStatus: AcademicDocumentStatus,
    subjectId: string,
    session: ClientSession,
  ) {
    if (fromStatus === toStatus) {
      return;
    }

    if (fromStatus === 'active') {
      await this.adminRepository.incrementAcademicSubjectDocumentCount(
        subjectId,
        -1,
        session,
      );
      return;
    }

    if (toStatus === 'active') {
      await this.adminRepository.incrementAcademicSubjectDocumentCount(
        subjectId,
        1,
        session,
      );
    }
  }

  private resolveDateRange(fromValue?: string, toValue?: string) {
    const to = toValue ? new Date(toValue) : new Date();
    const from = fromValue
      ? new Date(fromValue)
      : new Date(to.getTime() - 30 * DAY_MS);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid date range');
    }
    if (from > to) {
      throw new BadRequestException('from must be before to');
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      throw new BadRequestException('Date range cannot exceed 365 days');
    }
    return { from, to };
  }

  private toPage<T>(
    result: { data: T[]; itemCount: number },
    page: number,
    take: number,
  ) {
    return {
      data: result.data,
      meta: {
        page,
        take,
        itemCount: result.itemCount,
        pageCount: Math.ceil(result.itemCount / take),
        hasPreviousPage: page > 1,
        hasNextPage: page * take < result.itemCount,
      },
    };
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async withDuplicateKeyMessage<T>(
    operation: () => Promise<T>,
    message: string,
  ) {
    try {
      return await operation();
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new BadRequestException(message);
      }
      throw error;
    }
  }

  private isDuplicateKeyError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }
}
