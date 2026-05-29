export interface CardResponse {
  _id: string;
  deckId: string;
  front: string;
  back: string;
  hint: string;
  explanation: string;
  imageUrl: string;
  examples: string[];
  position: number;
  aiJobId?: string;
  createdAt: Date;
  updatedAt: Date;
}
