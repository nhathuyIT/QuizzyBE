import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CardProgressService } from '../card-progress/card-progress.service';
import { StudyItemsBuilder } from './builders/study-item-builder';
import { StudyRepository } from './study.repository';
import { StudyService } from './study.service';

describe('StudyService', () => {
  let service: StudyService;
  let studyRepository: {
    findDeckById: jest.Mock;
    createSession: jest.Mock;
    findSessionsByUser: jest.Mock;
    findSessionById: jest.Mock;
    findCardById: jest.Mock;
    createReview: jest.Mock;
    updateSessionStats: jest.Mock;
    finishSession: jest.Mock;
  };
  let cardProgressService: {
    applyReviewProgress: jest.Mock;
  };
  let studyItemsBuilder: {
    build: jest.Mock;
  };

  beforeEach(() => {
    studyRepository = {
      findDeckById: jest.fn(),
      createSession: jest.fn(),
      findSessionsByUser: jest.fn(),
      findSessionById: jest.fn(),
      findCardById: jest.fn(),
      createReview: jest.fn(),
      updateSessionStats: jest.fn(),
      finishSession: jest.fn(),
    };
    cardProgressService = {
      applyReviewProgress: jest.fn(),
    };
    studyItemsBuilder = {
      build: jest.fn(),
    };
    service = new StudyService(
      studyRepository as unknown as StudyRepository,
      cardProgressService as unknown as CardProgressService,
      studyItemsBuilder as unknown as StudyItemsBuilder,
    );
  });

  it('checks the answer server-side and returns review progress', async () => {
    const userId = new Types.ObjectId().toString();
    const deckId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    const cardId = new Types.ObjectId();
    const reviewId = new Types.ObjectId();
    const session = {
      _id: sessionId,
      userId: new Types.ObjectId(userId),
      deckId,
    };
    const card = {
      _id: cardId,
      deckId,
      back: 'On dinh, nhat quan',
      explanation: 'A consistent API returns predictable response shapes.',
    };
    const progress = {
      status: 'learning',
      mastery: 65,
      easeFactor: 2.6,
      intervalDays: 2,
      dueAt: new Date('2026-06-10T02:00:00.000Z'),
    };

    studyRepository.findSessionById.mockResolvedValue(session);
    studyRepository.findCardById.mockResolvedValue(card);
    studyRepository.createReview.mockResolvedValue({ _id: reviewId });
    cardProgressService.applyReviewProgress.mockResolvedValue(progress);
    studyRepository.updateSessionStats.mockResolvedValue(session);

    await expect(
      service.logReview(
        {
          sessionId: sessionId.toString(),
          cardId: cardId.toString(),
          userAnswer: ' on dinh, nhat quan ',
        },
        userId,
      ),
    ).resolves.toEqual({
      reviewId: reviewId.toString(),
      cardId: cardId.toString(),
      isCorrect: true,
      correctAnswer: card.back,
      explanation: card.explanation,
      progressUpdate: progress,
    });

    expect(studyRepository.createReview).toHaveBeenCalledWith(
      {
        sessionId: sessionId.toString(),
        cardId: cardId.toString(),
        userAnswer: ' on dinh, nhat quan ',
      },
      userId,
      true,
      'good',
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

  it('throws when the session does not exist', async () => {
    studyRepository.findSessionById.mockResolvedValue(null);

    await expect(
      service.logReview(
        {
          sessionId: new Types.ObjectId().toString(),
          cardId: new Types.ObjectId().toString(),
          userAnswer: 'my answer',
        },
        'user-id',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks the answer wrong without trusting the client', async () => {
    const userId = new Types.ObjectId().toString();
    const deckId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    const cardId = new Types.ObjectId();

    studyRepository.findSessionById.mockResolvedValue({
      _id: sessionId,
      userId: new Types.ObjectId(userId),
      deckId,
    });
    studyRepository.findCardById.mockResolvedValue({
      _id: cardId,
      deckId,
      back: 'Correct answer',
    });
    studyRepository.createReview.mockResolvedValue({
      _id: new Types.ObjectId(),
    });
    cardProgressService.applyReviewProgress.mockResolvedValue({
      status: 'learning',
      mastery: 0,
      easeFactor: 2.5,
      intervalDays: 0,
      dueAt: new Date('2026-06-08T00:00:00.000Z'),
    });
    studyRepository.updateSessionStats.mockResolvedValue({});

    const result = await service.logReview(
      {
        sessionId: sessionId.toString(),
        cardId: cardId.toString(),
        userAnswer: 'Wrong answer',
      },
      userId,
    );

    expect(result.isCorrect).toBe(false);
    expect(studyRepository.createReview).toHaveBeenCalledWith(
      expect.any(Object),
      userId,
      false,
      'again',
    );
    expect(cardProgressService.applyReviewProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        isCorrect: false,
        rating: 'again',
      }),
    );
  });

  it('uses flashcard rating without requiring a typed answer', async () => {
    const userId = new Types.ObjectId().toString();
    const deckId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();
    const cardId = new Types.ObjectId();

    studyRepository.findSessionById.mockResolvedValue({
      _id: sessionId,
      userId: new Types.ObjectId(userId),
      deckId,
      mode: 'flashcard',
    });
    studyRepository.findCardById.mockResolvedValue({
      _id: cardId,
      deckId,
      back: 'Correct answer',
    });
    studyRepository.createReview.mockResolvedValue({
      _id: new Types.ObjectId(),
    });
    cardProgressService.applyReviewProgress.mockResolvedValue({
      status: 'review',
      mastery: 25,
      easeFactor: 2.5,
      intervalDays: 7,
      dueAt: new Date('2026-06-15T00:00:00.000Z'),
    });
    studyRepository.updateSessionStats.mockResolvedValue({});

    const result = await service.logReview(
      {
        sessionId: sessionId.toString(),
        cardId: cardId.toString(),
        rating: 'easy',
      },
      userId,
    );

    expect(result.isCorrect).toBe(true);
    expect(studyRepository.createReview).toHaveBeenCalledWith(
      expect.any(Object),
      userId,
      true,
      'easy',
    );
    expect(cardProgressService.applyReviewProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        isCorrect: true,
        rating: 'easy',
      }),
    );
  });
});
