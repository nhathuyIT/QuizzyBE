import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAiSourceAndJobDto } from './dto/create-ai-source.dto';
import { AiGeneratorRepository } from './ai-generator.repository';

@Injectable()
export class AiGeneratorService {
  constructor(private readonly aiGeneratorRepository: AiGeneratorRepository) {}

  async createSourceAndQueuedJob(
    createAiSourceAndJobDto: CreateAiSourceAndJobDto,
    userId: string,
    prompt: string,
  ) {
    const source = await this.aiGeneratorRepository.createSource(
      createAiSourceAndJobDto,
      userId,
    );
    const job = await this.aiGeneratorRepository.createJob({
      userId,
      sourceId: source._id.toString(),
      prompt,
      cardCount: createAiSourceAndJobDto.cardCount,
      difficulty: createAiSourceAndJobDto.difficulty,
      language: createAiSourceAndJobDto.language,
    });

    return { source, job };
  }

  async findJobById(id: string) {
    const job = await this.aiGeneratorRepository.findJobById(id);
    if (!job) {
      throw new NotFoundException('Tác vụ AI không tồn tại trên hệ thống');
    }

    return job;
  }
}
