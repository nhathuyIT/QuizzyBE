import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @IsMongoId()
  @IsOptional()
  deckId?: string;

  @IsMongoId()
  @IsOptional()
  academicDocumentId?: string;
}
