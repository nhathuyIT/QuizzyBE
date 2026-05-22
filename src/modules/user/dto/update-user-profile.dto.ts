import { IsOptional, IsString } from 'class-validator';

export class UpdateUserProfileDto {
  @IsString({ message: 'Tên hiển thị phải là chuỗi ký tự' })
  @IsOptional()
  name?: string;

  @IsString({ message: 'Ảnh đại diện phải là chuỗi ký tự' })
  @IsOptional()
  avatarUrl?: string;
}
