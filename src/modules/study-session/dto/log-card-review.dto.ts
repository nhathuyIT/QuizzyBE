import {
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class LogCardReviewDto {
  @IsMongoId()
  sessionId!: string;

  @IsMongoId()
  cardId!: string;

  @IsOptional()
  @IsString()
  answer?: string;

  @IsBoolean()
  isCorrect!: boolean;

  @IsIn(['again', 'hard', 'good', 'easy'])
  rating!: 'again' | 'hard' | 'good' | 'easy';

  @IsNumber()
  @Min(0)
  responseTimeMs!: number;
}
