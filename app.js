// ── CaptionWare — App Logic ─────────────────────────────

// ── State ────────────────────────────────────────────────
const S = {
  screen: "home",
  file: null,
  url: null,
  chunks: [],
  settings: {
    lang: "auto",
    model: "Xenova/whisper-tiny",
    font: "DM Sans, sans-serif",
    size: 26,
    color: "#FFFFFF",
    bg: "rgba(0,0,0,0.65)",
    pos: "bottom",
    bold: false,
    italic: false,
  },
};

let worker = null;
let db = null;

// ── DB (IndexedDB) ────────────────────────────────────────
async function initDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open("captionware", 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore("history", {
        keyPath: "id",
        autoIncrement: true,
      });
    };
    req.onsuccess = (e) => { db = e.target.result; res(); };
    req.onerror = rej;
  });
}

async function dbAdd(item) {
  return new Promise((res, rej) => {
    const tx = db.transaction("history", "readwrite");
    const req = tx.objectStore("history").add(item);
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
}

async function dbGetAll() {
  return new Promise((res, rej) => {
    const tx = db.transaction("history", "readonly");
    const req = tx.objectStore("history").getAll();
    req.onsuccess = () => res(req.result.reverse());
    req.onerror = rej;
  });
}

async function dbClear() {
  return new Promise((res, rej) => {
    const tx = db.transaction("history", "readwrite");
    const req = tx.objectStore("history").clear();
    req.onsuccess = res;
    req.onerror = rej;
  });
}

// ── Navigation ────────────────────────────────────────────
function navigate(to) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + to).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.screen === to);
  });
  S.screen = to;
  if (to === "history") renderHistory();
}

// ── Toast ─────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2800);
}

// ── Overlay ───────────────────────────────────────────────
function showOverlay(title, msg, pct = 0) {
  document.getElementById("overlay").classList.remove("hidden");
  document.getElementById("overlayTitle").textContent = title;
  document.getElementById("overlayMsg").textContent = msg;
  setProgress(pct);
}

function hideOverlay() {
  document.getElementById("overlay").classList.add("hidden");
}

function setProgress(pct, msg) {
  document.getElementById("progFill").style.width = pct + "%";
  document.getElementById("progPct").textContent = Math.round(pct) + "%";
  if (msg) document.getElementById("overlayMsg").textContent = msg;
}

// ── File Import ───────────────────────────────────────────
function handleFile(file) {
  if (!file || !file.type.startsWith("video/")) {
    toast("❌ Please select a valid video file");
    return;
  }
  if (S.url) URL.revokeObjectURL(S.url);
  S.file = file;
  S.url = URL.createObjectURL(file);
  S.chunks = [];

  // Set preview
  document.getElementById("previewVid").src = S.url;
  document.getElementById("previewName").textContent = file.name;
  document.getElementById("previewSize").textContent =
    (file.size / 1048576).toFixed(1) + " MB";

  navigate("configure");
}

// ── Settings Sync ─────────────────────────────────────────
function bindSettings() {
  // Language
  document.getElementById("langSelect").addEventListener("change", (e) => {
    S.settings.lang = e.target.value;
  });

  // Model
  document.querySelectorAll('input[name="model"]').forEach((r) => {
    r.addEventListener("change", (e) => { S.settings.model = e.target.value; });
  });

  // Font
  document.getElementById("fontSelect").addEventListener("change", (e) => {
    S.settings.font = e.target.value;
  });

  // Size slider
  const slider = document.getElementById("sizeSlider");
  const sizeVal = document.getElementById("sizeVal");
  slider.addEventListener("input", (e) => {
    S.settings.size = parseInt(e.target.value);
    sizeVal.textContent = e.target.value + "px";
    const pct = ((e.target.value - 14) / (52 - 14)) * 100;
    slider.style.background = `linear-gradient(to right, var(--p) ${pct}%, var(--border) ${pct}%)`;
  });

  // Color swatches
  document.querySelectorAll(".color-swatch[data-color]").forEach((sw) => {
    sw.addEventListener("click", () => {
      document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
      sw.classList.add("active");
      S.settings.color = sw.dataset.color;
    });
  });
  document.getElementById("customColor").addEventListener("input", (e) => {
    S.settings.color = e.target.value;
    document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
    document.querySelector(".custom-color").classList.add("active");
  });

  // Background
  document.querySelectorAll('input[name="bg"]').forEach((r) => {
    r.addEventListener("change", (e) => { S.settings.bg = e.target.value; });
  });

  // Position
  document.querySelectorAll('input[name="pos"]').forEach((r) => {
    r.addEventListener("change", (e) => { S.settings.pos = e.target.value; });
  });

  // Bold / Italic
  ["bold", "italic"].forEach((key) => {
    const btn = document.getElementById(key + "Toggle");
    btn.addEventListener("click", () => {
      S.settings[key] = !S.settings[key];
      btn.classList.toggle("active", S.settings[key]);
    });
  });
}

// ── Worker ────────────────────────────────────────────────
function initWorker() {
  if (worker) worker.terminate();
  worker = new Worker("worker.js", { type: "module" });

  worker.onmessage = (e) => {
    const { type, data } = e.data;

    if (type === "progress") {
      const pct = data.progress ? data.progress * 100 : 0;
      const status = data.status || "";
      if (status === "download") {
        setProgress(pct * 0.6, "Downloading AI model… " + Math.round(pct) + "%");
      } else if (status === "initiate") {
        setProgress(60, "Loading model into memory…");
      } else if (status === "ready") {
        setProgress(70, "Extracting audio…");
      }
    } else if (type === "result") {
      S.chunks = data.chunks || [];
      setProgress(100, "Done!");
      setTimeout(() => {
        hideOverlay();
        saveHistory();
        openPlayer();
      }, 600);
    } else if (type === "error") {
      hideOverlay();
      toast("❌ Error: " + data);
    } else if (type === "audio_needed") {
      extractAndSendAudio();
    }
  };
}

async function extractAndSendAudio() {
  try {
    setProgress(72, "Extracting audio from video…");
    const arrayBuf = await S.file.arrayBuffer();
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
    const float32 = audioBuf.getChannelData(0); // mono
    worker.postMessage({ type: "audio", data: float32, settings: S.settings });
    setProgress(80, "AI is transcribing… (may take a few minutes)");
    audioCtx.close();
  } catch (err) {
    hideOverlay();
    toast("❌ Could not extract audio: " + err.message);
  }
}

function startTranscription() {
  showOverlay("Generating Captions", "Initialising AI model…", 10);
  initWorker();
  worker.postMessage({ type: "load", model: S.settings.model });
}

// ── Player ────────────────────────────────────────────────
function openPlayer() {
  const vid = document.getElementById("mainVid");
  vid.src = S.url;

  applySubtitleStyle();
  renderTranscript();
  navigate("player");

  vid.addEventListener("timeupdate", () => syncSubs(vid.currentTime), { passive: true });
}

function applySubtitleStyle() {
  const box = document.getElementById("subtitleBox");
  const overlay = document.getElementById("subtitleOverlay");
  const st = S.settings;

  box.style.fontFamily = st.font;
  box.style.fontSize = st.size + "px";
  box.style.color = st.color;
  box.style.background = st.bg;
  box.style.fontWeight = st.bold ? "700" : "500";
  box.style.fontStyle = st.italic ? "italic" : "normal";

  overlay.className = "subtitle-overlay pos-" + st.pos;
}

function syncSubs(t) {
  if (!S.chunks.length) return;
  const box = document.getElementById("subtitleBox");

  const chunk = S.chunks.find(
    (c) => c.timestamp && t >= c.timestamp[0] && t <= (c.timestamp[1] || c.timestamp[0] + 1.5)
  );

  if (chunk) {
    box.textContent = chunk.text.trim();
    box.style.opacity = "1";

    // Highlight in transcript
    document.querySelectorAll(".transcript-word").forEach((w, i) => {
      w.classList.toggle("active", S.chunks[i] === chunk);
    });

    // Scroll active word into view
    const activeWord = document.querySelector(".transcript-word.active");
    if (activeWord) {
      activeWord.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  } else {
    box.style.opacity = "0.1";
    box.textContent = "";
  }
}

function renderTranscript() {
  const div = document.getElementById("transcriptText");
  div.innerHTML = "";
  S.chunks.forEach((c, i) => {
    const span = document.createElement("span");
    span.className = "transcript-word";
    span.textContent = c.text;
    span.dataset.idx = i;
    span.addEventListener("click", () => {
      const vid = document.getElementById("mainVid");
      if (c.timestamp) vid.currentTime = c.timestamp[0];
    });
    div.appendChild(span);
  });
}

// ── SRT Download ──────────────────────────────────────────
function downloadSRT() {
  if (!S.chunks.length) { toast("No captions yet!"); return; }
  const toSRTTime = (s) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    const ms = Math.round((s % 1) * 1000).toString().padStart(3, "0");
    return `${h}:${m}:${sec},${ms}`;
  };
  let srt = "";
  S.chunks.forEach((c, i) => {
    const start = c.timestamp ? c.timestamp[0] : i;
    const end = c.timestamp ? (c.timestamp[1] || start + 1.5) : i + 1.5;
    srt += `${i + 1}\n${toSRTTime(start)} --> ${toSRTTime(end)}\n${c.text.trim()}\n\n`;
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([srt], { type: "text/plain" }));
  a.download = (S.file?.name?.replace(/\.[^.]+$/, "") || "captions") + ".srt";
  a.click();
  toast("✅ SRT file downloaded!");
}

// ── History ───────────────────────────────────────────────
async function saveHistory() {
  if (!S.file || !S.chunks.length) return;
  try {
    await dbAdd({
      name: S.file.name,
      size: S.file.size,
      lang: S.settings.lang,
      chunks: S.chunks,
      createdAt: new Date().toISOString(),
    });
  } catch (_) {}
}

async function renderHistory() {
  const list = document.getElementById("historyList");
  const items = await dbGetAll();
  if (!items.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <p>No videos processed yet.<br/>Import a video to get started.</p>
    </div>`;
    return;
  }
  list.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "hist-card";
    const date = new Date(item.createdAt).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
    card.innerHTML = `
      <div class="hist-thumb-ph">🎬</div>
      <div class="hist-info">
        <div class="hist-name">${item.name}</div>
        <div class="hist-meta">${item.lang.toUpperCase()} · ${item.chunks?.length || 0} segments · ${date}</div>
      </div>
      <span class="hist-arrow">›</span>`;
    list.appendChild(card);
  });
}

// ── Init ──────────────────────────────────────────────────
async function init() {
  await initDB();

  // Nav buttons
  document.querySelectorAll(".nav-btn[data-screen]").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.screen));
  });

  // Back buttons
  document.getElementById("configBack").addEventListener("click", () => navigate("home"));
  document.getElementById("playerBack").addEventListener("click", () => navigate("configure"));

  // File import
  const input = document.getElementById("videoInput");
  document.getElementById("browseBtn").addEventListener("click", () => input.click());
  input.addEventListener("change", (e) => handleFile(e.target.files[0]));

  // Drag & drop
  const dz = document.getElementById("dropZone");
  dz.addEventListener("click", (e) => { if (!e.target.closest("button")) input.click(); });
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag-over"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("drag-over");
    handleFile(e.dataTransfer.files[0]);
  });

  // Generate
  document.getElementById("generateBtn").addEventListener("click", startTranscription);

  // SRT download
  document.getElementById("downloadSrt").addEventListener("click", downloadSRT);

  // Clear history
  document.getElementById("clearHistBtn").addEventListener("click", async () => {
    await dbClear();
    renderHistory();
    toast("🗑️ History cleared");
  });

  bindSettings();
}

document.addEventListener("DOMContentLoaded", init);
