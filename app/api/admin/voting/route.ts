import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin, isC1User } from '@/lib/admin-auth';
import { getVotingReport } from '@/lib/voting-data';
export async function GET(req: Request) {
  const session = await getAuthenticatedAdmin(req);
  if (!session) return NextResponse.json({error:'Unauthorized access.'},{status:401});
  const isC1 = isC1User(session.user);
  try { return NextResponse.json(await getVotingReport({ c1Only: isC1 }),{headers:{'Cache-Control':'no-store'}}); }
  catch { return NextResponse.json({error:'Unable to load voting breakdown. Please retry.'},{status:503}); }
}
