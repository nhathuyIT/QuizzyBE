import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, PipelineStage, Types } from 'mongoose';
import {
  AdminAuditLog,
  AdminAuditLogDocument,
} from './schemas/admin-audit-log.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { Deck, DeckDocument } from '../deck/schemas/deck.schema';
import { Card, CardDocument } from '../card/schemas/card.schema';
import {
  StudySession,
  StudySessionDocument,
} from '../study/schemas/study-session.schema';
import {
  CardReview,
  CardReviewDocument,
} from '../study/schemas/card-review.schema';
import {
  AcademicDocument,
  AcademicDocumentDoc,
} from '../academic/schemas/academic-document.schema';
import {
  Department,
  DepartmentDocument,
} from '../academic/schemas/department.schema';
import { Subject, SubjectDocument } from '../academic/schemas/subject.schema';

type PageResult<T> = { data: T[]; itemCount: number };
export type AdminAuditTargetType =
  | 'user'
  | 'deck'
  | 'academic_department'
  | 'academic_subject'
  | 'academic_document';
export type AdminUserRecord = Record<string, unknown> & {
  role?: 'student' | 'teacher' | 'admin';
  status?: 'active' | 'suspended';
  isDeleted?: boolean;
};
export type AdminDeckRecord = Record<string, unknown> & {
  moderationStatus?: 'active' | 'hidden';
  deletedAt?: Date;
};
export type AdminAcademicDepartmentRecord = Record<string, unknown> & {
  isActive?: boolean;
};
export type AdminAcademicSubjectRecord = Record<string, unknown> & {
  departmentId?: Types.ObjectId;
  isActive?: boolean;
};
export type AdminAcademicDocumentRecord = Record<string, unknown> & {
  status?: 'pending' | 'active' | 'rejected' | 'archived';
  subjectId?: Types.ObjectId;
};
type AdminResultRecord = Record<string, unknown>;
type CountRow = { count: number };
type DashboardReviewRow = {
  reviews: number;
  correct: number;
  activeUsers: Types.ObjectId[];
};
type DashboardSessionRow = {
  sessions: number;
  completed: number;
  totalDurationMs: number;
};
type ActivityUserRow = { _id: Date; newUsers: number };
type ActivitySessionRow = { _id: Date; sessions: number };
type ActivityReviewRow = {
  _id: Date;
  reviews: number;
  correct: number;
  activeUsers: Types.ObjectId[];
};
type ActivityBucket = {
  period: Date;
  newUsers: number;
  activeUsers: number;
  sessions: number;
  reviews: number;
  accuracy: number;
};
type CountMetricRow = { count: number };
type DurationMetricRow = { count: number; totalDurationMs: number };
type CorrectMetricRow = { count: number; correct: number };
type DeckSessionMetricRow = {
  sessions: number;
  learners: Types.ObjectId[];
  completed: number;
};
type DeckReviewMetricRow = { reviews: number; correct: number };
type StudySummarySessionRow = {
  sessions: number;
  users: Types.ObjectId[];
  completed: number;
  totalDurationMs: number;
};
type StudySummaryReviewRow = { reviews: number; correct: number };

@Injectable()
export class AdminRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Deck.name) private readonly deckModel: Model<DeckDocument>,
    @InjectModel(Card.name) private readonly cardModel: Model<CardDocument>,
    @InjectModel(StudySession.name)
    private readonly studySessionModel: Model<StudySessionDocument>,
    @InjectModel(CardReview.name)
    private readonly cardReviewModel: Model<CardReviewDocument>,
    @InjectModel(AdminAuditLog.name)
    private readonly auditLogModel: Model<AdminAuditLogDocument>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel(Subject.name)
    private readonly subjectModel: Model<SubjectDocument>,
    @InjectModel(AcademicDocument.name)
    private readonly academicDocumentModel: Model<AcademicDocumentDoc>,
  ) {}

  async getDashboardSummary(from: Date, to: Date) {
    const reviewMatch = { createdAt: { $gte: from, $lte: to } };
    const sessionMatch = { startedAt: { $gte: from, $lte: to } };
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalDecks,
      totalCards,
      totalSessions,
      totalReviews,
      newUsers,
      reviewStats,
      sessionStats,
      dau,
      wau,
      mau,
    ] = await Promise.all([
      this.userModel.countDocuments({ isDeleted: { $ne: true } }),
      this.deckModel.countDocuments({ deletedAt: { $exists: false } }),
      this.cardModel.countDocuments(),
      this.studySessionModel.countDocuments(),
      this.cardReviewModel.countDocuments(),
      this.userModel.countDocuments({
        createdAt: { $gte: from, $lte: to },
        isDeleted: { $ne: true },
      }),
      this.cardReviewModel.aggregate<DashboardReviewRow>([
        { $match: reviewMatch },
        {
          $group: {
            _id: null,
            reviews: { $sum: 1 },
            correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
            activeUsers: { $addToSet: '$userId' },
          },
        },
      ]),
      this.studySessionModel.aggregate<DashboardSessionRow>([
        { $match: sessionMatch },
        {
          $group: {
            _id: null,
            sessions: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $ne: ['$finishedAt', null] }, 1, 0] },
            },
            totalDurationMs: {
              $sum: {
                $cond: [
                  { $ne: ['$finishedAt', null] },
                  { $subtract: ['$finishedAt', '$startedAt'] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      this.countActiveUsers(dayAgo, now),
      this.countActiveUsers(weekAgo, now),
      this.countActiveUsers(monthAgo, now),
    ]);

    const review: DashboardReviewRow = reviewStats[0] ?? {
      reviews: 0,
      correct: 0,
      activeUsers: [],
    };
    const session: DashboardSessionRow = sessionStats[0] ?? {
      sessions: 0,
      completed: 0,
      totalDurationMs: 0,
    };

    return {
      totals: {
        users: totalUsers,
        decks: totalDecks,
        cards: totalCards,
        sessions: totalSessions,
        reviews: totalReviews,
      },
      range: {
        from,
        to,
        newUsers,
        activeUsers: review.activeUsers.length,
        reviews: review.reviews,
        sessions: session.sessions,
      },
      dau,
      wau,
      mau,
      accuracy: review.reviews
        ? Math.round((review.correct / review.reviews) * 10000) / 100
        : 0,
      sessionCompletionRate: session.sessions
        ? Math.round((session.completed / session.sessions) * 10000) / 100
        : 0,
      averageStudyTimeSeconds: session.completed
        ? Math.round(session.totalDurationMs / session.completed / 1000)
        : 0,
    };
  }

  async getActivity(from: Date, to: Date, interval: 'day' | 'week') {
    const unit = interval === 'week' ? 'week' : 'day';
    const groupBy = {
      $dateTrunc: { date: '$createdAt', unit, timezone: 'UTC' },
    };
    const sessionGroupBy = {
      $dateTrunc: { date: '$startedAt', unit, timezone: 'UTC' },
    };

    const [users, reviews, sessions] = await Promise.all([
      this.userModel.aggregate<ActivityUserRow>([
        {
          $match: {
            createdAt: { $gte: from, $lte: to },
            isDeleted: { $ne: true },
          },
        },
        { $group: { _id: groupBy, newUsers: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      this.cardReviewModel.aggregate<ActivityReviewRow>([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: groupBy,
            reviews: { $sum: 1 },
            correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
            activeUsers: { $addToSet: '$userId' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.studySessionModel.aggregate<ActivitySessionRow>([
        { $match: { startedAt: { $gte: from, $lte: to } } },
        { $group: { _id: sessionGroupBy, sessions: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const buckets = new Map<string, ActivityBucket>();
    const getBucket = (date: Date) => {
      const key = date.toISOString();
      const current = buckets.get(key) ?? {
        period: date,
        newUsers: 0,
        activeUsers: 0,
        sessions: 0,
        reviews: 0,
        accuracy: 0,
      };
      buckets.set(key, current);
      return current;
    };

    users.forEach((row) => {
      getBucket(row._id).newUsers = row.newUsers;
    });
    sessions.forEach((row) => {
      getBucket(row._id).sessions = row.sessions;
    });
    reviews.forEach((row) => {
      const bucket = getBucket(row._id);
      bucket.reviews = row.reviews;
      bucket.activeUsers = row.activeUsers.length;
      bucket.accuracy = row.reviews
        ? Math.round((row.correct / row.reviews) * 10000) / 100
        : 0;
    });

    return [...buckets.values()].sort(
      (a, b) => a.period.getTime() - b.period.getTime(),
    );
  }

  async findUsers(
    filter: Record<string, unknown>,
    page: number,
    take: number,
  ): Promise<PageResult<unknown>> {
    const [data, itemCount] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);
    return { data, itemCount };
  }

  findUserById(userId: string): Promise<AdminUserRecord | null> {
    return this.userModel
      .findById(userId)
      .select('-passwordHash')
      .lean<AdminUserRecord>()
      .exec();
  }

  async getUserMetrics(userId: string) {
    const id = new Types.ObjectId(userId);
    const [deckCount, cardStats, sessionStats, reviewStats, recentActivity] =
      await Promise.all([
        this.deckModel.countDocuments({ createdBy: id }),
        this.deckModel.aggregate<CountMetricRow>([
          { $match: { createdBy: id } },
          {
            $lookup: {
              from: 'cards',
              localField: '_id',
              foreignField: 'deckId',
              as: 'cards',
            },
          },
          { $group: { _id: null, count: { $sum: { $size: '$cards' } } } },
        ]),
        this.studySessionModel.aggregate<DurationMetricRow>([
          { $match: { userId: id } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalDurationMs: {
                $sum: {
                  $cond: [
                    { $ne: ['$finishedAt', null] },
                    { $subtract: ['$finishedAt', '$startedAt'] },
                    0,
                  ],
                },
              },
            },
          },
        ]),
        this.cardReviewModel.aggregate<CorrectMetricRow>([
          { $match: { userId: id } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
            },
          },
        ]),
        this.cardReviewModel
          .find({ userId: id })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
      ]);

    const sessions: DurationMetricRow = sessionStats[0] ?? {
      count: 0,
      totalDurationMs: 0,
    };
    const reviews: CorrectMetricRow = reviewStats[0] ?? {
      count: 0,
      correct: 0,
    };
    return {
      deckCount,
      cardCount: cardStats[0]?.count ?? 0,
      sessionCount: sessions.count,
      reviewCount: reviews.count,
      accuracy: reviews.count
        ? Math.round((reviews.correct / reviews.count) * 10000) / 100
        : 0,
      totalStudyTimeSeconds: Math.round(sessions.totalDurationMs / 1000),
      recentActivity,
    };
  }

  updateUser(
    userId: string,
    update: Record<string, unknown>,
    session: ClientSession,
  ): Promise<AdminUserRecord | null> {
    return this.userModel
      .findByIdAndUpdate(userId, update, { new: true, session })
      .select('-passwordHash')
      .lean<AdminUserRecord>()
      .exec();
  }

  async createDeck(
    data: Record<string, unknown>,
    session: ClientSession,
  ): Promise<AdminDeckRecord> {
    const [deck] = await this.deckModel.create([data], { session });
    return deck.toObject() as unknown as AdminDeckRecord;
  }

  async findDecks(
    filter: Record<string, unknown>,
    page: number,
    take: number,
  ): Promise<PageResult<unknown>> {
    const [data, itemCount] = await Promise.all([
      this.deckModel.aggregate<AdminResultRecord>([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * take },
        { $limit: take },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'owner',
          },
        },
        { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            'owner.passwordHash': 0,
            'owner.preferences': 0,
          },
        },
      ]),
      this.deckModel.countDocuments(filter),
    ]);
    return { data, itemCount };
  }

  async findDeckById(deckId: string): Promise<AdminDeckRecord | null> {
    const rows = await this.deckModel.aggregate<AdminDeckRecord>([
      { $match: { _id: new Types.ObjectId(deckId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'owner',
        },
      },
      { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },
      { $project: { 'owner.passwordHash': 0, 'owner.preferences': 0 } },
    ]);
    return rows[0] ?? null;
  }

  async getDeckMetrics(deckId: string) {
    const id = new Types.ObjectId(deckId);
    const [sessionStats, reviewStats] = await Promise.all([
      this.studySessionModel.aggregate<DeckSessionMetricRow>([
        { $match: { deckId: id } },
        {
          $group: {
            _id: null,
            sessions: { $sum: 1 },
            learners: { $addToSet: '$userId' },
            completed: {
              $sum: { $cond: [{ $ne: ['$finishedAt', null] }, 1, 0] },
            },
          },
        },
      ]),
      this.studySessionModel.aggregate<DeckReviewMetricRow>([
        { $match: { deckId: id } },
        {
          $lookup: {
            from: 'card_reviews',
            localField: '_id',
            foreignField: 'sessionId',
            as: 'reviews',
          },
        },
        { $unwind: '$reviews' },
        {
          $group: {
            _id: null,
            reviews: { $sum: 1 },
            correct: { $sum: { $cond: ['$reviews.isCorrect', 1, 0] } },
          },
        },
      ]),
    ]);
    const sessions: DeckSessionMetricRow = sessionStats[0] ?? {
      sessions: 0,
      learners: [],
      completed: 0,
    };
    const reviews: DeckReviewMetricRow = reviewStats[0] ?? {
      reviews: 0,
      correct: 0,
    };
    return {
      sessionCount: sessions.sessions,
      learnerCount: sessions.learners.length,
      completionRate: sessions.sessions
        ? Math.round((sessions.completed / sessions.sessions) * 10000) / 100
        : 0,
      reviewCount: reviews.reviews,
      accuracy: reviews.reviews
        ? Math.round((reviews.correct / reviews.reviews) * 10000) / 100
        : 0,
    };
  }

  async findDeckCards(deckId: string, page: number, take: number) {
    const filter = { deckId: new Types.ObjectId(deckId) };
    const [data, itemCount] = await Promise.all([
      this.cardModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .lean(),
      this.cardModel.countDocuments(filter),
    ]);
    return { data, itemCount };
  }

  updateDeck(
    deckId: string,
    update: Record<string, unknown>,
    session: ClientSession,
  ): Promise<AdminDeckRecord | null> {
    return this.deckModel
      .findByIdAndUpdate(deckId, update, { new: true, session })
      .lean<AdminDeckRecord>()
      .exec();
  }

  async findStudySessions(
    filter: Record<string, unknown>,
    page: number,
    take: number,
  ): Promise<PageResult<unknown>> {
    const [data, itemCount] = await Promise.all([
      this.studySessionModel.aggregate<AdminResultRecord>([
        { $match: filter },
        { $sort: { startedAt: -1 } },
        { $skip: (page - 1) * take },
        { $limit: take },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'decks',
            localField: 'deckId',
            foreignField: '_id',
            as: 'deck',
          },
        },
        { $unwind: { path: '$deck', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            'user.passwordHash': 0,
            'user.preferences': 0,
          },
        },
      ]),
      this.studySessionModel.countDocuments(filter),
    ]);
    return { data, itemCount };
  }

  async findStudySessionById(
    sessionId: string,
  ): Promise<AdminResultRecord | null> {
    const rows = await this.studySessionModel.aggregate<AdminResultRecord>([
      { $match: { _id: new Types.ObjectId(sessionId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'decks',
          localField: 'deckId',
          foreignField: '_id',
          as: 'deck',
        },
      },
      { $unwind: { path: '$deck', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'card_reviews',
          localField: '_id',
          foreignField: 'sessionId',
          as: 'reviews',
        },
      },
      {
        $addFields: {
          reviewCount: { $size: '$reviews' },
          correctReviewCount: {
            $size: {
              $filter: {
                input: '$reviews',
                as: 'review',
                cond: '$$review.isCorrect',
              },
            },
          },
        },
      },
      {
        $project: {
          reviews: 0,
          'user.passwordHash': 0,
          'user.preferences': 0,
        },
      },
    ]);
    return rows[0] ?? null;
  }

  async findSessionReviews(sessionId: string, page: number, take: number) {
    const filter = { sessionId: new Types.ObjectId(sessionId) };
    const [data, itemCount] = await Promise.all([
      this.cardReviewModel.aggregate<AdminResultRecord>([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * take },
        { $limit: take },
        {
          $lookup: {
            from: 'cards',
            localField: 'cardId',
            foreignField: '_id',
            as: 'card',
          },
        },
        { $unwind: { path: '$card', preserveNullAndEmptyArrays: true } },
      ]),
      this.cardReviewModel.countDocuments(filter),
    ]);
    return { data, itemCount };
  }

  async getStudySummary(from: Date, to: Date, mode?: string) {
    const match: Record<string, unknown> = {
      startedAt: { $gte: from, $lte: to },
    };
    if (mode) match.mode = mode;
    const [sessionStats, reviewStats] = await Promise.all([
      this.studySessionModel.aggregate<StudySummarySessionRow>([
        { $match: match },
        {
          $group: {
            _id: null,
            sessions: { $sum: 1 },
            users: { $addToSet: '$userId' },
            completed: {
              $sum: { $cond: [{ $ne: ['$finishedAt', null] }, 1, 0] },
            },
            totalDurationMs: {
              $sum: {
                $cond: [
                  { $ne: ['$finishedAt', null] },
                  { $subtract: ['$finishedAt', '$startedAt'] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      this.studySessionModel.aggregate<StudySummaryReviewRow>([
        { $match: match },
        {
          $lookup: {
            from: 'card_reviews',
            localField: '_id',
            foreignField: 'sessionId',
            as: 'reviews',
          },
        },
        { $unwind: '$reviews' },
        {
          $group: {
            _id: null,
            reviews: { $sum: 1 },
            correct: { $sum: { $cond: ['$reviews.isCorrect', 1, 0] } },
          },
        },
      ]),
    ]);
    const sessions: StudySummarySessionRow = sessionStats[0] ?? {
      sessions: 0,
      users: [],
      completed: 0,
      totalDurationMs: 0,
    };
    const reviews: StudySummaryReviewRow = reviewStats[0] ?? {
      reviews: 0,
      correct: 0,
    };
    return {
      from,
      to,
      mode: mode ?? 'all',
      sessions: sessions.sessions,
      activeUsers: sessions.users.length,
      reviews: reviews.reviews,
      accuracy: reviews.reviews
        ? Math.round((reviews.correct / reviews.reviews) * 10000) / 100
        : 0,
      completionRate: sessions.sessions
        ? Math.round((sessions.completed / sessions.sessions) * 10000) / 100
        : 0,
      averageStudyTimeSeconds: sessions.completed
        ? Math.round(sessions.totalDurationMs / sessions.completed / 1000)
        : 0,
    };
  }

  async findAcademicDepartments(
    filter: Record<string, unknown>,
    page: number,
    take: number,
  ): Promise<PageResult<unknown>> {
    const [data, itemCount] = await Promise.all([
      this.departmentModel
        .find(filter)
        .sort({ code: 1 })
        .skip((page - 1) * take)
        .limit(take)
        .lean(),
      this.departmentModel.countDocuments(filter),
    ]);
    return { data, itemCount };
  }

  findAcademicDepartmentById(
    departmentId: string,
  ): Promise<AdminAcademicDepartmentRecord | null> {
    return this.departmentModel
      .findById(departmentId)
      .lean<AdminAcademicDepartmentRecord>()
      .exec();
  }

  async createAcademicDepartment(
    input: Record<string, unknown>,
    session: ClientSession,
  ): Promise<AdminAcademicDepartmentRecord> {
    const [department] = await this.departmentModel.create([input], {
      session,
    });
    return department.toObject() as unknown as AdminAcademicDepartmentRecord;
  }

  updateAcademicDepartment(
    departmentId: string,
    update: Record<string, unknown>,
    session: ClientSession,
  ): Promise<AdminAcademicDepartmentRecord | null> {
    return this.departmentModel
      .findByIdAndUpdate(departmentId, update, { new: true, session })
      .lean<AdminAcademicDepartmentRecord>()
      .exec();
  }

  async findAcademicSubjects(
    filter: Record<string, unknown>,
    page: number,
    take: number,
  ): Promise<PageResult<unknown>> {
    const [data, itemCount] = await Promise.all([
      this.subjectModel.aggregate<AdminResultRecord>([
        { $match: filter },
        { $sort: { semester: 1, code: 1 } },
        { $skip: (page - 1) * take },
        { $limit: take },
        {
          $lookup: {
            from: 'departments',
            localField: 'departmentId',
            foreignField: '_id',
            as: 'department',
          },
        },
        { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      ]),
      this.subjectModel.countDocuments(filter),
    ]);
    return { data, itemCount };
  }

  findAcademicSubjectById(
    subjectId: string,
  ): Promise<AdminAcademicSubjectRecord | null> {
    return this.subjectModel
      .findById(subjectId)
      .lean<AdminAcademicSubjectRecord>()
      .exec();
  }

  async createAcademicSubject(
    input: Record<string, unknown>,
    session: ClientSession,
  ): Promise<AdminAcademicSubjectRecord> {
    const [subject] = await this.subjectModel.create([input], {
      session,
    });
    return subject.toObject() as unknown as AdminAcademicSubjectRecord;
  }

  updateAcademicSubject(
    subjectId: string,
    update: Record<string, unknown>,
    session: ClientSession,
  ): Promise<AdminAcademicSubjectRecord | null> {
    return this.subjectModel
      .findByIdAndUpdate(subjectId, update, { new: true, session })
      .lean<AdminAcademicSubjectRecord>()
      .exec();
  }

  async incrementAcademicSubjectDocumentCount(
    subjectId: string,
    amount: number,
    session: ClientSession,
  ): Promise<void> {
    await this.subjectModel
      .updateOne(
        { _id: new Types.ObjectId(subjectId) },
        { $inc: { documentCount: amount } },
        { session },
      )
      .exec();
  }

  async findAcademicDocuments(
    filter: Record<string, unknown>,
    page: number,
    take: number,
    departmentId?: string,
  ): Promise<PageResult<unknown>> {
    const basePipeline = this.buildAcademicDocumentPipeline(
      filter,
      departmentId,
    );
    const [data, countRows] = await Promise.all([
      this.academicDocumentModel.aggregate<AdminResultRecord>([
        ...basePipeline,
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * take },
        { $limit: take },
        ...this.academicDocumentOwnerLookupStages(),
      ]),
      this.academicDocumentModel.aggregate<CountRow>([
        ...basePipeline,
        { $count: 'count' },
      ]),
    ]);
    return { data, itemCount: countRows[0]?.count ?? 0 };
  }

  async findAcademicDocumentById(
    documentId: string,
  ): Promise<AdminAcademicDocumentRecord | null> {
    const rows =
      await this.academicDocumentModel.aggregate<AdminAcademicDocumentRecord>([
        { $match: { _id: new Types.ObjectId(documentId) } },
        ...this.academicDocumentLookupStages(),
        ...this.academicDocumentOwnerLookupStages(),
      ]);
    return rows[0] ?? null;
  }

  updateAcademicDocument(
    documentId: string,
    update: Record<string, unknown>,
    session: ClientSession,
  ): Promise<AdminAcademicDocumentRecord | null> {
    return this.academicDocumentModel
      .findByIdAndUpdate(documentId, update, { new: true, session })
      .lean<AdminAcademicDocumentRecord>()
      .exec();
  }

  async findAuditLogs(
    filter: Record<string, unknown>,
    page: number,
    take: number,
  ): Promise<PageResult<unknown>> {
    const [data, itemCount] = await Promise.all([
      this.auditLogModel.aggregate<AdminResultRecord>([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * take },
        { $limit: take },
        {
          $lookup: {
            from: 'users',
            localField: 'adminId',
            foreignField: '_id',
            as: 'admin',
          },
        },
        { $unwind: { path: '$admin', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            'admin.passwordHash': 0,
            'admin.preferences': 0,
          },
        },
      ]),
      this.auditLogModel.countDocuments(filter),
    ]);
    return { data, itemCount };
  }

  async createAuditLog(
    input: {
      adminId: string;
      action: string;
      targetType: AdminAuditTargetType;
      targetId: string;
      metadata?: Record<string, unknown>;
    },
    session: ClientSession,
  ) {
    const [log] = await this.auditLogModel.create(
      [
        {
          ...input,
          adminId: new Types.ObjectId(input.adminId),
          targetId: new Types.ObjectId(input.targetId),
        },
      ],
      { session },
    );
    return log;
  }

  private buildAcademicDocumentPipeline(
    filter: Record<string, unknown>,
    departmentId?: string,
  ): PipelineStage[] {
    const pipeline: PipelineStage[] = [{ $match: filter }];

    if (departmentId) {
      pipeline.push(...this.academicDocumentLookupStages());
      pipeline.push({
        $match: {
          'subject.departmentId': new Types.ObjectId(departmentId),
        },
      });
      return pipeline;
    }

    pipeline.push(...this.academicDocumentLookupStages());
    return pipeline;
  }

  private academicDocumentLookupStages(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'subjects',
          localField: 'subjectId',
          foreignField: '_id',
          as: 'subject',
        },
      },
      { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'departments',
          localField: 'subject.departmentId',
          foreignField: '_id',
          as: 'department',
        },
      },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
    ];
  }

  private academicDocumentOwnerLookupStages(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'users',
          localField: 'uploadedBy',
          foreignField: '_id',
          as: 'uploader',
        },
      },
      { $unwind: { path: '$uploader', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'reviewedBy',
          foreignField: '_id',
          as: 'reviewer',
        },
      },
      { $unwind: { path: '$reviewer', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          'uploader.passwordHash': 0,
          'uploader.preferences': 0,
          'reviewer.passwordHash': 0,
          'reviewer.preferences': 0,
        },
      },
    ];
  }

  private async countActiveUsers(from: Date, to: Date) {
    const rows = await this.cardReviewModel.aggregate<CountRow>([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$userId' } },
      { $count: 'count' },
    ]);
    return rows[0]?.count ?? 0;
  }
}
