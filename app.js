// CaptionWare v2 - app.js
const S={screen:"home",file:null,url:null,chunks:[],settings:{lang:"auto",model:"Xenova/whisper-tiny",font:"DM Sans, sans-serif",size:26,color:"#FFFFFF",bg:"none",pos:"bottom",bold:false,italic:false,textStyle:"clean"}};
let worker=null,db=null;

async function initDB(){
  return new Promise((res,rej)=>{
    const req=indexedDB.open("captionware",2);
    req.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains("history"))d.createObjectStore("history",{keyPath:"id",autoIncrement:true});};
    req.onsuccess=e=>{db=e.target.result;res();};
    req.onerror=rej;
  });
}
async function dbAdd(item){return new Promise((res,rej)=>{const tx=db.transaction("history","readwrite");tx.objectStore("history").add(item).onsuccess=e=>res(e.target.result);tx.onerror=rej;});}
async function dbGetAll(){return new Promise((res,rej)=>{const tx=db.transaction("history","readonly");const req=tx.objectStore("history").getAll();req.onsuccess=()=>res(req.result.reverse());req.onerror=rej;});}
async function dbClear(){return new Promise((res,rej)=>{const tx=db.transaction("history","readwrite");tx.objectStore("history").clear().onsuccess=res;tx.onerror=rej;});}

function navigate(to){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById("screen-"+to).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.screen===to));
  S.screen=to;
  if(to==="history")renderHistory();
}

let toastT;
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.remove("hidden");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.add("hidden"),2800);}
function showOverlay(t,m,p){document.getElementById("overlay").classList.remove("hidden");document.getElementById("overlayTitle").textContent=t;document.getElementById("overlayMsg").textContent=m;setProgress(p||0);}
function hideOverlay(){document.getElementById("overlay").classList.add("hidden");}
function setProgress(p,m){document.getElementById("progFill").style.width=p+"%";document.getElementById("progPct").textContent=Math.round(p)+"%";if(m)document.getElementById("overlayMsg").textContent=m;}

function getStyleCSS(ts,color){
  const styles={
    clean:        {textShadow:"none",stroke:"0px"},
    outline:      {textShadow:"none",stroke:"2px rgba(0,0,0,0.85)"},
    shadow:       {textShadow:"2px 3px 10px rgba(0,0,0,0.95),0 0 20px rgba(0,0,0,0.6)",stroke:"0px"},
    glow:         {textShadow:"0 0 8px "+color+",0 0 20px "+color+",0 0 40px "+color,stroke:"0px"},
    neon:         {textShadow:"0 0 5px "+color+",0 0 15px "+color+",0 0 30px "+color+",2px 2px 0 #000",stroke:"0px"},
    "bold-shadow":{textShadow:"3px 3px 0 rgba(0,0,0,0.9),-1px -1px 0 rgba(0,0,0,0.5)",stroke:"0px"}
  };
  return styles[ts]||styles.clean;
}
function getBgCSS(bg){
  const bgs={
    none: {background:"transparent",padding:"2px 0",borderRadius:"0"},
    dark: {background:"rgba(0,0,0,0.65)",padding:"6px 14px",borderRadius:"8px"},
    solid:{background:"rgba(0,0,0,0.92)",padding:"6px 14px",borderRadius:"8px"}
  };
  return bgs[bg]||bgs.none;
}

function applyToElement(el,st){
  const sc=getStyleCSS(st.textStyle,st.color);
  const bc=getBgCSS(st.bg);
  el.style.fontFamily=st.font;
  el.style.fontSize=st.size+"px";
  el.style.color=st.color;
  el.style.fontWeight=st.bold?"700":"600";
  el.style.fontStyle=st.italic?"italic":"normal";
  el.style.textShadow=sc.textShadow;
  el.style.webkitTextStroke=sc.stroke;
  el.style.background=bc.background;
  el.style.padding=bc.padding;
  el.style.borderRadius=bc.borderRadius;
}

function updatePreview(){const el=document.getElementById("captionPreviewText");if(el)applyToElement(el,S.settings);}

function handleFile(file){
  if(!file||!file.type.startsWith("video/")){toast("Valid video file select karein");return;}
  if(S.url)URL.revokeObjectURL(S.url);
  S.file=file;S.url=URL.createObjectURL(file);S.chunks=[];
  document.getElementById("previewVid").src=S.url;
  document.getElementById("previewName").textContent=file.name;
  document.getElementById("previewSize").textContent=(file.size/1048576).toFixed(1)+" MB";
  navigate("configure");
}

function bindSettings(){
  const upd=(k,v)=>{S.settings[k]=v;updatePreview();};
  document.getElementById("langSelect").addEventListener("change",e=>upd("lang",e.target.value));
  document.querySelectorAll('input[name="model"]').forEach(r=>r.addEventListener("change",e=>upd("model",e.target.value)));
  document.getElementById("fontSelect").addEventListener("change",e=>upd("font",e.target.value));
  const slider=document.getElementById("sizeSlider");
  slider.addEventListener("input",e=>{
    upd("size",parseInt(e.target.value));
    document.getElementById("sizeVal").textContent=e.target.value+"px";
    const pct=((e.target.value-14)/38)*100;
    slider.style.background="linear-gradient(to right,var(--p) "+pct+"%,var(--border) "+pct+"%)";
  });
  document.querySelectorAll('input[name="textstyle"]').forEach(r=>r.addEventListener("change",e=>upd("textStyle",e.target.value)));
  document.querySelectorAll(".color-swatch[data-color]").forEach(sw=>{
    sw.addEventListener("click",()=>{
      document.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("active"));
      sw.classList.add("active");
      upd("color",sw.dataset.color);
    });
  });
  document.getElementById("customColor").addEventListener("input",e=>{
    upd("color",e.target.value);
    document.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("active"));
    document.querySelector(".custom-color").classList.add("active");
  });
  document.querySelectorAll('input[name="bg"]').forEach(r=>r.addEventListener("change",e=>upd("bg",e.target.value)));
  document.querySelectorAll('input[name="pos"]').forEach(r=>r.addEventListener("change",e=>upd("pos",e.target.value)));
  ["bold","italic"].forEach(key=>{
    const btn=document.getElementById(key+"Toggle");
    btn.addEventListener("click",()=>{S.settings[key]=!S.settings[key];btn.classList.toggle("active",S.settings[key]);updatePreview();});
  });
}

function initWorker(){
  if(worker)worker.terminate();
  worker=new Worker("worker.js",{type:"module"});
  worker.onmessage=e=>{
    const{type,data}=e.data;
    if(type==="progress"){
      const p=data.progress?data.progress*100:0;
      if(data.status==="download")setProgress(p*0.6,"Downloading model... "+Math.round(p)+"%");
      else if(data.status==="initiate")setProgress(60,"Loading model...");
      else if(data.status==="ready")setProgress(70,"Extracting audio...");
    }else if(type==="audio_needed"){
      extractAndSendAudio();
    }else if(type==="result"){
      S.chunks=data.chunks||[];
      setProgress(100,"Done!");
      setTimeout(()=>{hideOverlay();saveHistory();openPlayer();},600);
    }else if(type==="error"){
      hideOverlay();toast("Error: "+data);
    }
  };
}

async function extractAndSendAudio(){
  try{
    setProgress(72,"Extracting audio...");
    const ab=await S.file.arrayBuffer();
    const ctx=new AudioContext({sampleRate:16000});
    const buf=await ctx.decodeAudioData(ab);
    const f32=buf.getChannelData(0);
    worker.postMessage({type:"audio",data:f32,settings:S.settings});
    setProgress(80,"AI transcribing...");
    ctx.close();
  }catch(err){hideOverlay();toast("Audio error: "+err.message);}
}

function startTranscription(){
  showOverlay("Generating Captions","Initialising AI...",10);
  initWorker();
  worker.postMessage({type:"load",model:S.settings.model});
}

function openPlayer(){
  document.getElementById("mainVid").src=S.url;
  applySubtitleStyle();
  renderTranscript();
  navigate("player");
  document.getElementById("mainVid").addEventListener("timeupdate",()=>syncSubs(document.getElementById("mainVid").currentTime),{passive:true});
}

function applySubtitleStyle(){
  applyToElement(document.getElementById("subtitleBox"),S.settings);
  document.getElementById("subtitleOverlay").className="subtitle-overlay pos-"+S.settings.pos;
}

function syncSubs(t){
  if(!S.chunks.length)return;
  const box=document.getElementById("subtitleBox");
  const chunk=S.chunks.find(c=>c.timestamp&&t>=c.timestamp[0]&&t<=(c.timestamp[1]||c.timestamp[0]+2));
  if(chunk){
    box.textContent=chunk.text.trim();
    box.style.opacity="1";
    document.querySelectorAll(".transcript-word").forEach((w,i)=>w.classList.toggle("active",S.chunks[i]===chunk));
    const aw=document.querySelector(".transcript-word.active");
    if(aw)aw.scrollIntoView({behavior:"smooth",block:"nearest"});
  }else{box.style.opacity="0";box.textContent="";}
}

function renderTranscript(){
  const div=document.getElementById("transcriptText");
  div.innerHTML="";
  S.chunks.forEach((c,i)=>{
    const span=document.createElement("span");
    span.className="transcript-word";
    span.textContent=(i>0?" ":"")+c.text.trim();
    span.addEventListener("click",()=>{if(c.timestamp)document.getElementById("mainVid").currentTime=c.timestamp[0];});
    div.appendChild(span);
  });
}

function downloadSRT(){
  if(!S.chunks.length){toast("Pehle captions generate karein!");return;}
  const ts=s=>{const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=Math.floor(s%60),ms=Math.round((s%1)*1000);return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(sc).padStart(2,"0")+","+String(ms).padStart(3,"0");};
  let srt="";
  S.chunks.forEach((c,i)=>{
    const st=c.timestamp?c.timestamp[0]:i;
    const en=c.timestamp?(c.timestamp[1]||st+2):st+2;
    srt+=(i+1)+"\n"+ts(st)+" --> "+ts(en)+"\n"+c.text.trim()+"\n\n";
  });
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([srt],{type:"text/plain"}));
  a.download=(S.file?.name?.replace(/\.[^.]+$/,"")||"captions")+".srt";
  a.click();toast("SRT downloaded!");
}

async function saveHistory(){
  if(!S.file||!S.chunks.length)return;
  try{await dbAdd({name:S.file.name,size:S.file.size,lang:S.settings.lang,chunks:S.chunks,createdAt:new Date().toISOString()});}catch(_){}
}

async function renderHistory(){
  const list=document.getElementById("historyList");
  const items=await dbGetAll();
  if(!items.length){list.innerHTML='<div class="empty-state"><div class="empty-icon">&#128203;</div><p>No videos yet.</p></div>';return;}
  list.innerHTML="";
  items.forEach(item=>{
    const card=document.createElement("div");card.className="hist-card";
    const date=new Date(item.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
    card.innerHTML='<div class="hist-thumb-ph">&#127916;</div><div class="hist-info"><div class="hist-name">'+item.name+'</div><div class="hist-meta">'+((item.lang||"auto").toUpperCase())+' - '+(item.chunks?.length||0)+' segs - '+date+'</div></div><span class="hist-arrow">&#x203A;</span>';
    list.appendChild(card);
  });
}

async function init(){
  await initDB();
  document.querySelectorAll(".nav-btn[data-screen]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.screen)));
  document.getElementById("configBack").addEventListener("click",()=>navigate("home"));
  document.getElementById("playerBack").addEventListener("click",()=>navigate("configure"));
  const input=document.getElementById("videoInput");
  document.getElementById("browseBtn").addEventListener("click",()=>input.click());
  input.addEventListener("change",e=>handleFile(e.target.files[0]));
  const dz=document.getElementById("dropZone");
  dz.addEventListener("click",e=>{if(!e.target.closest("button"))input.click();});
  dz.addEventListener("dragover",e=>{e.preventDefault();dz.classList.add("drag-over");});
  dz.addEventListener("dragleave",()=>dz.classList.remove("drag-over"));
  dz.addEventListener("drop",e=>{e.preventDefault();dz.classList.remove("drag-over");handleFile(e.dataTransfer.files[0]);});
  document.getElementById("generateBtn").addEventListener("click",startTranscription);
  document.getElementById("downloadSrt").addEventListener("click",downloadSRT);
  document.getElementById("clearHistBtn").addEventListener("click",async()=>{await dbClear();renderHistory();toast("History cleared");});
  bindSettings();
  updatePreview();
}

document.addEventListener("DOMContentLoaded",init);
