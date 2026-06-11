import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Card, CardDocument } from '../card/schemas/card.schema';
import { Deck, DeckDocument } from '../deck/schemas/deck.schema';
import { CreateStudySessionDto } from './dto/create-study-session.dto';
import { LogCardReviewDto } from './dto/log-card-review.dto';
import {
  CardReviewDocument,
  CardReviewEntity,
} from './schemas/card-review.schema';
import {
  StudySessionDocument,
  StudySessionEntity,
} from './schemas/study-session.schema';

@Injectable()
export class StudySessionRepository {
  constructor(
    @InjectModel(StudySessionEntity.name)
    private readonly studySessionModel: Model<StudySessionDocument>,
    @InjectModel(CardReviewEntity.name)
    private readonly cardReviewModel: Model<CardReviewDocument>,
    @InjectModel(Deck.name)
    private readonly deckModel: Model<DeckDocument>,
    @InjectModel(Card.name)
    private readonly cardModel: Model<CardDocument>,
  ) {}

  async findDeckById(deckId: string): Promise<DeckDocument | null> {
    return this.deckModel.findById(deckId).exec();
  }

  async findCardById(cardId: string): Promise<CardDocument | null> {
    return this.cardModel.findById(cardId).exec();
  }

  async createSession(
    createStudySessionDto: CreateStudySessionDto,
    userId: string,
  ): Promise<StudySessionDocument> {
    return this.studySessionModel.create({
      userId: new Types.ObjectId(userId),
      deckId: new Types.ObjectId(createStudySessionDto.deckId),
      mode: createStudySessionDto.mode,
      startedAt: new Date(),
      stats: {
        correct: 0,
        wrong: 0,
        skipped: 0,
        timeSpentSec: 0,
      },
    });
  }

  async findSessionsByUser(userId: string): Promise<StudySessionDocument[]> {
    return this.studySessionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ startedAt: -1 })
      .exec();
  }

  async findSessionById(id: string): Promise<StudySessionDocument | null> {
    return this.studySessionModel.findById(id).exec();
  }

  async finishSession(
    id: string,
    timeSpentSec: number,
  ): Promise<StudySessionDocument | null> {
    return this.studySessionModel
      .findByIdAndUpdate(
        id,
        {
          finishedAt: new Date(),
          'stats.timeSpentSec': timeSpentSec,
        },
        { new: true },
      )
      .exec();
  }

  async createReview(
    logCardReviewDto: LogCardReviewDto,
    userId: string,
  ): Promise<CardReviewDocument> {
    return this.cardReviewModel.create({
      ...logCardReviewDto,
      userId: new Types.ObjectId(userId),
      sessionId: new Types.ObjectId(logCardReviewDto.sessionId),
      cardId: new Types.ObjectId(logCardReviewDto.cardId),
    });
  }

  async updateSessionStats(sessionId: string, isCorrect: boolean) {
    return this.studySessionModel
      .findByIdAndUpdate(
        sessionId,
        {
          $inc: {
            'stats.correct': isCorrect ? 1 : 0,
            'stats.wrong': isCorrect ? 0 : 1,
          },
        },
        { new: true },
      )
      .exec();
  }
}
