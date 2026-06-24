export const AI_PROVIDER = Symbol('AI_PROVIDER');

export type AiChatRole = 'user' | 'model';

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiChatResponse extends AiUsage {
  content: string;
}

export type FlashcardDifficulty = 'easy' | 'medium' | 'hard';

export interface GenerateFlashcardOptions {
  cardCount: number;
  difficulty: FlashcardDifficulty;
  language: string;
}

export interface GeneratedFlashcard {
  front: string;
  back: string;
  hint?: string;
  explanation?: string;
  examples?: string[];
}

export interface GenerateFlashcardsResult extends AiUsage {
  cards: GeneratedFlashcard[];
}

export interface IAiProvider {
  chat(
    systemPrompt: string,
    history: AiChatMessage[],
    userMessage: string,
  ): Promise<AiChatResponse>;

  generateFlashcards(
    content: string,
    options: GenerateFlashcardOptions,
  ): Promise<GenerateFlashcardsResult>;

  generateTitle(firstMessage: string): Promise<string>;
}
