import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CardService } from './card.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CreateCardDto } from './dto/create-card.dto';
import { CreateBulkCardsDto } from './dto/create-bulk-cards.dto';

@Controller('v1/cards')
@UseGuards(JwtAuthGuard)
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Get()
  findAll() {
    return this.cardService.findAll();
  }
  @Post()
  createCard(@Body() createCardDto: CreateCardDto) {
    return this.cardService.createCard(createCardDto);
  }
  @Post('bulk')
  createBulkCards(@Body() createBulkCardsDto: CreateBulkCardsDto) {
    return this.cardService.createBulkCards(createBulkCardsDto);
  }
  @Get('deck/:deckID')
  findByDeckId(@Param('deckID') deckId: string) {
    return this.cardService.findByDeckId(deckId);
  }
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.cardService.findById(id);
  }
}
