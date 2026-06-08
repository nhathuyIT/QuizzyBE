import { IsIn, IsMongoId } from 'class-validator';

export class CreateStudySessionDto {
  @IsMongoId()
  deckId!: string;

  @IsIn(['flashcard', 'learn', 'test', 'match'])
  mode!: 'flashcard' | 'learn' | 'test' | 'match';
}
