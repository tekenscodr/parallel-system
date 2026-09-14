import { withEcSql } from '@/lib/db-ec';
import { buildVotingReport, type VotingSource } from '@/lib/voting-rules';
import { getC1SqlCondition } from '@/lib/c1-electoral-college';

export async function getVotingReport(options?: { c1Only?: boolean }) {
  return withEcSql(async sql => {
    const c1Filter = options?.c1Only ? sql`AND ${getC1SqlCondition(sql)}` : sql``;
    const rows = await sql<VotingSource[]>`SELECT id, executive_name, executive_level, position, region,
      constituency, voter_id, membership_id, gender, date_of_birth, age FROM executives_all
      WHERE lower(trim(executive_level)) IN ('constituency','region','regional','national','tescon','external branch') ${c1Filter} ORDER BY id`;
    return buildVotingReport(rows);
  });
}
