import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { TeamType } from '@prisma/client';

export class CreateTeamDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEnum(TeamType)
    teamType: TeamType;
}
