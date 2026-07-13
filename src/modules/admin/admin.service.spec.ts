import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ClientSession, Connection, Types } from 'mongoose';
import { RoleType } from '../../common/enums/role-type.enum';
import {
  AdminDeckRecord,
  AdminRepository,
  AdminUserRecord,
} from './admin.repository';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const adminId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const deckId = '507f1f77bcf86cd799439013';
  const mongoSession = { id: 'session' } as unknown as ClientSession;
  let repository: RepositoryMock;
  let transactionMock: jest.Mock<
    Promise<unknown>,
    [
      (
        callback: (session: ClientSession) => Promise<unknown>,
      ) => Promise<unknown>,
    ]
  >;
  let service: AdminService;

  beforeEach(() => {
    repository = {
      findUserById: jest.fn<Promise<AdminUserRecord | null>, [string]>(),
      updateUser: jest.fn<
        Promise<AdminUserRecord | null>,
        [string, Record<string, unknown>, ClientSession]
      >(),
      findDeckById: jest.fn<Promise<AdminDeckRecord | null>, [string]>(),
      updateDeck: jest.fn<
        Promise<AdminDeckRecord | null>,
        [string, Record<string, unknown>, ClientSession]
      >(),
      createDeck: jest.fn<
        Promise<AdminDeckRecord>,
        [
          {
            title: string;
            description?: string;
            visibility: 'private' | 'link' | 'public';
            tags: string[];
            sourceType: 'manual';
            createdBy: Types.ObjectId;
          },
          ClientSession,
        ]
      >(),
      createAuditLog: jest.fn<
        Promise<unknown>,
        [
          {
            adminId: string;
            action: string;
            targetType: 'user' | 'deck';
            targetId: string;
            metadata?: Record<string, unknown>;
          },
          ClientSession,
        ]
      >(),
      getDashboardSummary: jest.fn<Promise<unknown>, [Date, Date]>(),
    };
    transactionMock = jest.fn((callback) => callback(mongoSession));
    service = new AdminService(
      repository as unknown as AdminRepository,
      { transaction: transactionMock } as unknown as Connection,
    );
  });

  it('prevents an admin from removing their own admin role', async () => {
    await expect(
      service.updateUserRole(adminId, { role: RoleType.STUDENT }, adminId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('prevents an admin from suspending their own account', async () => {
    await expect(
      service.updateUserStatus(adminId, { status: 'suspended' }, adminId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('prevents an admin from deleting their own account', async () => {
    await expect(service.deleteUser(adminId, adminId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('suspends, revokes tokens, and audits in one transaction', async () => {
    repository.findUserById.mockResolvedValue({
      _id: userId,
      status: 'active',
    });
    repository.updateUser.mockResolvedValue({
      _id: userId,
      status: 'suspended',
      tokenVersion: 3,
    });

    const result = await service.updateUserStatus(
      userId,
      { status: 'suspended', reason: 'Policy violation' },
      adminId,
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(repository.updateUser).toHaveBeenCalledWith(
      userId,
      expect.any(Object),
      mongoSession,
    );
    const update = repository.updateUser.mock.calls[0][1];
    expect(update).toMatchObject({
      $set: { status: 'suspended' },
      $inc: { tokenVersion: 1 },
    });
    expect(repository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId,
        action: 'user.status_updated',
        targetId: userId,
      }),
      mongoSession,
    );
    expect(result).toEqual(expect.objectContaining({ status: 'suspended' }));
  });

  it('creates a deck for an owner and audits in one transaction', async () => {
    repository.findUserById.mockResolvedValue({
      _id: userId,
      status: 'active',
      isDeleted: false,
    });
    repository.createDeck.mockResolvedValue({
      _id: new Types.ObjectId(deckId),
      title: 'Admin deck',
      createdBy: new Types.ObjectId(userId),
    });

    const result = await service.createDeck(
      {
        title: 'Admin deck',
        visibility: 'public',
        tags: ['math'],
        ownerId: userId,
      },
      adminId,
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(repository.createDeck).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Admin deck',
        visibility: 'public',
        tags: ['math'],
        sourceType: 'manual',
        createdBy: expect.any(Types.ObjectId) as Types.ObjectId,
      }),
      mongoSession,
    );
    expect(repository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId,
        action: 'deck.created',
        targetType: 'deck',
        targetId: deckId,
      }),
      mongoSession,
    );
    expect(result).toEqual(expect.objectContaining({ title: 'Admin deck' }));
  });

  it('updates deck metadata and audits changed fields in one transaction', async () => {
    repository.findDeckById.mockResolvedValue({
      _id: deckId,
      title: 'Old title',
      visibility: 'private',
    });
    repository.updateDeck.mockResolvedValue({
      _id: deckId,
      title: 'New title',
      visibility: 'public',
    });

    const result = await service.updateDeck(
      deckId,
      { title: 'New title', visibility: 'public' },
      adminId,
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(repository.updateDeck).toHaveBeenCalledWith(
      deckId,
      {
        $set: {
          title: 'New title',
          visibility: 'public',
        },
      },
      mongoSession,
    );
    expect(repository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId,
        action: 'deck.updated',
        targetType: 'deck',
        targetId: deckId,
        metadata: expect.objectContaining({
          fields: ['title', 'visibility'],
        }) as Record<string, unknown>,
      }),
      mongoSession,
    );
    expect(result).toEqual(expect.objectContaining({ title: 'New title' }));
  });

  it('moderates a deck, clears stale reason, and audits in one transaction', async () => {
    repository.findDeckById.mockResolvedValue({
      _id: deckId,
      moderationStatus: 'hidden',
      moderationReason: 'Old reason',
    });
    repository.updateDeck.mockResolvedValue({
      _id: deckId,
      moderationStatus: 'active',
    });

    const result = await service.moderateDeck(
      deckId,
      { status: 'active' },
      adminId,
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(repository.updateDeck).toHaveBeenCalledWith(
      deckId,
      expect.any(Object),
      mongoSession,
    );
    const update = repository.updateDeck.mock.calls[0][1];
    expect(update).toMatchObject({
      $set: {
        moderationStatus: 'active',
        moderatedAt: expect.any(Date) as Date,
        moderatedBy: expect.any(Types.ObjectId) as Types.ObjectId,
      },
      $unset: { moderationReason: 1 },
    });
    expect(repository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId,
        action: 'deck.moderated',
        targetType: 'deck',
        targetId: deckId,
      }),
      mongoSession,
    );
    expect(result).toEqual(
      expect.objectContaining({ moderationStatus: 'active' }),
    );
  });

  it('rejects analytics ranges longer than 365 days', () => {
    expect(() =>
      service.getDashboardSummary({
        from: '2024-01-01T00:00:00.000Z',
        to: '2025-01-02T00:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
    expect(repository.getDashboardSummary).not.toHaveBeenCalled();
  });
});

type RepositoryMock = {
  findUserById: jest.Mock<Promise<AdminUserRecord | null>, [string]>;
  updateUser: jest.Mock<
    Promise<AdminUserRecord | null>,
    [string, Record<string, unknown>, ClientSession]
  >;
  findDeckById: jest.Mock<Promise<AdminDeckRecord | null>, [string]>;
  updateDeck: jest.Mock<
    Promise<AdminDeckRecord | null>,
    [string, Record<string, unknown>, ClientSession]
  >;
  createDeck: jest.Mock<
    Promise<AdminDeckRecord>,
    [
      {
        title: string;
        description?: string;
        visibility: 'private' | 'link' | 'public';
        tags: string[];
        sourceType: 'manual';
        createdBy: Types.ObjectId;
      },
      ClientSession,
    ]
  >;
  createAuditLog: jest.Mock<
    Promise<unknown>,
    [
      {
        adminId: string;
        action: string;
        targetType: 'user' | 'deck';
        targetId: string;
        metadata?: Record<string, unknown>;
      },
      ClientSession,
    ]
  >;
  getDashboardSummary: jest.Mock<Promise<unknown>, [Date, Date]>;
};
