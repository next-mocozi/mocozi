import { MessageContext } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 양식 upsert 요청 — (userId, context) UNIQUE 제약 위반 없도록 PUT semantics.
 * 같은 context면 덮어씀.
 */
export class UpsertTemplateDto {
  @IsEnum(MessageContext)
  context: MessageContext;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
