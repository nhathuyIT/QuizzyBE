import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class QuerySubjectsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  @IsOptional()
  semester?: number;
}
