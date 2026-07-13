import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { RoleType } from '../../common/enums/role-type.enum';
import { AdminRepository } from './admin.repository';
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
    const owner = await this.requireUser(dto.ownerId);
    if (owner.isDeleted) {
      throw new BadRequestException('Owner is deleted');
    }

    const input = {
      title: dto.title,
      description: dto.description,
      visibility: dto.visibility ?? 'private',
      tags: dto.tags ?? [],
      sourceType: 'manual' as const,
      createdBy: new Types.ObjectId(dto.ownerId),
    };

    return this.connection.transaction(async (session) => {
      const created = await this.adminRepository.createDeck(input, session);
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'deck.created',
          targetType: 'deck',
          targetId: this.getRecordId(created),
          metadata: {
            ownerId: dto.ownerId,
            visibility: input.visibility,
          },
        },
        session,
      );
      return created;
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

  async updateDeck(deckId: string, dto: UpdateAdminDeckDto, adminId: string) {
    const current = await this.requireDeck(deckId);
    if (dto.ownerId) {
      const owner = await this.requireUser(dto.ownerId);
      if (owner.isDeleted) {
        throw new BadRequestException('Owner is deleted');
      }
    }

    const $set = this.buildAdminDeckUpdate(dto);
    const fields = Object.keys($set);
    if (!fields.length) {
      throw new BadRequestException('No deck fields to update');
    }

    return this.connection.transaction(async (session) => {
      const updated = await this.adminRepository.updateDeck(
        deckId,
        { $set },
        session,
      );
      await this.adminRepository.createAuditLog(
        {
          adminId,
          action: 'deck.updated',
          targetType: 'deck',
          targetId: deckId,
          metadata: {
            fields,
            from: this.pickDeckAuditFields(current, fields),
            to: this.pickDeckAuditFields(updated ?? $set, fields),
          },
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

  private buildAdminDeckUpdate(dto: UpdateAdminDeckDto) {
    const update: Record<string, unknown> = {};
    if (dto.title !== undefined) update.title = dto.title;
    if (dto.description !== undefined) update.description = dto.description;
    if (dto.visibility !== undefined) update.visibility = dto.visibility;
    if (dto.tags !== undefined) update.tags = dto.tags;
    if (dto.ownerId !== undefined) {
      update.createdBy = new Types.ObjectId(dto.ownerId);
    }
    return update;
  }

  private pickDeckAuditFields(deck: Record<string, unknown>, fields: string[]) {
    return fields.reduce<Record<string, unknown>>((picked, field) => {
      const value = deck[field];
      picked[field] =
        value instanceof Types.ObjectId ? value.toString() : value;
      return picked;
    }, {});
  }

  private getRecordId(record: Record<string, unknown>) {
    const id = record._id ?? record.id;
    return id instanceof Types.ObjectId ? id.toString() : String(id);
  }
}
