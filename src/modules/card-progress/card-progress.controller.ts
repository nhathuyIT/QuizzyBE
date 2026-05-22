import { Controller } from '@nestjs/common';
import { CardProgressService } from './card-progress.service';

@Controller('v1/card-progress')
export class CardProgressController {
  constructor(private readonly cardProgressService: CardProgressService) {}
}
