import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DeckRepository } from './deck.repository';
import { SearchDeckDto } from './dto/search-deck.dto';
import { DeckService } from './deck.service';

describe('DeckService', () => {
  let service: DeckService;
  let deckRepository: {
    create: jest.Mock;
    findById: jest.Mock;
    search: jest.Mock;
    searchStarred: jest.Mock;
    updateById: jest.Mock;
    updateCardCount: jest.Mock;
    starDeck: jest.Mock;
    unstarDeck: jest.Mock;
    findStarredDeckIds: jest.Mock;
    isDeckStarred: jest.Mock;
  };

  beforeEach(() => {
    deckRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      search: jest.fn(),
      searchStarred: jest.fn(),
      updateById: jest.fn(),
      updateCardCount: jest.fn(),
      starDeck: jest.fn(),
      unstarDeck: jest.fn(),
      findStarredDeckIds: jest.fn(),
      isDeckStarred: jest.fn(),
    };
    service = new DeckService(deckRepository as unknown as DeckRepository);
  });

  it('rejects a quoted deck id before querying mongoose', async () => {
    await expect(
      service.validateDeckOwner('"6a190d748df1ac84499a5f3a"\n', 'user-id'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(deckRepository.findById).not.toHaveBeenCalled();
  });

  it('marks decks starred by the current user in search results', async () => {
    const userId = new Types.ObjectId().toString();
    const deckId = new Types.ObjectId();
    const createdAt = new Date('2026-06-10T00:00:00.000Z');
    const updatedAt = new Date('2026-06-11T00:00:00.000Z');
    const deck = {
      _id: deckId,
      title: 'English Vocabulary',
      description: 'Useful words',
      visibility: 'public',
      createdBy: new Types.ObjectId(),
      sourceType: 'manual',
      tags: ['english'],
      cardCount: 3,
      createdAt,
      updatedAt,
      toObject: () => ({
        _id: deckId,
        title: 'English Vocabulary',
        description: 'Useful words',
        visibility: 'public',
        createdBy: new Types.ObjectId(),
        sourceType: 'manual',
        tags: ['english'],
        cardCount: 3,
        createdAt,
        updatedAt,
      }),
    };
    const searchDeckDto = new SearchDeckDto();

    deckRepository.search.mockResolvedValue([[deck], 1]);
    deckRepository.findStarredDeckIds.mockResolvedValue(
      new Set([deckId.toString()]),
    );

    const result = await service.searchDecks(searchDeckDto, userId);

    expect(result.data[0].star).toBe(true);
    expect(deckRepository.search).toHaveBeenCalledWith(searchDeckDto, userId);
    expect(deckRepository.findStarredDeckIds).toHaveBeenCalledWith(userId, [
      deckId.toString(),
    ]);
  });

  it('does not expose private deck details to anonymous users', async () => {
    const deckId = new Types.ObjectId();
    const ownerId = new Types.ObjectId();
    const deck = {
      _id: deckId,
      title: 'Private Deck',
      visibility: 'private',
      createdBy: ownerId,
      sourceType: 'manual',
      tags: [],
      cardCount: 0,
      toObject: () => ({
        _id: deckId,
        title: 'Private Deck',
        visibility: 'private',
        createdBy: ownerId,
        sourceType: 'manual',
        tags: [],
        cardCount: 0,
      }),
    };

    deckRepository.findById.mockResolvedValue(deck);

    await expect(service.findById(deckId.toString())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(deckRepository.isDeckStarred).not.toHaveBeenCalled();
  });
});
