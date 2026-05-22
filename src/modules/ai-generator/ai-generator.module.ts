import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiGeneratorController } from './ai-generator.controller';
import { AiGeneratorRepository } from './ai-generator.repository';
import { AiGeneratorService } from './ai-generator.service';
import {
  AiGenerationJob,
  AiGenerationJobSchema,
} from './schemas/ai-job.schema';
import { AiSource, AiSourceSchema } from './schemas/ai-source.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiSource.name, schema: AiSourceSchema },
      { name: AiGenerationJob.name, schema: AiGenerationJobSchema },
    ]),
  ],
  controllers: [AiGeneratorController],
  providers: [AiGeneratorService, AiGeneratorRepository],
  exports: [AiGeneratorService, AiGeneratorRepository],
})
export class AiGeneratorModule {}
