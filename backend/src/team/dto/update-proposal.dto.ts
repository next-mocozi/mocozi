import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateProposalDto {
  @IsOptional()
  @IsString()
  projectName?: string;

  @IsOptional()
  @IsString()
  overview?: string;

  @IsOptional()
  @IsString()
  schedule?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recruitingRoles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  referenceLinks?: string[];

  @IsOptional()
  @IsString()
  detailedPlan?: string;

  @IsOptional()
  @IsString()
  expectedOutcome?: string;
}
