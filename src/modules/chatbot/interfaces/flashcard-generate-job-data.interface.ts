import { FlashcardDifficulty } from './ai-provider.interface';

export type FlashcardGenerateSourceType = 'text' | 'pdf' | 'academic_document';

export interface FlashcardGenerateJobData {
  jobId: string;
  sourceId: string;
  userId: string;
  title: string;
  content: string;
  sourceType?: FlashcardGenerateSourceType;
  academicDocumentId?: string;
  subjectId?: string;
  deckDescription?: string;
  deckTags?: string[];
  options: {
    cardCount: number;
    difficulty: FlashcardDifficulty;
    language: string;
  };
  conversationId?: string;
}
