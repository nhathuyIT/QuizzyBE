import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CardProgressService } from '../card-progress/card-progress.service';
import { StudyRepository } from './study.repository';
import { StudyService } from './study.service';

describe('StudyService', () => {
  let service: StudyService;
  let studyRepository: {
    findDeckById: jest.Mock;
    createSession: jest.Mock;
    findSessionsByUser: jest.Mock;
    findSessionById: jest.Mock;
    findActiveSessionByUser: jest.Mock;
    findReviewedCardIds: jest.Mock;
    findNextCardInDeck: jest.Mock;
    createReview: jest.Mock;
    updateSessionStats: jest.Mock;
    finishSession: jest.Mock;
  };
  let cardProgressService: {
    applyReviewProgress: jest.Mock;
  };

  beforeEach(() => {
    studyRepository = {
      findDeckById: jest.fn(),
      createSession: jest.fn(),
      findSessionsByUser: jest.fn(),
      findSessionById: jest.fn(),
      findActiveSessionByUser: jest.fn(),
      findReviewedCardIds: jest.fn(),
      findNextCardInDeck: jest.fn(),
      createReview: jest.fn(),
      updateSessionStats: jest.fn(),
      finishSession: jest.fn(),
    };
    cardProgressService = {
      applyReviewProgress: jest.fn(),
    };
    service = new StudyService(
      studyRepository as unknown as StudyRepository,
      cardProgressService as unknown as CardProgressService,
    );
  });

  it('logs review with the active session and next card', async () => {
    const userId = new Types.ObjectId().toString();
    const deckId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    const cardId = new Types.ObjectId();
    const session = {
      _id: sessionId,
      userId: new Types.ObjectId(userId),
      deckId,
    };
    const card = {
      _id: cardId,
      deckId,
    };
    const review = { _id: new Types.ObjectId(), sessionId, cardId };

    studyRepository.findActiveSessionByUser.mockResolvedValue(session);
    studyRepository.findReviewedCardIds.mockResolvedValue([]);
    studyRepository.findNextCardInDeck.mockResolvedValue(card);
    studyRepository.createReview.mockResolvedValue(review);
    cardProgressService.applyReviewProgress.mockResolvedValue(undefined);
    studyRepository.updateSessionStats.mockResolvedValue(session);

    await expect(
      service.logReview(
        {
          answer: 'my answer',
          isCorrect: true,
          rating: 'good',
        },
        userId,
      ),
    ).resolves.toBe(review);

    expect(studyRepository.createReview).toHaveBeenCalledWith(
      {
        answer: 'my answer',
        isCorrect: true,
        rating: 'good',
      },
      userId,
      sessionId.toString(),
      cardId.toString(),
    );
    expect(cardProgressService.applyReviewProgress).toHaveBeenCalledWith({
      userId,
      deckId: deckId.toString(),
      cardId: cardId.toString(),
      isCorrect: true,
      rating: 'good',
    });
    expect(studyRepository.updateSessionStats).toHaveBeenCalledWith(
      sessionId.toString(),
      true,
    );
  });

  it('throws when there is no active session', async () => {
    studyRepository.findActiveSessionByUser.mockResolvedValue(null);

    await expect(
      service.logReview({ isCorrect: true, rating: 'good' }, 'user-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
