export type StudyMode = 'flashcard' | 'learn' | 'test' | 'match';

export interface ChoiceOption {
  value: string;
  label: string;
}

export type StudyItem =
  | {
      cardId: string;
      type: 'flashcard';
      front: string;
      back: string;
      hint?: string;
      explanation?: string;
      imageUrl?: string;
    }
  | {
      cardId: string;
      type: 'written';
      prompt: string;
      hint?: string;
      correctAnswer?: string;
    }
  | {
      cardId: string;
      questionId: string;
      type: 'written' | 'multiple_choice';
      prompt: string;
      options?: ChoiceOption[];
      correctAnswer?: string;
    }
  | {
      tileId: string;
      cardId: string;
      side: 'front' | 'back';
      text: string;
    };
