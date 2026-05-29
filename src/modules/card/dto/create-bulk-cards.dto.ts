import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { CreateCardDto } from './create-card.dto';

export class CreateBulkCardsDto {
  @IsArray({ message: 'Danh sách thẻ phải là một mảng' })
  @ArrayNotEmpty({ message: 'Danh sách thẻ không được để trống' })
  @ValidateNested({ each: true })
  @Type(() => CreateCardDto)
  cards!: CreateCardDto[];
}
