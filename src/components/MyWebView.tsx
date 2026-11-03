import React,{useEffect,useState} from 'react';
import {doc,onSnapshot,updateDoc,deleteField} from 'firebase/firestore';
import {Globe,Plus,ExternalLink,Pencil,Trash2} from 'lucide-react';
import {db} from '../firebase/config';
import {useAuth} from '../context/AuthContext';
import {requireSession} from '../services/fleetRepository';
import {websiteDetails,type WebLink} from '../utils/webLinks';

export function MyWebView(){
 const {user}=useAuth();
 const [state,setState]=useState<{uid:string;links:WebLink[];ready:boolean}>({uid:'',links:[],ready:false});
 const [editing,setEditing]=useState<string|null>(null);
 const [showForm,setShowForm]=useState(false),[name,setName]=useState(''),[url,setUrl]=useState('');
 const [search,setSearch]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  setState({uid:user?.uid||'',links:[],ready:false});setShowForm(false);setEditing(null);setError('');setMessage('');setName('');setUrl('');
  if(!user)return;
  let active=true;
  const stop=onSnapshot(doc(db,'users',user.uid),{includeMetadataChanges:true},snapshot=>{
   if(!active)return;
   const saved=snapshot.data()?.myWebLinks;
   const links:WebLink[]=[];
   if(saved&&typeof saved==='object')Object.entries(saved).forEach(([id,value])=>{
    if(!/^[a-zA-Z0-9-]+$/.test(id)||!value||typeof value!=='object')return;
    const row=value as Partial<WebLink>;
    try{
     const details=websiteDetails(String(row.name||''),String(row.url||''));
     links.push({id,...details,createdAt:String(row.createdAt||'')});
    }catch{/* Invalid stored addresses are never rendered as clickable links. */}
   });
   links.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.name.localeCompare(b.name));
   setState({uid:user.uid,links,ready:snapshot.exists()&&!snapshot.metadata.fromCache});
   if(!snapshot.exists()&&!snapshot.metadata.fromCache)setError('Your user profile is missing. Sign in again before saving websites.');
  },failure=>{if(active){setError(failure.message);setState(previous=>({...previous,ready:false}));}});
  return()=>{active=false;stop();};
 },[user?.uid]);
 const links=state.uid===user?.uid?state.links:[];
 const ready=Boolean(user&&state.uid===user.uid&&state.ready);
 const reset=()=>{setEditing(null);setName('');setUrl('');setShowForm(false);};
 const save=async(event:React.FormEvent)=>{
  event.preventDefault();setError('');setMessage('');setBusy(true);
  try{
   if(!user||requireSession()!==state.uid||!ready)throw new Error('Wait for your signed-in website list to load.');
   const details=websiteDetails(name,url),id=editing||crypto.randomUUID();
   const createdAt=links.find(link=>link.id===id)?.createdAt||new Date().toISOString();
   await updateDoc(doc(db,'users',state.uid),{['myWebLinks.'+id]:{...details,createdAt}});
   reset();setMessage('Website saved.');
  }catch(failure){setError(failure instanceof Error?failure.message:'Unable to save website.');}
  finally{setBusy(false);}
 };
 const remove=async(link:WebLink)=>{
  if(!confirm('Remove “'+link.name+'” from My Web?'))return;
  setError('');setMessage('');setBusy(true);
  try{
   if(!user||requireSession()!==state.uid||!ready)throw new Error('Sign in and wait for the website list to load.');
   await updateDoc(doc(db,'users',state.uid),{['myWebLinks.'+link.id]:deleteField()});
   if(editing===link.id)reset();
   setMessage('Website removed.');
  }catch(failure){setError(failure instanceof Error?failure.message:'Unable to remove website.');}
  finally{setBusy(false);}
 };
 if(!user)return <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-200">Sign in to save and open your My Web links.</div>;
 const filtered=links.filter(link=>link.name.toLowerCase().includes(search.trim().toLowerCase()));
 return <div className="space-y-5">
  <div className="flex flex-wrap justify-between items-center gap-3">
   <div><h2 className="flex items-center gap-2 text-2xl font-bold text-white"><Globe className="text-blue-400" />My Web</h2>
   <p className="mt-1 text-sm text-slate-400">Your daily websites. Click a name to open it in a new tab.</p></div>
   <button disabled={!ready||busy} onClick={()=>{reset();setShowForm(true);setError('');setMessage('');}} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} />Add Website</button>
  </div>
  {!ready&&!error&&<p role="status" className="text-sm text-slate-400">Connecting to your saved websites…</p>}
  {error&&<p role="alert" className="rounded-lg border border-rose-700 bg-slate-900 p-3 text-rose-300">{error}</p>}
  {message&&<p role="status" className="text-sm text-emerald-400">{message}</p>}
  {showForm&&<form onSubmit={save} className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
   <h3 className="font-bold text-white">{editing?'Edit website':'Add website'}</h3>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm text-slate-300">Name<input required maxLength={100} value={name} onChange={event=>setName(event.target.value)} placeholder="e.g. Waybill" className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-white" /></label>
    <label className="text-sm text-slate-300">Paste URL<input required maxLength={2048} value={url} onChange={event=>setUrl(event.target.value)} placeholder="https://example.com" className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-white" /></label>
   </div>
   <p className="text-xs text-slate-400">Only the website name appears in your saved list.</p>
   <div className="flex gap-2"><button disabled={!ready||busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?'Saving…':'Save Website'}</button><button type="button" disabled={busy} onClick={reset} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300">Cancel</button></div>
  </form>}
  <input aria-label="Search My Web" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search website names…" className="w-full rounded-xl border border-slate-600 bg-slate-900 p-3 text-sm text-white" />
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
   {filtered.map(link=><div key={link.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 p-4">
    <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={'Open '+link.name+' in a new tab'} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2 text-base font-bold text-blue-300 hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"><Globe className="shrink-0" size={20}/><span className="break-words">{link.name}</span><ExternalLink className="shrink-0" size={14}/></a>
    <button disabled={!ready||busy} aria-label={'Edit '+link.name} onClick={()=>{setEditing(link.id);setName(link.name);setUrl(link.url);setShowForm(true);setError('');setMessage('');}} className="rounded p-2 text-slate-400 hover:text-white disabled:opacity-50"><Pencil size={15}/></button>
    <button disabled={!ready||busy} aria-label={'Remove '+link.name} onClick={()=>remove(link)} className="rounded p-2 text-slate-400 hover:text-rose-300 disabled:opacity-50"><Trash2 size={15}/></button>
   </div>)}
  </div>
  {ready&&!filtered.length&&<p className="py-8 text-center text-sm text-slate-400">{links.length?'No website names match your search.':'No websites saved yet. Select Add Website to create your first shortcut.'}</p>}
 </div>;
}
