import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  doc, updateDoc, serverTimestamp, query, orderBy 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  MapPin, Camera, Send, CheckCircle, 
  AlertCircle, Clock, Shield, Menu, X, 
  ChevronRight, FileText, Activity, Sparkles, Bot, Image as ImageIcon, Trash2, ExternalLink
} from 'lucide-react';

// ======================================================
// 1. CONFIGURATION SECTION (PASTE YOUR KEYS HERE)
// ======================================================

// [A] PASTE YOUR GEMINI API KEY HERE
const geminiApiKey = "AIzaSyDzeUTa5xx9dzYM-GV5T8-zbh-nvnFmGDc"; 

// [B] PASTE YOUR FIREBASE CONFIG HERE
const localFirebaseConfig = {
  apiKey: "AIzaSyDHIfMoyJbkQzMRIuQZC5BnI3Ksqy4lWI4",
  authDomain: "civic-tracker-ee0f5.firebaseapp.com",
  projectId: "civic-tracker-ee0f5",
  storageBucket: "civic-tracker-ee0f5.firebasestorage.app",
  messagingSenderId: "833930453728",
  appId: "1:833930453728:web:2ed1d3ce368dba4c9b6685"
};

// [C] LOCAL APP ID
const localAppId = 'civic-tracker-local';

// ======================================================
// END CONFIGURATION
// ======================================================


// --- Initialize Firebase ---
let app, auth, db, appId;

try {
  if (typeof __firebase_config !== 'undefined') {
    const envConfig = JSON.parse(__firebase_config);
    app = initializeApp(envConfig);
    appId = typeof __app_id !== 'undefined' ? __app_id.replace(/[^a-zA-Z0-9\-_]/g, '_') : 'civic-preview';
  } else {
    app = initializeApp(localFirebaseConfig);
    appId = localAppId;
  }
} catch (e) {
  app = initializeApp(localFirebaseConfig);
  appId = localAppId;
}

auth = getAuth(app);
db = getFirestore(app);

const getCollectionPath = () => collection(db, 'artifacts', appId, 'public', 'data', 'issues');
const getDocRef = (id) => doc(db, 'artifacts', appId, 'public', 'data', 'issues', id);


// --- Helper Functions ---
const callGemini = async (prompt, systemInstruction = "") => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        }),
      }
    );
    if (!response.ok) throw new Error("Gemini API Error");
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
  } catch (error) {
    console.error("AI Error:", error);
    return "AI Service Unavailable.";
  }
};

// Opens Google Maps with the location string
const openMap = (locationString) => {
  if (!locationString) return;
  
  // Check if we have GPS coordinates in the string
  const gpsMatch = locationString.match(/GPS: ([-\d.]+), ([-\d.]+)/);
  
  let url;
  if (gpsMatch) {
    // Use exact coordinates
    url = `https://www.google.com/maps?q=${gpsMatch[1]},${gpsMatch[2]}`;
  } else {
    // Search by address text
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationString)}`;
  }
  
  window.open(url, '_blank');
};


// --- COMPONENTS ---

const Navbar = ({ activeTab, setActiveTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menu = [
    { id: 'home', label: 'Home', icon: <MapPin size={18} /> },
    { id: 'report', label: 'Report', icon: <AlertCircle size={18} /> },
    { id: 'public', label: 'Dashboard', icon: <Activity size={18} /> },
    { id: 'admin', label: 'Admin', icon: <Shield size={18} /> },
  ];

  return (
    <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="bg-blue-500 p-1.5 rounded-lg"><MapPin className="text-white" size={24} /></div>
            <span className="font-bold text-xl">CivicFix</span>
          </div>
          <div className="hidden md:flex space-x-1">
            {menu.map((item) => (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${activeTab === item.id ? 'bg-slate-800 text-blue-400' : 'text-slate-300 hover:text-white'}`}>
                <span className="mr-2">{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
          <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>{isOpen ? <X /> : <Menu />}</button>
        </div>
      </div>
      {isOpen && (
        <div className="md:hidden bg-slate-800 border-t border-slate-700 p-2">
          {menu.map((item) => (
            <button key={item.id} onClick={() => {setActiveTab(item.id); setIsOpen(false)}} className="block w-full text-left px-3 py-3 text-slate-300 hover:text-white">{item.label}</button>
          ))}
        </div>
      )}
    </nav>
  );
};

const ReportIssue = ({ user, onSubmit }) => {
  const [form, setForm] = useState({ type: 'Pothole', description: '', location: '', userEmail: '', imageData: null });
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  const refine = async () => {
    if (!form.description) return;
    setRefining(true);
    const txt = await callGemini(`Rewrite this civic report to be professional and concise: "${form.description}"`);
    setForm(p => ({ ...p, description: txt.replace(/^"|"$/g, '') }));
    setRefining(false);
  };

  const locate = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported");
    setLocating(true);
    
    // Improved Geolocation Options
    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gps = `(GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)})`;
        setForm(p => ({ ...p, location: p.location ? `${p.location} ${gps}` : gps }));
        setLocating(false);
      },
      (err) => { 
        console.error(err);
        alert(`Location Error: ${err.message}. Please allow location access in your browser settings.`); 
        setLocating(false); 
      },
      options
    );
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f || f.size > 1000000) return alert("File too large (Max 1MB)");
    const r = new FileReader();
    r.onloadend = () => setForm(p => ({ ...p, imageData: r.result }));
    r.readAsDataURL(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await onSubmit({ ...form, status: 'Pending', userId: user.uid, createdAt: serverTimestamp(), comments: [] });
      setForm({ type: 'Pothole', description: '', location: '', userEmail: '', imageData: null });
      setMsg({ type: 'success', text: 'Report Submitted Successfully!' });
    } catch (e) { console.error(e); setMsg({ type: 'error', text: 'Failed to submit.' }); }
    setLoading(false);
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <div className="bg-blue-600 p-6"><h2 className="text-2xl font-bold text-white flex items-center"><FileText className="mr-2"/> Report Issue</h2></div>
        <form onSubmit={submit} className="p-6 space-y-6">
          {msg && <div className={`p-4 rounded-lg ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                {['Pothole','Garbage','Streetlight','Water','Noise'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Location</label>
              <div className="flex">
                <input required placeholder="Address or click Auto" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full px-4 py-2 border rounded-l-lg" />
                <button type="button" onClick={locate} disabled={locating} className="px-3 border border-l-0 bg-slate-50 rounded-r-lg hover:bg-slate-100 flex items-center min-w-[80px] justify-center text-sm">
                   {locating ? '...' : <><MapPin size={14} className="mr-1"/> Auto</>}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Click "Auto" to add your GPS coordinates.</p>
            </div>
          </div>

          <div><label className="block text-sm font-medium mb-2">Email</label><input required type="email" value={form.userEmail} onChange={e => setForm({...form, userEmail: e.target.value})} className="w-full px-4 py-2 border rounded-lg" /></div>
          
          <div>
            <div className="flex justify-between mb-2"><label className="text-sm font-medium">Description</label><button type="button" onClick={refine} disabled={refining || !form.description} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">✨ AI Fix</button></div>
            <textarea required rows={4} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Photo</label>
            <input type="file" ref={fileRef} accept="image/*" onChange={handleFile} className="hidden" />
            {!form.imageData ? 
              <div onClick={() => fileRef.current.click()} className="border-2 border-dashed p-6 text-center cursor-pointer hover:bg-slate-50 rounded-lg"><Camera className="mx-auto text-slate-400" /><span className="text-sm">Click to Upload</span></div> : 
              <div className="relative h-48 bg-slate-100 rounded-lg overflow-hidden"><img src={form.imageData} className="w-full h-full object-cover" /><button type="button" onClick={() => {setForm(p=>({...p, imageData: null})); fileRef.current.value=""}} className="absolute top-2 right-2 bg-white/90 p-2 rounded-full text-red-500"><Trash2 size={16}/></button></div>
            }
          </div>

          <button disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">{loading ? 'Sending...' : 'Submit Report'}</button>
        </form>
      </div>
    </div>
  );
};

const PublicDashboard = ({ issues }) => {
  const resolved = issues.filter(i => i.status === 'Resolved');
  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h2 className="text-3xl font-bold text-center mb-8">Community Dashboard</h2>
      <div className="grid grid-cols-3 gap-4 mb-8 text-center">
        <div className="bg-white p-4 rounded-xl shadow border"><div className="text-2xl font-bold text-blue-600">{issues.length}</div><div className="text-xs uppercase">Total</div></div>
        <div className="bg-white p-4 rounded-xl shadow border"><div className="text-2xl font-bold text-yellow-500">{issues.length - resolved.length}</div><div className="text-xs uppercase">Open</div></div>
        <div className="bg-white p-4 rounded-xl shadow border"><div className="text-2xl font-bold text-green-600">{resolved.length}</div><div className="text-xs uppercase">Fixed</div></div>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {resolved.map(i => (
          <div key={i.id} className="bg-white rounded-xl shadow border overflow-hidden">
            <div className="h-40 bg-slate-100 flex items-center justify-center">{i.imageData ? <img src={i.imageData} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-300"/>}</div>
            <div className="p-4">
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{i.type}</span>
              
              {/* CLICKABLE LOCATION */}
              <button onClick={() => openMap(i.location)} className="font-bold mt-2 truncate w-full text-left hover:text-blue-600 flex items-center group">
                <MapPin size={14} className="mr-1 text-slate-400 group-hover:text-blue-500" />
                {i.location}
              </button>
              
              <p className="text-sm text-slate-600 line-clamp-2 mt-2">{i.description}</p>
              <div className="mt-2 text-xs font-bold text-green-700 border border-green-200 bg-green-50 px-2 py-1 inline-block rounded">Resolved</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminDashboard = ({ issues, updateStatus }) => {
  const [pwd, setPwd] = useState('');
  const [auth, setAuth] = useState(false);
  const [ai, setAi] = useState({});
  const [loadId, setLoadId] = useState(null);

  const analyze = async (i) => {
    setLoadId(i.id);
    const res = await callGemini(`Analyze this issue: Type ${i.type}, Desc "${i.description}". Return format: Priority (High/Med/Low) | Department | 1 line summary.`);
    setAi(p => ({ ...p, [i.id]: res }));
    setLoadId(null);
  };

  if (!auth) return <div className="flex justify-center pt-20"><div className="bg-white p-8 rounded-xl shadow border w-80"><h2 className="text-xl font-bold mb-4 text-center">Admin Login</h2><input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} className="w-full border p-2 rounded mb-4" placeholder="admin123" /><button onClick={()=>pwd==='admin123'&&setAuth(true)} className="w-full bg-slate-900 text-white p-2 rounded">Login</button></div></div>;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h2 className="text-2xl font-bold mb-6">Manage Issues</h2>
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500"><tr><th className="p-3">Issue</th><th className="p-3">Details</th><th className="p-3">AI Triage</th><th className="p-3">Status</th></tr></thead>
          <tbody className="divide-y">
            {issues.map(i => (
              <tr key={i.id}>
                <td className="p-3">
                    <div className="font-bold text-sm">{i.type}</div>
                    <div className="text-xs text-slate-500">{i.createdAt?.seconds ? new Date(i.createdAt.seconds*1000).toLocaleDateString() : 'Now'}</div>
                </td>
                <td className="p-3 max-w-xs text-sm">
                  {/* CLICKABLE LOCATION */}
                  <button onClick={() => openMap(i.location)} className="font-semibold hover:text-blue-600 flex items-center mb-1 text-left">
                     {i.location} <ExternalLink size={12} className="ml-1 opacity-50" />
                  </button>
                  <div className="truncate text-slate-600">{i.description}</div>
                </td>
                <td className="p-3 w-64">{ai[i.id] ? <div className="bg-purple-50 p-2 rounded text-xs text-purple-900 border border-purple-100">{ai[i.id]}</div> : <button onClick={()=>analyze(i)} disabled={loadId===i.id} className="text-xs bg-slate-100 px-2 py-1 rounded">{loadId===i.id?'...':'⚡ Analyze'}</button>}</td>
                <td className="p-3"><select value={i.status} onChange={e=>updateStatus(i.id, e.target.value, i.userEmail)} className="border rounded text-sm p-1"><option>Pending</option><option>In Progress</option><option>Resolved</option></select></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Chatbot = ({ issues }) => {
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState([{id:0, from:'bot', text:'Ask me about issues!'}]);
  const [typing, setTyping] = useState(false);
  const endRef = useRef(null);
  useEffect(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),[msgs]);

  const send = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setMsgs(p => [...p, {id:Date.now(), from:'user', text:q}]);
    const prompt = q; setQ(''); setTyping(true);
    try {
      const ctx = issues.slice(0,10).map(i=>`[${i.status}] ${i.type} at ${i.location}`).join('\n');
      const ans = await callGemini(prompt, `Context:\n${ctx}\nAnswer based on this.`);
      setMsgs(p => [...p, {id:Date.now()+1, from:'bot', text:ans}]);
    } catch { setMsgs(p => [...p, {id:Date.now()+1, from:'bot', text:"Error."}]); }
    setTyping(false);
  };

  return (
    <div className="bg-white rounded-xl shadow border h-[400px] flex flex-col">
      <div className="bg-slate-900 text-white p-3 rounded-t-xl font-bold flex items-center"><Bot size={18} className="mr-2"/> Civic AI</div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
        {msgs.map(m=><div key={m.id} className={`flex ${m.from==='user'?'justify-end':''}`}><div className={`p-2 rounded-lg text-sm max-w-[85%] ${m.from==='user'?'bg-blue-600 text-white':'bg-white border'}`}>{m.text}</div></div>)}
        {typing && <div className="text-xs text-slate-400 ml-2">...</div>}
        <div ref={endRef}/>
      </div>
      <form onSubmit={send} className="p-2 border-t flex"><input value={q} onChange={e=>setQ(e.target.value)} className="flex-1 border rounded px-2" placeholder="Type..." /><button className="ml-2 bg-blue-600 text-white px-3 rounded"><Send size={16}/></button></form>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('home');
  const [issues, setIssues] = useState([]);
  const [toast, setToast] = useState(null);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    init();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(getCollectionPath());
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const list = snapshot.docs.map(d => ({id:d.id, ...d.data()}));
        list.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setIssues(list);
        setPermissionError(false);
      },
      (error) => {
        console.error("Fetch Error:", error);
        if (error.code === 'permission-denied') setPermissionError(true);
      }
    );
    return () => unsubscribe();
  }, [user]);

  const add = async (d) => await addDoc(getCollectionPath(), d);
  const update = async (id, s, email) => {
    await updateDoc(getDocRef(id), { status: s });
    setToast(`Status: ${s}`); setTimeout(()=>setToast(null), 3000);
  };

  if (!user) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar activeTab={tab} setActiveTab={setTab} />
      
      {permissionError && <div className="bg-red-600 text-white px-4 py-2 text-center text-sm font-bold">Database Locked. Enable Test Mode in Firebase Console.</div>}

      {toast && <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded shadow-lg z-50">{toast}</div>}
      <main>
        {tab === 'home' && (
          <div className="max-w-6xl mx-auto px-4 py-12 grid lg:grid-cols-2 gap-12">
            <div>
              <h1 className="text-4xl font-extrabold mb-6">Civic<span className="text-blue-600">Fix</span></h1>
              <p className="text-lg text-slate-600 mb-6">Report issues. Track fixes. Powered by AI.</p>
              <div className="flex gap-4"><button onClick={()=>setTab('report')} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold">Report Now</button><button onClick={()=>setTab('public')} className="bg-white border px-6 py-3 rounded-lg font-bold">Dashboard</button></div>
            </div>
            <div className="hidden lg:block"><Chatbot issues={issues}/></div>
            <div className="lg:hidden mt-8"><Chatbot issues={issues}/></div>
          </div>
        )}
        {tab === 'report' && <ReportIssue user={user} onSubmit={add} />}
        {tab === 'public' && <PublicDashboard issues={issues} />}
        {tab === 'admin' && <AdminDashboard issues={issues} updateStatus={update} />}
      </main>
    </div>
  );
}