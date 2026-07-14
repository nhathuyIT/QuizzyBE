import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  FLASHCARD_GENERATE_JOB,
  FLASHCARD_GENERATE_QUEUE,
} from '../constants/chatbot.constants';
import { FlashcardGenerateJobData } from '../interfaces/flashcard-generate-job-data.interface';
import { FlashcardGenerationRunnerService } from '../services/flashcard-generation-runner.service';

@Processor(FLASHCARD_GENERATE_QUEUE)
export class FlashcardGenerateProcessor extends WorkerHost {
  constructor(
    private readonly flashcardGenerationRunner: FlashcardGenerationRunnerService,
  ) {
    super();
  }

  async process(job: Job<FlashcardGenerateJobData>): Promise<void> {
    if (job.name !== FLASHCARD_GENERATE_JOB) {
      return;
    }

    await this.flashcardGenerationRunner.run(job.data, (progress) =>
      job.updateProgress(progress),
    );
  }
}
