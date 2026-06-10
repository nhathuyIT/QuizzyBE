import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class LogCardReviewDto {
  @IsMongoId({ message: 'sessionId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'sessionId is required' })
  sessionId!: string;

  @IsMongoId({ message: 'cardId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'cardId is required' })
  cardId!: string;

  @IsString({ message: 'userAnswer must be a string' })
  @IsNotEmpty({ message: 'userAnswer is required' })
  userAnswer!: string;
}
