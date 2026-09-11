import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/admin-auth';
import { getVotingReport } from '@/lib/voting-data';
export async function GET(req: Request) {
  if (!await getAuthenticatedAdmin(req)) return NextResponse.json({error:'Unauthorized access.'},{status:401});
  try { return NextResponse.json(await getVotingReport(),{headers:{'Cache-Control':'no-store'}}); }
  catch { return NextResponse.json({error:'Unable to load voting breakdown. Please retry.'},{status:503}); }
}
