import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateAiSourceAndJobDto } from './dto/create-ai-source.dto';
import {
  AiGenerationJob,
  AiGenerationJobDocument,
} from './schemas/ai-job.schema';
import { AiSource, AiSourceDocument } from './schemas/ai-source.schema';

@Injectable()
export class AiGeneratorRepository {
  constructor(
    @InjectModel(AiSource.name)
    private readonly aiSourceModel: Model<AiSourceDocument>,
    @InjectModel(AiGenerationJob.name)
    private readonly aiGenerationJobModel: Model<AiGenerationJobDocument>,
  ) {}

  async createSource(
    createAiSourceAndJobDto: CreateAiSourceAndJobDto,
    userId: string,
  ): Promise<AiSourceDocument> {
    return this.aiSourceModel.create({
      type: createAiSourceAndJobDto.type,
      title: createAiSourceAndJobDto.title,
      rawText: createAiSourceAndJobDto.rawText,
      fileUrl: createAiSourceAndJobDto.fileUrl,
      userId: new Types.ObjectId(userId),
    });
  }

  async createJob(params: {
    userId: string;
    sourceId: string;
    prompt: string;
    targetDeckId?: string;
    cardCount?: number;
    difficulty?: string;
    language?: string;
  }): Promise<AiGenerationJobDocument> {
    return this.aiGenerationJobModel.create({
      userId: new Types.ObjectId(params.userId),
      sourceId: new Types.ObjectId(params.sourceId),
      targetDeckId: params.targetDeckId
        ? new Types.ObjectId(params.targetDeckId)
        : undefined,
      prompt: params.prompt,
      options: {
        cardCount: params.cardCount ?? 10,
        difficulty: params.difficulty ?? 'medium',
        language: params.language ?? 'vi',
      },
    });
  }

  async findJobById(id: string): Promise<AiGenerationJobDocument | null> {
    return this.aiGenerationJobModel.findById(id).exec();
  }

  async updateJobStatus(
    id: string,
    status: 'queued' | 'running' | 'done' | 'failed',
    errorMessage?: string,
  ): Promise<AiGenerationJobDocument | null> {
    const update: Record<string, unknown> = { status };

    if (status === 'done' || status === 'failed') {
      update.finishedAt = new Date();
    }

    if (errorMessage) {
      update.errorMessage = errorMessage;
    }

    return this.aiGenerationJobModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();
  }
}
