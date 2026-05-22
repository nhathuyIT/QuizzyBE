import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateCardDto } from './create-card.dto';

export class CreateBulkCardsDto {
  @IsArray({ message: 'Danh sách thẻ phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => CreateCardDto)
  cards: CreateCardDto[];
}
