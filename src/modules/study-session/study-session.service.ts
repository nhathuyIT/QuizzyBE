import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CardProgressService } from '../card-progress/card-progress.service';
import { DeckDocument } from '../deck/schemas/deck.schema';
import { CreateStudySessionDto } from './dto/create-study-session.dto';
import { LogCardReviewDto } from './dto/log-card-review.dto';
import { StudySessionRepository } from './study-session.repository';

@Injectable()
export class StudySessionService {
  constructor(
    private readonly studySessionRepository: StudySessionRepository,
    private readonly cardProgressService: CardProgressService,
  ) {}

  async createSession(
    createStudySessionDto: CreateStudySessionDto,
    userId: string,
  ) {
    const deck = await this.studySessionRepository.findDeckById(
      createStudySessionDto.deckId,
    );
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    if (!this.canAccessDeck(deck, userId)) {
      throw new ForbiddenException(
        'You do not have permission to study this deck',
      );
    }

    return this.studySessionRepository.createSession(
      createStudySessionDto,
      userId,
    );
  }

  async findSessions(userId: string) {
    return this.studySessionRepository.findSessionsByUser(userId);
  }

  async findSession(sessionId: string, userId: string) {
    return this.getOwnedSession(sessionId, userId);
  }

  async logReview(logCardReviewDto: LogCardReviewDto, userId: string) {
    const session = await this.getOwnedSession(
      logCardReviewDto.sessionId,
      userId,
    );
    const card = await this.studySessionRepository.findCardById(
      logCardReviewDto.cardId,
    );

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    if (!this.objectIdEquals(card.deckId, session.deckId)) {
      throw new ForbiddenException('Card does not belong to this session deck');
    }

    const review = await this.studySessionRepository.createReview(
      logCardReviewDto,
      userId,
    );

    await this.cardProgressService.applyReviewProgress({
      userId,
      deckId: session.deckId.toString(),
      cardId: logCardReviewDto.cardId,
      isCorrect: logCardReviewDto.isCorrect,
      rating: logCardReviewDto.rating,
    });
    await this.studySessionRepository.updateSessionStats(
      logCardReviewDto.sessionId,
      logCardReviewDto.isCorrect,
    );

    return review;
  }

  async finishSession(sessionId: string, userId: string) {
    const session = await this.getOwnedSession(sessionId, userId);
    const startedAt = session.startedAt ?? new Date();
    const timeSpentSec = Math.max(
      0,
      Math.floor((Date.now() - startedAt.getTime()) / 1000),
    );
    const finishedSession = await this.studySessionRepository.finishSession(
      sessionId,
      timeSpentSec,
    );

    if (!finishedSession) {
      throw new NotFoundException('Study session not found');
    }

    return finishedSession;
  }

  private async getOwnedSession(sessionId: string, userId: string) {
    const session =
      await this.studySessionRepository.findSessionById(sessionId);

    if (!session) {
      throw new NotFoundException('Study session not found');
    }

    if (!this.objectIdEquals(session.userId, userId)) {
      throw new ForbiddenException('You do not own this study session');
    }

    return session;
  }

  private canAccessDeck(deck: DeckDocument, userId: string) {
    return (
      deck.visibility !== 'private' ||
      this.objectIdEquals(deck.createdBy, userId)
    );
  }

  private objectIdEquals(
    left: Types.ObjectId | string,
    right: Types.ObjectId | string,
  ) {
    return left?.toString() === right?.toString();
  }
}
