import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  // TODO: createTeam()
  // TODO: createProposal()
  // TODO: getTeams()
  // TODO: getTeam()
  // TODO: updateVisibility()
}
