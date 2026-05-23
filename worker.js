// ── CaptionWare — Whisper Web Worker ────────────────────
import {
  pipeline,
  env,
} from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;
let modelName = "Xenova/whisper-tiny";

// Progress callback → send to main thread
function onProgress(progress) {
  self.postMessage({ type: "progress", data: progress });
}

self.onmessage = async (e) => {
  const { type, data, model, settings } = e.data;

  if (type === "load") {
    modelName = model || modelName;
    try {
      transcriber = await pipeline(
        "automatic-speech-recognition",
        modelName,
        { progress_callback: onProgress }
      );
      // Signal main thread to send audio
      self.postMessage({ type: "audio_needed" });
    } catch (err) {
      self.postMessage({ type: "error", data: err.message });
    }
  }

  if (type === "audio") {
    try {
      const lang = settings?.lang === "auto" ? null : settings?.lang;
      const result = await transcriber(data, {
        return_timestamps: "word",
        language: lang,
        task: "transcribe",
        chunk_length_s: 30,
        stride_length_s: 5,
      });

      // Normalise chunks
      const chunks = (result.chunks || [{ text: result.text, timestamp: [0, null] }]).map((c) => ({
        text: c.text || "",
        timestamp: c.timestamp || [0, null],
      }));

      self.postMessage({ type: "result", data: { chunks, text: result.text } });
    } catch (err) {
      self.postMessage({ type: "error", data: err.message });
    }
  }
};
