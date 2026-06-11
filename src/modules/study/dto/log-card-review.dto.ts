import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class LogCardReviewDto {
  @IsMongoId({ message: 'sessionId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'sessionId is required' })
  sessionId!: string;

  @IsMongoId({ message: 'cardId must be a valid MongoDB ObjectId' })
  @IsNotEmpty({ message: 'cardId is required' })
  cardId!: string;

  @IsString({ message: 'userAnswer must be a string' })
  @IsOptional()
  userAnswer?: string;

  @IsEnum(['again', 'hard', 'good', 'easy'], {
    message: 'rating must be one of: again, hard, good, easy',
  })
  @IsOptional()
  rating?: 'again' | 'hard' | 'good' | 'easy';
  @IsNumber()
  @Min(0, { message: 'responseTimeMs must be a non-negative number' })
  @IsOptional()
  responseTimeMs?: number;
}
