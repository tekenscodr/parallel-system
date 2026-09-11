import { withEcSql } from '@/lib/db-ec';
import { buildVotingReport, type VotingSource } from '@/lib/voting-rules';
export async function getVotingReport() {
  return withEcSql(async sql => {
    const rows = await sql<VotingSource[]>`SELECT id, executive_name, executive_level, position, region,
      constituency, voter_id, membership_id, gender, date_of_birth, age FROM executives_all
      WHERE lower(trim(executive_level)) IN ('constituency','region','regional','national','tescon') ORDER BY id`;
    return buildVotingReport(rows);
  });
}
