import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Message content is required' })
  @MaxLength(2000, { message: 'Message content must be at most 2000 chars' })
  content!: string;
}
