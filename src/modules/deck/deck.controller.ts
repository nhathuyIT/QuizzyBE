import { Controller } from '@nestjs/common';
import { DeckService } from './deck.service';

@Controller('v1/decks')
export class DeckController {
  constructor(private readonly deckService: DeckService) {}
}
