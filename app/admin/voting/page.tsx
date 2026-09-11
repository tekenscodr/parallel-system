"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/app/admin/components/AdminShell';
import { getClientHeaders } from '@/lib/client-device';
import type { VotingReport, Electorate } from '@/lib/voting-rules';

export default function VotingPage() {
  const [data,setData]=useState<VotingReport|null>(null);
  const [error,setError]=useState('');
  const [region,setRegion]=useState('');
  const [positionFilter,setPositionFilter]=useState('');
  const [contest,setContest]=useState<Electorate>('general');
  const [view,setView]=useState<'regional'|'constituency'>('regional');
  const [page,setPage]=useState(1);
  useEffect(()=>{let active=true;fetch('/api/admin/voting',{credentials:'include',headers:getClientHeaders()})
    .then(async r=>{if(!r.ok)throw new Error(r.status===401?'Please sign in as an administrator.':'Could not load voting data.');return r.json();})
    .then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  const cell={padding:'12px',textAlign:'left' as const,borderBottom:'1px solid #334155'};
  const control={padding:'10px',background:'#17243b',color:'#fff',border:'1px solid #64748b',borderRadius:6,fontSize:14};
  const availablePositions = Array.from(new Set(data?.people.flatMap(p => p.positions.split('; ').map(s => s.trim())).filter(Boolean) || [])).sort();
  const people=data?.people.filter(p=>(!region||p.region===region)&&p.flags[contest]&&(!positionFilter||p.positions.toLowerCase().includes(positionFilter.toLowerCase())))||[];
  const metrics=data?.[view].filter(p=>!region||p.region===region)||[];
  return <AdminShell currentUser={null} title="Voting breakdown"><main style={{padding:24,color:'#e2e8f0',fontSize:16,maxWidth:1500,margin:'auto'}}>
    <Link href="/admin/dashboard">Back to executive dashboard</Link>
    <h1>Voting breakdown</h1>
    {error?<p role="alert">{error} <Link href="/admin/login">Sign in</Link></p>:!data?<p role="status">Loading executive records…</p>:<>
      <p>2026 eligibility rules · {data.totals.people.toLocaleString()} identity groups · {data.totals.review.toLocaleString()} require data review</p>
      <p>Below 40 means 2026 minus DOB year. All TESCON executives except patrons qualify for Youth Organiser regardless of age.</p>
      <div style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:20}}>
        <label>Region <select style={control} value={region} onChange={e=>{setRegion(e.target.value);setPage(1);}}><option value="">All regions</option>{data.regional.map(r=><option key={r.region}>{r.region}</option>)}</select></label>
        <label>Contest <select style={control} value={data.contests.find(c=>c.group===contest)?.position} onChange={e=>{setContest(data.contests.find(c=>c.position===e.target.value)!.group);setPage(1);}}>{data.contests.map(c=><option key={c.position}>{c.position}</option>)}</select></label>
        <label>Position <select style={control} value={positionFilter} onChange={e=>{setPositionFilter(e.target.value);setPage(1);}}><option value="">All positions ({availablePositions.length})</option>{availablePositions.map(pos=><option key={pos} value={pos}>{pos}</option>)}</select></label>
        <label>Metrics <select style={control} value={view} onChange={e=>setView(e.target.value as typeof view)}><option value="regional">Regional</option><option value="constituency">Constituency</option></select></label>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>{data.contests.map(c=><button key={c.position} onClick={()=>{setContest(c.group);setPage(1);}} style={{...control,textAlign:'left',padding:18,borderColor:c.group===contest?'#38bdf8':'#64748b'}}>{c.position}<br/><strong style={{fontSize:26}}>{data.people.filter(p=>(!region||p.region===region)&&p.flags[c.group]).length.toLocaleString()}</strong></button>)}</div>
      <p>The six general contests share an electorate. Contest counts overlap. Records without valid voter IDs remain provisional; conflicting identities are withheld from eligibility totals.</p>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><caption style={{textAlign:'left',padding:'20px 0'}}>Metrics by {view==='regional'?'region':'constituency'} ({metrics.length})</caption><thead><tr>{['Region',...(view==='constituency'?['Constituency / scope']:[]),'General contests','Youth','Women','Nasara','Review'].map(h=><th style={cell} key={h}>{h}</th>)}</tr></thead><tbody>{metrics.map(r=><tr key={r.region+r.constituency}><td style={cell}>{r.region}</td>{view==='constituency'&&<td style={cell}>{r.constituency}</td>}{[r.general,r.youth,r.women,r.nasara,r.review].map((v,i)=><td key={i} style={cell}>{v.toLocaleString()}</td>)}</tr>)}</tbody></table></div>
      <h2>Eligible electorate ({people.length.toLocaleString()})</h2>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Name','Region','Constituency / scope','Position','Eligibility reason','Review'].map(h=><th key={h} style={cell}>{h}</th>)}</tr></thead><tbody>{people.slice((page-1)*50,page*50).map(p=><tr key={p.key}><td style={cell}>{p.name}</td><td style={cell}>{p.region}</td><td style={cell}>{p.constituency}</td><td style={cell}>{p.positions}</td><td style={cell}>{p.reasons[contest]}</td><td style={cell}>{p.issues.join('; ')||'—'}</td></tr>)}</tbody></table></div>
      <p><button style={control} disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button> Page {page} of {Math.max(1,Math.ceil(people.length/50))} <button style={control} disabled={page*50>=people.length} onClick={()=>setPage(page+1)}>Next</button></p>
      <details><summary>Records requiring review ({data.totals.review})</summary><div style={{overflowX:'auto',maxHeight:450}}><table><thead><tr><th style={cell}>Name</th><th style={cell}>Source record IDs</th><th style={cell}>Issue</th></tr></thead><tbody>{data.people.filter(p=>p.issues.length&&(!region||p.region===region)).map(p=><tr key={p.key}><td style={cell}>{p.name}</td><td style={cell}>{p.recordIds}</td><td style={cell}>{p.issues.join('; ')}</td></tr>)}</tbody></table></div></details>
      <p>Source: ec-data executive registry, retrieved {new Date(data.generatedAt).toLocaleString()}. National and regional officers are shown in their own scope rows.</p>
    </>}
  </main></AdminShell>;
}
