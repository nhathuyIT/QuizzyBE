import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ReviewRating } from '../../common/enums/review-ratings.enum';
import { CardProgressDocument } from '../card-progress/schemas/card-progress.schema';
import { CardProgressService } from '../card-progress/card-progress.service';
import { CardDocument } from '../card/schemas/card.schema';
import { DeckDocument } from '../deck/schemas/deck.schema';
import { CreateStudySessionDto } from './dto/create-study-session.dto';
import { LogCardReviewDto } from './dto/log-card-review.dto';
import { StudyRepository } from './study.repository';
import { StudyItemsBuilder } from './builders/study-item-builder';

@Injectable()
export class StudyService {
  constructor(
    private readonly studyRepository: StudyRepository,
    private readonly cardProgressService: CardProgressService,
    private readonly studyItemsBuilder: StudyItemsBuilder,
  ) {}

  async createSession(
    createStudySessionDto: CreateStudySessionDto,
    userId: string,
  ) {
    const deck = await this.studyRepository.findDeckById(
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

    return this.studyRepository.createSession(createStudySessionDto, userId);
  }

  async findSessions(userId: string) {
    return this.studyRepository.findSessionsByUser(userId);
  }

  async findSession(sessionId: string, userId: string) {
    return this.getOwnedSession(sessionId, userId);
  }

  async getSessionItems(sessionId: string, userId: string) {
    const session = await this.getOwnedSession(sessionId, userId);
    const deckId = session.deckId.toString();

    if (session.mode === 'learn') {
      const dueProgress = await this.cardProgressService.findDueCards(
        userId,
        deckId,
      );

      const dueCardIds = dueProgress.map((progress) =>
        progress.cardId.toString(),
      );

      const cards = dueCardIds.length
        ? await this.studyRepository.findCardsByIds(dueCardIds)
        : await this.studyRepository.findCardsByDeckId(deckId);

      return this.studyItemsBuilder.build(session.mode, cards);
    }

    const cards = await this.studyRepository.findCardsByDeckId(deckId);

    return this.studyItemsBuilder.build(session.mode, cards);
  }

  async logReview(logCardReviewDto: LogCardReviewDto, userId: string) {
    const session = await this.getOwnedSession(
      logCardReviewDto.sessionId,
      userId,
    );
    const card = await this.studyRepository.findCardById(
      logCardReviewDto.cardId,
    );

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    if (!this.objectIdEquals(card.deckId, session.deckId)) {
      throw new ForbiddenException('Card does not belong to this session deck');
    }

    if (session.finishedAt) {
      throw new BadRequestException('Study session is already finished');
    }

    const { isCorrect, rating } = this.resolveReviewResult(
      session.mode,
      logCardReviewDto,
      card,
    );
    const review = await this.studyRepository.createReview(
      logCardReviewDto,
      userId,
      isCorrect,
      rating,
    );
    const progress = await this.cardProgressService.applyReviewProgress({
      userId,
      deckId: session.deckId.toString(),
      cardId: logCardReviewDto.cardId,
      isCorrect,
      rating,
    });
    await this.studyRepository.updateSessionStats(
      logCardReviewDto.sessionId,
      isCorrect,
    );

    return {
      reviewId: this.getDocumentId(review),
      cardId: logCardReviewDto.cardId,
      isCorrect,
      correctAnswer: card.back,
      explanation: card.explanation,
      progressUpdate: this.toProgressUpdate(progress),
    };
  }

  async finishSession(sessionId: string, userId: string) {
    const session = await this.getOwnedSession(sessionId, userId);
    const startedAt = session.startedAt ?? new Date();
    const timeSpentSec = Math.max(
      0,
      Math.floor((Date.now() - startedAt.getTime()) / 1000),
    );
    const finishedSession = await this.studyRepository.finishSession(
      sessionId,
      timeSpentSec,
    );

    if (!finishedSession) {
      throw new NotFoundException('Study session not found');
    }

    return finishedSession;
  }

  private async getOwnedSession(sessionId: string, userId: string) {
    const session = await this.studyRepository.findSessionById(sessionId);

    if (!session) {
      throw new NotFoundException('Study session not found');
    }

    if (!this.objectIdEquals(session.userId, userId)) {
      throw new ForbiddenException('You do not own this study session');
    }

    return session;
  }

  private getDocumentId(document: { _id: unknown }) {
    return String(document._id);
  }

  private answersMatch(userAnswer: string, correctAnswer: string) {
    return (
      this.normalizeAnswer(userAnswer) === this.normalizeAnswer(correctAnswer)
    );
  }

  private normalizeAnswer(answer: string) {
    return answer.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private resolveReviewResult(
    mode: 'flashcard' | 'learn' | 'test' | 'match',
    logCardReviewDto: LogCardReviewDto,
    card: CardDocument,
  ): { isCorrect: boolean; rating: ReviewRating } {
    if (mode === 'flashcard') {
      if (!logCardReviewDto.rating) {
        throw new BadRequestException('rating is required in flashcard mode');
      }

      return {
        isCorrect: logCardReviewDto.rating !== 'again',
        rating: logCardReviewDto.rating,
      };
    }

    if (!logCardReviewDto.userAnswer) {
      throw new BadRequestException('userAnswer is required in this mode');
    }

    const isCorrect = this.answersMatch(logCardReviewDto.userAnswer, card.back);

    return {
      isCorrect,
      rating: isCorrect ? (logCardReviewDto.rating ?? 'good') : 'again',
    };
  }

  private toProgressUpdate(progress: CardProgressDocument) {
    return {
      status: progress.status,
      mastery: progress.mastery,
      easeFactor: progress.easeFactor,
      intervalDays: progress.intervalDays,
      dueAt: progress.dueAt,
    };
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
