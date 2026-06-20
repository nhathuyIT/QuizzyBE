import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientSession, Types } from 'mongoose';
import { ReviewRating } from '../../common/enums/review-ratings.enum';
import { UpsertCardProgressDto } from './dto/upsert-card-progress.dto';
import {
  CardProgressRepository,
  CardProgressUpdate,
} from './card-progress.repository';
import { DeckDocument } from '../deck/schemas/deck.schema';
import { CardProgressDocument } from './schemas/card-progress.schema';

interface ApplyReviewProgressInput {
  userId: string;
  deckId: string;
  cardId: string;
  isCorrect: boolean;
  rating: ReviewRating;
}

interface ApplyReviewProgressBatchInput {
  userId: string;
  deckId: string;
  reviews: Array<{
    cardId: string;
    isCorrect: boolean;
    rating: ReviewRating;
  }>;
  session?: ClientSession;
}

type CardProgressState = Pick<
  CardProgressDocument | CardProgressUpdate,
  'mastery' | 'easeFactor' | 'correctCount' | 'wrongCount'
>;

@Injectable()
export class CardProgressService {
  constructor(
    private readonly cardProgressRepository: CardProgressRepository,
  ) {}

  async upsertProgress(
    userId: string,
    upsertCardProgressDto: UpsertCardProgressDto,
  ) {
    await this.validateDeckAccess(upsertCardProgressDto.deckId, userId);
    const card = await this.cardProgressRepository.findCardById(
      upsertCardProgressDto.cardId,
    );

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    if (!this.objectIdEquals(card.deckId, upsertCardProgressDto.deckId)) {
      throw new BadRequestException('Card does not belong to this deck');
    }

    return this.cardProgressRepository.upsertByUserAndCard(
      userId,
      upsertCardProgressDto,
    );
  }

  async applyReviewProgress(input: ApplyReviewProgressInput) {
    const currentProgress = await this.cardProgressRepository.findByUserAndCard(
      input.userId,
      input.cardId,
    );
    const nextProgress = this.calculateNextProgress(currentProgress, input);

    return this.cardProgressRepository.upsertReviewProgress(
      input.userId,
      input.deckId,
      input.cardId,
      nextProgress,
    );
  }

  async applyReviewProgressBatch(input: ApplyReviewProgressBatchInput) {
    if (input.reviews.length === 0) {
      return [];
    }

    const cardIds = Array.from(
      new Set(input.reviews.map((review) => review.cardId)),
    );
    const currentProgress =
      await this.cardProgressRepository.findByUserAndCards(
        input.userId,
        cardIds,
        input.session,
      );
    const currentProgressByCardId = new Map(
      currentProgress.map((progress) => [progress.cardId.toString(), progress]),
    );
    const finalProgressByCardId = new Map<string, CardProgressUpdate>();
    const progressByReview = input.reviews.map((review) => {
      const previousProgress =
        finalProgressByCardId.get(review.cardId) ??
        currentProgressByCardId.get(review.cardId) ??
        null;
      const nextProgress = this.calculateNextProgress(previousProgress, review);

      finalProgressByCardId.set(review.cardId, nextProgress);

      return nextProgress;
    });

    await this.cardProgressRepository.bulkUpsertReviewProgress(
      input.userId,
      input.deckId,
      Array.from(finalProgressByCardId.entries()).map(([cardId, progress]) => ({
        cardId,
        progress,
      })),
      input.session,
    );

    return progressByReview;
  }

  async findDueCards(userId: string, deckId: string, dueAt?: Date) {
    await this.validateDeckAccess(deckId, userId);
    await this.cardProgressRepository.initializeDeckProgress(userId, deckId);

    return this.cardProgressRepository.findDueCards(userId, deckId, dueAt);
  }

  async getDeckSummary(userId: string, deckId: string) {
    await this.validateDeckAccess(deckId, userId);
    await this.cardProgressRepository.initializeDeckProgress(userId, deckId);

    return this.cardProgressRepository.getDeckSummary(userId, deckId);
  }

  private calculateNextProgress(
    currentProgress: CardProgressState | null,
    review: Pick<ApplyReviewProgressInput, 'isCorrect' | 'rating'>,
  ): CardProgressUpdate {
    const ratingConfig = {
      again: { masteryDelta: -10, intervalDays: 0, status: 'learning' },
      hard: { masteryDelta: 5, intervalDays: 1, status: 'learning' },
      good: { masteryDelta: 15, intervalDays: 3, status: 'review' },
      easy: { masteryDelta: 25, intervalDays: 7, status: 'review' },
    } as const;
    const config = ratingConfig[review.rating];
    const mastery = Math.max(
      0,
      Math.min(100, (currentProgress?.mastery ?? 0) + config.masteryDelta),
    );
    const dueAt = new Date();

    dueAt.setDate(dueAt.getDate() + config.intervalDays);

    return {
      mastery,
      status: mastery >= 90 ? 'mastered' : config.status,
      easeFactor: currentProgress?.easeFactor ?? 2.5,
      intervalDays: config.intervalDays,
      dueAt,
      correctCount:
        (currentProgress?.correctCount ?? 0) + (review.isCorrect ? 1 : 0),
      wrongCount:
        (currentProgress?.wrongCount ?? 0) + (review.isCorrect ? 0 : 1),
    };
  }

  private async validateDeckAccess(deckId: string, userId: string) {
    const deck = await this.cardProgressRepository.findDeckById(deckId);

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    if (!this.canAccessDeck(deck, userId)) {
      throw new ForbiddenException(
        'You do not have permission to access this deck progress',
      );
    }

    return deck;
  }

  private canAccessDeck(deck: DeckDocument, userId: string) {
    const isOwner = this.objectIdEquals(deck.createdBy, userId);
    return (
      !deck.deletedAt &&
      (isOwner ||
        (deck.visibility !== 'private' && deck.moderationStatus !== 'hidden'))
    );
  }

  private objectIdEquals(
    left: Types.ObjectId | string,
    right: Types.ObjectId | string,
  ) {
    return left?.toString() === right?.toString();
  }
}
