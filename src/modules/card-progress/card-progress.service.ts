import { Injectable } from '@nestjs/common';
import { UpsertCardProgressDto } from './dto/upsert-card-progress.dto';
import { CardProgressRepository } from './card-progress.repository';

@Injectable()
export class CardProgressService {
  constructor(
    private readonly cardProgressRepository: CardProgressRepository,
  ) {}

  async upsertProgress(
    userId: string,
    upsertCardProgressDto: UpsertCardProgressDto,
  ) {
    return this.cardProgressRepository.upsertByUserAndCard(
      userId,
      upsertCardProgressDto,
    );
  }

  async findDueCards(userId: string, deckId: string, dueAt?: Date) {
    return this.cardProgressRepository.findDueCards(userId, deckId, dueAt);
  }
}
