import { BadRequestException } from '@nestjs/common';
import { DeckRepository } from './deck.repository';
import { DeckService } from './deck.service';

describe('DeckService', () => {
  let service: DeckService;
  let deckRepository: {
    create: jest.Mock;
    findById: jest.Mock;
    search: jest.Mock;
    updateById: jest.Mock;
    updateCardCount: jest.Mock;
  };

  beforeEach(() => {
    deckRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      search: jest.fn(),
      updateById: jest.fn(),
      updateCardCount: jest.fn(),
    };
    service = new DeckService(deckRepository as unknown as DeckRepository);
  });

  it('rejects a quoted deck id before querying mongoose', async () => {
    await expect(
      service.validateDeckOwner('"6a190d748df1ac84499a5f3a"\n', 'user-id'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(deckRepository.findById).not.toHaveBeenCalled();
  });
});
