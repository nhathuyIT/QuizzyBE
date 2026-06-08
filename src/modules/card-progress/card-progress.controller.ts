import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';
import { CardProgressService } from './card-progress.service';
import { UpsertCardProgressDto } from './dto/upsert-card-progress.dto';

@UseGuards(JwtAuthGuard)
@Controller('v1/card-progress')
export class CardProgressController {
  constructor(private readonly cardProgressService: CardProgressService) {}

  @Put()
  upsertProgress(
    @CurrentUser('id') userId: string,
    @Body() upsertCardProgressDto: UpsertCardProgressDto,
  ) {
    return this.cardProgressService.upsertProgress(
      userId,
      upsertCardProgressDto,
    );
  }

  @Get('decks/:deckId/due')
  findDueCards(
    @CurrentUser('id') userId: string,
    @Param('deckId', new ParseMongoIdPipe()) deckId: string,
  ) {
    return this.cardProgressService.findDueCards(userId, deckId);
  }

  @Get('decks/:deckId/summary')
  getDeckSummary(
    @CurrentUser('id') userId: string,
    @Param('deckId', new ParseMongoIdPipe()) deckId: string,
  ) {
    return this.cardProgressService.getDeckSummary(userId, deckId);
  }
}
