import {
  DeckSourceType,
  DeckVisibility,
} from '../../../common/enums/deck-visibility.enum';

export interface DeckResponse {
  _id: string;
  title: string;
  description?: string;
  visibility: DeckVisibility;
  createdBy: string;
  star: boolean;
  sourceType: DeckSourceType;
  tags: string[];
  cardCount: number;
  lastStudiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
