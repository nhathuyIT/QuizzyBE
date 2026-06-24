import { FlashcardDifficulty } from './ai-provider.interface';

export interface FlashcardGenerateJobData {
  jobId: string;
  sourceId: string;
  userId: string;
  title: string;
  content: string;
  options: {
    cardCount: number;
    difficulty: FlashcardDifficulty;
    language: string;
  };
  conversationId?: string;
}
