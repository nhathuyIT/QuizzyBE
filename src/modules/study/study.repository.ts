import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateStudySessionDto } from './dto/create-study-session.dto';
import { LogCardReviewDto } from './dto/log-card-review.dto';
import { CardReview, CardReviewDocument } from './schemas/card-review.schema';
import {
  StudySession,
  StudySessionDocument,
} from './schemas/study-session.schema';

@Injectable()
export class StudyRepository {
  constructor(
    @InjectModel(StudySession.name)
    private readonly studySessionModel: Model<StudySessionDocument>,
    @InjectModel(CardReview.name)
    private readonly cardReviewModel: Model<CardReviewDocument>,
  ) {}

  async createSession(
    createStudySessionDto: CreateStudySessionDto,
    userId: string,
  ): Promise<StudySessionDocument> {
    return this.studySessionModel.create({
      ...createStudySessionDto,
      userId: new Types.ObjectId(userId),
      deckId: new Types.ObjectId(createStudySessionDto.deckId),
    });
  }

  async findSessionById(id: string): Promise<StudySessionDocument | null> {
    return this.studySessionModel.findById(id).exec();
  }

  async finishSession(id: string): Promise<StudySessionDocument | null> {
    return this.studySessionModel
      .findByIdAndUpdate(id, { finishedAt: new Date() }, { new: true })
      .exec();
  }

  async logReview(
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
}
