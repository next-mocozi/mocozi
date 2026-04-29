import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { TeamType } from '@prisma/client';

export class CreateTeamDto {
    @IsString()
    @IsNotEmpty()
    teamname: string;

    @IsEnum(TeamType)
    type: TeamType;
}
