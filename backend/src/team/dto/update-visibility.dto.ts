import { IsArray, IsOptional, IsEnum } from 'class-validator';

export enum ProposalPublicField {
    DETAILED_PLAN = 'detailedPlan',
    EXPECTED_OUTCOME = 'expectedOutcome',
    REFERENCE_LINKS = 'referenceLinks',
}


export class UpdateVisibilityDto {
    @IsArray()
    @IsEnum(ProposalPublicField, { each: true })
    publicFields: ProposalPublicField[];
}