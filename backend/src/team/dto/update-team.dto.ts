import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { TeamType } from '@prisma/client';

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(TeamType)
  teamType?: TeamType;
}
