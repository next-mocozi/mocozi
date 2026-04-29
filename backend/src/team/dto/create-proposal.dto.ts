import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProposalDto {
    @IsNotEmpty()
    @IsString()
    projectName: string;

    @IsNotEmpty()
    @IsString()
    overview: string;

    @IsNotEmpty()
    @IsString()
    schedule: string;

    @IsNotEmpty()
    @IsArray()
    @IsString({ each: true })
    recruitingRoles: string[];
    
    @IsNotEmpty()
    @IsArray()
    @IsString({ each: true })
    requiredSkills: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    referenceLinks: string[];

    @IsOptional()
    @IsString()
    detailedPlan: string;

    @IsOptional()
    @IsString()
    expectedOutcome: string;
}
