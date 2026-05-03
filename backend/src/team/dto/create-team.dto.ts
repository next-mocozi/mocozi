import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';
import { TeamType } from '@prisma/client';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(TeamType)
  teamType: TeamType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxMembers?: number;
}
