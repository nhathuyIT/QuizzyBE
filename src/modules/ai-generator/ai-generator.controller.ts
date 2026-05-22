import { Controller } from '@nestjs/common';
import { AiGeneratorService } from './ai-generator.service';

@Controller('v1/ai-generator')
export class AiGeneratorController {
  constructor(private readonly aiGeneratorService: AiGeneratorService) {}
}
