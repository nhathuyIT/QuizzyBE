import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateConversationDto {
  @IsString()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;
}
