import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

// per Koyeb-Umgebungsvariablen setzen:
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;            // Azure Speech Key
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || "westeurope";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: CORS_ORIGIN }));

app.get("/", (_req, res) => {
  res.type("text/plain").send("Azure TTS proxy OK");
});

// POST /tts  ->  { text, voiceId, format }  =>  { audioBase64, mime }
app.post("/tts", async (req, res) => {
  try {
    if (!AZURE_SPEECH_KEY) return res.status(500).json({ error: "AZURE_SPEECH_KEY not set" });
    const { text, voiceId = "de-DE-AmalaNeural", format = "audio/mp3" } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: "Missing text" });

    const azureFormat =
      format === "audio/wav" ? "riff-16khz-16bit-mono-pcm" :
      format === "audio/ogg" ? "ogg-24khz-16bit-mono-opus" :
      "audio-24khz-48kbitrate-mono-mp3";

    const ssml = `
      <speak version="1.0" xml:lang="de-DE">
        <voice name="${voiceId}">${escapeXml(text)}</voice>
      </speak>`.trim();

    const url = `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": azureFormat,
        "User-Agent": "azure-tts-proxy"
      },
      body: ssml
    });

    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return res.status(500).json({ error: "Azure TTS error", status: r.status, body });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    const mime =
      format === "audio/wav" ? "audio/wav" :
      format === "audio/ogg" ? "audio/ogg" :
      "audio/mpeg";

    res.json({ mime, audioBase64: buf.toString("base64") });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error", detail: String(e) });
  }
});

app.listen(PORT, () => console.log(`Azure TTS proxy listening on :${PORT}`));

function escapeXml(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
