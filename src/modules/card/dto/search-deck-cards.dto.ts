import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PageOptionsDto } from '../../../common/dto/page-options.dto';

export class SearchDeckCardsDto extends PageOptionsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  take: number = 20;

  get skip(): number {
    return (this.page - 1) * this.take;
  }
}
