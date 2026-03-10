import { useState, useRef, useEffect, useCallback } from "react";

// ─── MODELS (Pollinations - all free, confirmed working) ─────────────────────
const MODELS = [
  {
    id: "flux",
    name: "FLUX Dev",
    short: "FLUX",
    stars: 4,
    icon: "⚡",
    color: "#60a5fa",
    badge: "✅ STABLE",
    desc: "Reliable, all-purpose. Confirm working 100%.",
    fabric: 4, realism: 4, speed: 3,
  },
  {
    id: "turbo",
    name: "FLUX Turbo",
    short: "Turbo",
    stars: 3,
    icon: "💨",
    color: "#34d399",
    badge: "⚡ LAJU",
    desc: "Paling laju ~3s. Sesuai untuk preview & draft.",
    fabric: 3, realism: 3, speed: 5,
  },
  {
    id: "kontext",
    name: "FLUX Kontext",
    short: "Kontext",
    stars: 5,
    icon: "🏆",
    color: "#f59e0b",
    badge: "👑 TERBAIK FREE",
    desc: "Terbaik dalam free tier. Fabric detail & consistency power.",
    fabric: 5, realism: 4, speed: 4,
  },
  {
    id: "gptimage",
    name: "GPT Image",
    short: "GPT-Img",
    stars: 4,
    icon: "🤖",
    color: "#a78bfa",
    badge: "🎯 PROMPT IKUT",
    desc: "Paling ikut prompt dengan tepat. Bagus untuk scene specific.",
    fabric: 4, realism: 4, speed: 3,
  },
];

const STYLES = [
  { emoji: "📸", label: "Realistic", val: "photorealistic, ultra detailed, professional photography, 8k, skin pores visible, shot on Canon EOS R5, 85mm f1.4 lens, natural skin texture" },
  { emoji: "👗", label: "Fashion", val: "editorial fashion photography, soft natural light, fabric weave texture clearly visible, lifestyle, model wearing outfit, magazine quality" },
  { emoji: "✨", label: "Glamour", val: "glamour photography, dramatic studio lighting, luxury aesthetic, high fashion editorial, catch light in eyes, subsurface scattering skin" },
  { emoji: "🌸", label: "Soft", val: "soft pastel aesthetic, dreamy bokeh, feminine, warm golden tones, Instagram worthy, gentle diffused light" },
  { emoji: "🔥", label: "Cinematic", val: "cinematic photography, moody dramatic lighting, film grain, anamorphic lens flare, color graded, movie still" },
  { emoji: "🛒", label: "Shopee", val: "clean e-commerce product photography, pure white background, sharp focus all details, commercial grade, centered composition" },
];

const STRUCTURES = {
  "4j": { label: "🛍️ Jualan 4 Scene", scenes: ["🪝 Hook", "😣 Problem", "✅ Solusi", "📣 CTA"], durations: ["6s", "8s", "15s"] },
  "4s": { label: "📖 Storytelling 4", scenes: ["🪝 Hook", "💬 Cerita", "💡 Reveal", "📣 CTA"], durations: ["15s", "30s"] },
  "8p": { label: "🔥 Jualan Power 8", scenes: ["🪝 Hook", "😣 Problem", "😱 Climax", "⭐ Proof", "💎 USP", "⏰ Urgency", "✅ Solusi", "📣 CTA"], durations: ["30s", "60s"] },
  "8r": { label: "⭐ Review 8 Scene", scenes: ["🪝 Hook", "👀 First Look", "🔍 Features", "✨ Result", "⭐ Proof", "⚖️ Compare", "💰 Value", "📣 CTA"], durations: ["30s", "60s"] },
};

const CAPTION_TYPES = [
  { id: "viral", label: "🔥 Viral Hook" },
  { id: "review", label: "⭐ Review" },
  { id: "tutorial", label: "📚 Tutorial" },
  { id: "story", label: "💬 Story" },
  { id: "promo", label: "🎁 Promo" },
];

// ─── API HELPERS ────────────────────────────────────────────────────────────────────────────────

// OpenRouter API — free models, works from Netlify
async function callOpenRouter(apiKey, systemPrompt, userPrompt) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey,
      "HTTP-Referer": "https://fascinating-lollipop-3b83af.netlify.app",
      "X-Title": "KreatorAI"
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.9
    }),
  });
  const data = await res.json();
  if (data.error?.code === 402) throw new Error("Kredit habis. Top up kat openrouter.ai/credits");
  if (data.error) throw new Error(data.error.message || "OpenRouter error");
  const text = data.choices?.[0]?.message?.content || "";
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return text; }
}

async function callClaude(apiKey, system, userContent) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-5-20250929", max_tokens: 1000, system, messages: [{ role: "user", content: userContent }] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  let text = data.content?.map(b => b.text || "").join("") || "";
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return text; }
}

async function callAI(keys, system, userPrompt, imageDataList = []) {
  if (keys.openrouter) return callOpenRouter(keys.openrouter, system, userPrompt);
  if (keys.claude) {
    const content = imageDataList.length
      ? [...imageDataList.map(d => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: d } })),
         { type: "text", text: userPrompt }]
      : userPrompt;
    return callClaude(keys.claude, system, content);
  }
  throw new Error("NO_API_KEY");
}

function makeImgUrl(prompt, modelId, seed) {
  const m = MODELS.find(x => x.id === modelId)?.id || "kontext";
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=1366&seed=${seed}&nologo=true&enhance=true&model=${m}`;
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#07090e;--s1:#0f1219;--s2:#151a27;--s3:#1b2133;
  --b1:rgba(255,255,255,0.06);--b2:rgba(255,255,255,0.11);--b3:rgba(255,255,255,0.18);
  --accent:#f97316;--a2:#fb923c;
  --blue:#60a5fa;--green:#34d399;--gold:#fbbf24;--red:#f87171;--purple:#a78bfa;
  --text:#eef0ff;--m1:rgba(238,240,255,0.5);--m2:rgba(238,240,255,0.25);--m3:rgba(238,240,255,0.1);
}
body{font-family:'Plus Jakarta Sans',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased;}

/* NAV */
.nav{position:sticky;top:0;z-index:200;background:rgba(7,9,14,0.96);backdrop-filter:blur(24px);border-bottom:1px solid var(--b1);}
.nav-inner{max-width:900px;margin:0 auto;padding:0 16px;height:52px;display:flex;align-items:center;gap:8px;}
.logo{font-family:'Syne',sans-serif;font-size:17px;font-weight:800;letter-spacing:-0.02em;flex-shrink:0;white-space:nowrap;}
.logo em{font-style:normal;color:var(--accent);}
.nav-tabs{display:flex;gap:2px;flex:1;}
.ntab{padding:6px 12px;border-radius:8px;background:none;border:none;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:700;color:var(--m1);cursor:pointer;transition:all 0.15s;white-space:nowrap;}
.ntab:hover{color:var(--text);background:var(--m3);}
.ntab.active{color:var(--accent);background:rgba(249,115,22,0.1);}
.nav-right{margin-left:auto;display:flex;align-items:center;gap:6px;flex-shrink:0;}

/* API STATUS PILL */
.api-pill{display:flex;align-items:center;gap:5px;border-radius:100px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.15s;border:1px solid;}
.api-pill.ok{background:rgba(52,211,153,0.1);border-color:rgba(52,211,153,0.3);color:var(--green);}
.api-pill.warn{background:rgba(251,191,36,0.1);border-color:rgba(251,191,36,0.3);color:var(--gold);}
.api-pill.err{background:rgba(248,113,113,0.1);border-color:rgba(248,113,113,0.3);color:var(--red);}
.api-dot{width:6px;height:6px;border-radius:50%;background:currentColor;}

/* MODEL PILL */
.mpill{display:flex;align-items:center;gap:5px;background:var(--s2);border:1px solid var(--b2);border-radius:100px;padding:4px 8px 4px 9px;cursor:pointer;transition:all 0.18s;font-size:11px;font-weight:700;}
.mpill:hover{border-color:var(--accent);}
.mpill-tag{background:rgba(249,115,22,0.15);border-radius:100px;padding:2px 6px;font-size:9px;font-weight:700;color:var(--accent);}

/* PAGE */
.page{max-width:900px;margin:0 auto;padding:20px 16px 60px;}

/* CARD */
.card{background:var(--s1);border:1px solid var(--b1);border-radius:13px;padding:16px;margin-bottom:12px;}
.card-title{font-size:10px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--m1);margin-bottom:11px;display:flex;align-items:center;gap:7px;}
.card-title::before{content:'';width:3px;height:11px;background:var(--accent);border-radius:2px;flex-shrink:0;}

/* INPUTS */
textarea,input[type=text],input[type=password]{width:100%;background:rgba(255,255,255,0.04);border:1px solid var(--b2);border-radius:9px;padding:10px 12px;color:var(--text);font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;line-height:1.6;outline:none;transition:border-color 0.2s;}
textarea::placeholder,input::placeholder{color:var(--m2);}
textarea:focus,input:focus{border-color:rgba(249,115,22,0.35);}
textarea{resize:vertical;min-height:72px;}

/* UPLOAD */
.uz{border:1.5px dashed rgba(255,255,255,0.1);border-radius:10px;padding:16px;text-align:center;cursor:pointer;transition:all 0.2s;background:rgba(255,255,255,0.02);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:76px;}
.uz:hover,.uz.drag{border-color:rgba(249,115,22,0.4);background:rgba(249,115,22,0.03);}
.uz-icon{font-size:20px;opacity:0.4;}
.uz-t{font-size:12px;font-weight:600;color:var(--m1);}
.uz-s{font-size:10px;color:var(--m2);}
.thumbs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
.thumb{position:relative;width:56px;height:56px;border-radius:7px;overflow:hidden;border:1px solid var(--b2);}
.thumb img{width:100%;height:100%;object-fit:cover;}
.tx{position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;background:rgba(0,0,0,0.85);border:none;color:white;font-size:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;}

/* PILLS CHIPS */
.pill-row{display:flex;flex-wrap:wrap;gap:6px;}
.pill{background:var(--s2);border:1px solid var(--b1);border-radius:100px;padding:5px 11px;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.15s;color:var(--m1);white-space:nowrap;}
.pill:hover{border-color:var(--b2);color:var(--text);}
.pill.on{background:rgba(249,115,22,0.12);border-color:var(--accent);color:var(--accent);}
.chip-row{display:flex;gap:5px;flex-wrap:wrap;}
.chip{padding:5px 11px;border-radius:7px;border:1px solid var(--b1);background:var(--s2);font-size:11px;font-weight:600;cursor:pointer;transition:all 0.15s;color:var(--m1);}
.chip.on{background:rgba(249,115,22,0.1);border-color:rgba(249,115,22,0.4);color:var(--accent);}

/* GRID */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
@media(max-width:520px){.g2{grid-template-columns:1fr;}}

/* GEN BTN */
.gbtn{width:100%;padding:14px;background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:11px;font-family:'Syne',sans-serif;font-size:13px;font-weight:800;letter-spacing:0.04em;color:white;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;}
.gbtn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(249,115,22,0.3);}
.gbtn:disabled{opacity:0.4;cursor:not-allowed;transform:none;box-shadow:none;}

/* PROGRESS */
.pbar{height:3px;background:var(--m3);border-radius:2px;overflow:hidden;margin-top:8px;}
.pfill{height:100%;background:linear-gradient(90deg,var(--accent),var(--a2));border-radius:2px;transition:width 0.5s ease;}
.ptxt{font-size:11px;color:var(--m1);margin-top:5px;text-align:center;}

/* IMAGE RESULTS */
.img-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px;}
@media(max-width:640px){.img-grid{grid-template-columns:1fr 1fr;}}
.imgc{border-radius:11px;overflow:hidden;border:1px solid var(--b1);background:var(--s2);position:relative;animation:pop 0.3s ease both;}
@keyframes pop{from{opacity:0;transform:scale(0.94) translateY(8px);}to{opacity:1;transform:none;}}
.imgc img{width:100%;display:block;aspect-ratio:9/16;object-fit:cover;}
.imgc-sh{width:100%;aspect-ratio:9/16;background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%);background-size:200% 100%;animation:sh 1.4s infinite;}
@keyframes sh{to{background-position:-200% 0;}}
.imgc-num{position:absolute;top:7px;left:7px;background:rgba(0,0,0,0.7);border-radius:5px;padding:2px 6px;font-size:9px;font-weight:700;color:rgba(255,255,255,0.8);}
.imgc-model{position:absolute;top:7px;right:7px;background:rgba(0,0,0,0.7);border-radius:5px;padding:2px 6px;font-size:9px;color:rgba(255,255,255,0.55);}
.imgc-overlay{position:absolute;inset:0;background:rgba(0,0,0,0);transition:background 0.2s;display:flex;align-items:flex-end;justify-content:center;padding:10px;}
.imgc:hover .imgc-overlay{background:rgba(0,0,0,0.5);}
.imgc-dl{padding:7px 14px;background:var(--accent);border:none;border-radius:8px;color:white;font-family:'Syne',sans-serif;font-size:11px;font-weight:800;cursor:pointer;opacity:0;transform:translateY(6px);transition:all 0.2s;white-space:nowrap;}
.imgc:hover .imgc-dl{opacity:1;transform:translateY(0);}

/* SCENE RESULTS */
.scene-list{display:flex;flex-direction:column;gap:11px;margin-top:14px;}
.scene-card{background:var(--s1);border:1px solid var(--b1);border-radius:13px;overflow:hidden;animation:pop 0.3s ease both;}
.sch{display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(249,115,22,0.04);border-bottom:1px solid var(--b1);}
.sch-n{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:rgba(238,240,255,0.25);width:28px;flex-shrink:0;}
.sch-type{padding:3px 9px;border-radius:100px;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.25);font-size:10px;font-weight:700;color:var(--accent);}
.sch-dur{font-size:10px;color:var(--m1);}
.scb{display:grid;grid-template-columns:86px 1fr;gap:12px;padding:12px 14px;}
@media(max-width:480px){.scb{grid-template-columns:1fr;}}
.sc-img{border-radius:8px;overflow:hidden;aspect-ratio:9/16;background:var(--s2);border:1px solid var(--b1);position:relative;}
.sc-img img{width:100%;height:100%;object-fit:cover;display:block;}
.sc-img-sh{width:100%;height:100%;background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%);background-size:200% 100%;animation:sh 1.4s infinite;}
.sc-dl{position:absolute;bottom:5px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);border:none;border-radius:6px;padding:3px 8px;color:white;font-size:9px;font-weight:700;cursor:pointer;opacity:0;transition:opacity 0.15s;white-space:nowrap;}
.sc-img:hover .sc-dl{opacity:1;}
.sc-info{display:flex;flex-direction:column;gap:7px;}
.ib{background:rgba(0,0,0,0.2);border:1px solid var(--b1);border-radius:8px;padding:8px 10px;}
.ibl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:var(--m2);margin-bottom:3px;}
.ibv{font-size:12px;line-height:1.6;color:rgba(238,240,255,0.85);}
.db{background:rgba(249,115,22,0.05);border:1px solid rgba(249,115,22,0.15);border-radius:8px;padding:8px 10px;}
.dbv{font-size:13px;line-height:1.7;font-style:italic;}
.pb{background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.14);border-radius:8px;padding:8px 10px;position:relative;}
.pbv{font-size:11px;line-height:1.65;color:rgba(238,240,255,0.6);font-family:monospace;padding-right:44px;}
.cpbtn{position:absolute;top:5px;right:5px;background:rgba(255,255,255,0.08);border:none;border-radius:5px;padding:2px 7px;color:var(--m1);font-size:9px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all 0.15s;}
.cpbtn:hover{background:rgba(255,255,255,0.15);color:var(--text);}

/* COPY ALL BAR */
.cab{display:flex;align-items:center;gap:8px;padding:10px 13px;background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.14);border-radius:10px;margin-top:13px;flex-wrap:wrap;}
.cab span{font-size:12px;color:var(--m1);flex:1;}
.cabb{padding:7px 13px;border-radius:7px;border:none;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:5px;}
.cabb.p{background:rgba(249,115,22,0.15);color:var(--accent);}
.cabb.p:hover{background:rgba(249,115,22,0.25);}
.cabb.s{background:var(--s2);color:var(--m1);border:1px solid var(--b1);}
.cabb.s:hover{color:var(--text);}

/* CAPTION OUTPUT */
.cap-out{display:flex;flex-direction:column;gap:10px;margin-top:14px;animation:pop 0.3s ease;}
.cap-blk{background:var(--s1);border:1px solid var(--b1);border-radius:12px;padding:13px;position:relative;}
.cap-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:var(--m2);margin-bottom:6px;}
.cap-hook{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--accent);line-height:1.2;}
.cap-txt{font-size:13px;line-height:1.8;white-space:pre-wrap;word-break:break-word;padding-right:44px;}
.cap-tags{font-size:13px;color:var(--blue);line-height:2.2;padding-right:44px;}

/* STRUCT CARDS */
.sg{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
@media(max-width:460px){.sg{grid-template-columns:1fr;}}
.sc{border:1.5px solid var(--b1);border-radius:10px;padding:11px;cursor:pointer;transition:all 0.15s;background:var(--s2);}
.sc:hover{border-color:var(--b2);}
.sc.on{border-color:var(--accent);background:rgba(249,115,22,0.07);}
.sc-title{font-size:12px;font-weight:700;margin-bottom:3px;}
.sc-tags{display:flex;flex-wrap:wrap;gap:3px;margin-top:6px;}
.stag{font-size:9px;padding:2px 5px;border-radius:100px;background:rgba(255,255,255,0.05);border:1px solid var(--b1);color:var(--m2);}

/* OVERLAY MODALS */
.overlay{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.78);backdrop-filter:blur(10px);display:flex;align-items:flex-end;justify-content:center;animation:fdin 0.15s ease;}
@media(min-width:600px){.overlay{align-items:center;padding:20px;}}
@keyframes fdin{from{opacity:0;}to{opacity:1;}}
.modal{background:var(--s1);border:1px solid var(--b2);border-radius:18px 18px 0 0;width:100%;max-width:600px;max-height:90vh;overflow-y:auto;animation:sup 0.2s ease;}
@media(min-width:600px){.modal{border-radius:16px;}}
@keyframes sup{from{transform:translateY(24px);opacity:0;}to{transform:none;opacity:1;}}
.mh{padding:18px 18px 0;position:sticky;top:0;background:var(--s1);padding-bottom:12px;border-bottom:1px solid var(--b1);display:flex;align-items:center;justify-content:space-between;}
.mh-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;}
.mh-sub{font-size:11px;color:var(--m1);margin-top:2px;}
.mclose{width:28px;height:28px;border-radius:50%;background:var(--s2);border:none;color:var(--m1);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;}
.mbody{padding:14px 18px 22px;display:flex;flex-direction:column;gap:10px;}

/* MODEL CARDS in modal */
.mmc{border:1.5px solid var(--b1);border-radius:11px;padding:12px;cursor:pointer;transition:all 0.15s;background:var(--s2);display:flex;align-items:center;gap:11px;}
.mmc:hover{border-color:var(--b2);}
.mmc.on{border-color:var(--accent);background:rgba(249,115,22,0.06);}
.mmc-icon{width:36px;height:36px;border-radius:8px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}
.mmc-info{flex:1;min-width:0;}
.mmc-name{font-size:13px;font-weight:800;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px;}
.mmc-badge{padding:1px 7px;border-radius:100px;font-size:9px;font-weight:800;letter-spacing:0.03em;}
.mmc-desc{font-size:11px;color:var(--m1);}
.mmc-stats{display:flex;gap:8px;margin-top:5px;}
.mst{display:flex;flex-direction:column;align-items:center;gap:2px;}
.mst-bars{display:flex;gap:1px;}
.mst-b{width:7px;height:7px;border-radius:2px;background:var(--s3);}
.mst-b.on{background:var(--accent);}
.mst-b.on.b{background:var(--blue);}
.mst-b.on.g{background:var(--green);}
.mst-l{font-size:8px;color:var(--m2);}
.mmc-tick{width:20px;height:20px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;}

/* API SETTINGS MODAL */
.api-section{background:var(--s2);border:1px solid var(--b1);border-radius:11px;padding:14px;}
.api-section-title{font-size:12px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:7px;}
.api-row{display:flex;gap:8px;align-items:center;}
.api-row input{flex:1;}
.api-save-btn{padding:10px 16px;background:var(--accent);border:none;border-radius:8px;color:white;font-family:'Syne',sans-serif;font-size:12px;font-weight:800;cursor:pointer;transition:all 0.15s;white-space:nowrap;flex-shrink:0;}
.api-save-btn:hover{background:var(--a2);}
.api-status{font-size:11px;margin-top:6px;padding:6px 10px;border-radius:7px;}
.api-status.ok{background:rgba(52,211,153,0.1);color:var(--green);border:1px solid rgba(52,211,153,0.2);}
.api-status.err{background:rgba(248,113,113,0.1);color:var(--red);border:1px solid rgba(248,113,113,0.2);}
.api-help{font-size:11px;color:var(--m2);margin-top:6px;line-height:1.6;}
.api-help a{color:var(--blue);text-decoration:none;}
.api-divider{display:flex;align-items:center;gap:10px;margin:4px 0;}
.api-divider::before,.api-divider::after{content:'';flex:1;height:1px;background:var(--b1);}
.api-divider span{font-size:10px;color:var(--m2);font-weight:600;}

/* CHAT */
.chat-wrap{background:rgba(0,0,0,0.25);border:1px solid var(--b1);border-radius:10px;overflow:hidden;}
.chat-msgs{height:170px;overflow-y:auto;padding:11px;display:flex;flex-direction:column;gap:8px;}
.cmsg{display:flex;gap:6px;}
.cmsg.u{flex-direction:row-reverse;}
.cbub{max-width:82%;background:var(--s2);border-radius:10px;padding:7px 11px;font-size:12px;line-height:1.6;border:1px solid var(--b1);}
.cmsg.u .cbub{background:rgba(249,115,22,0.1);border-color:rgba(249,115,22,0.2);}
.cav{width:24px;height:24px;border-radius:50%;background:var(--s2);border:1px solid var(--b1);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;}
.chat-ir{display:flex;border-top:1px solid var(--b1);}
.chat-in{flex:1;min-height:auto;padding:9px 12px;font-size:12px;resize:none;background:transparent;border:none;border-radius:0;}
.chat-in:focus{border:none;}
.csend{padding:9px 13px;background:none;border:none;border-left:1px solid var(--b1);color:var(--accent);font-size:14px;cursor:pointer;transition:background 0.15s;}
.csend:hover:not(:disabled){background:rgba(249,115,22,0.08);}
.csend:disabled{opacity:0.35;cursor:not-allowed;}

/* UTILS */
.mt8{margin-top:8px;}.mt10{margin-top:10px;}.mt12{margin-top:12px;}.mt14{margin-top:14px;}
.mb8{margin-bottom:8px;}.mb10{margin-bottom:10px;}.mb12{margin-bottom:12px;}
.lbl{font-size:11px;font-weight:700;color:var(--m1);margin-bottom:6px;}
.note{padding:8px 11px;background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.12);border-radius:8px;font-size:11px;color:rgba(238,240,255,0.45);line-height:1.6;}
.warn-note{padding:8px 11px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.2);border-radius:8px;font-size:11px;color:rgba(251,191,36,0.8);line-height:1.6;}
.divider{height:1px;background:var(--b1);margin:12px 0;}
.spin{width:13px;height:13px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:sp 0.6s linear infinite;}
@keyframes sp{to{transform:rotate(360deg);}}
.stars-g{color:var(--gold);font-size:10px;letter-spacing:-1px;}

/* MOBILE BOTTOM NAV */
.bnav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:200;background:rgba(7,9,14,0.97);border-top:1px solid var(--b1);padding:6px 0 max(6px,env(safe-area-inset-bottom));}
.bnav-inner{display:flex;justify-content:space-around;}
.bnb{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px;background:none;border:none;cursor:pointer;color:var(--m1);font-family:'Plus Jakarta Sans',sans-serif;font-size:9px;font-weight:700;transition:color 0.15s;}
.bnb.on{color:var(--accent);}
.bnb-icon{font-size:17px;}
@media(max-width:600px){.bnav{display:block;}.nav-tabs{display:none;}.page{padding-bottom:76px;}}
`;

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────

function Stars({ n }) {
  return <span className="stars-g">{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;
}

function CpBtn({ text }) {
  const [cp, setCp] = useState(false);
  return (
    <button className="cpbtn" onClick={() => { navigator.clipboard.writeText(text); setCp(true); setTimeout(() => setCp(false), 1500); }}>
      {cp ? "✓" : "Copy"}
    </button>
  );
}

function UZ({ label, multi = false, images, setImages, maxCount = 4 }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const handle = useCallback((files) => {
    Promise.all(Array.from(files).filter(f => f.type.startsWith("image/")).map(f =>
      new Promise(res => {
        const r = new FileReader();
        r.onload = e => res({ url: URL.createObjectURL(f), data: e.target.result.split(",")[1], name: f.name });
        r.readAsDataURL(f);
      })
    )).then(imgs => setImages(p => [...p, ...imgs].slice(0, maxCount)));
  }, [maxCount, setImages]);

  return (
    <div>
      <div className={`uz ${drag ? "drag" : ""}`}
        onClick={() => ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}>
        <span className="uz-icon">📎</span>
        <span className="uz-t">{label}</span>
        <span className="uz-s">{multi ? `Max ${maxCount} gambar` : "1 gambar"} · PNG JPG WEBP</span>
      </div>
      <input ref={ref} type="file" accept="image/*" multiple={multi} style={{ display: "none" }}
        onChange={e => handle(e.target.files)} />
      {images.length > 0 && (
        <div className="thumbs">
          {images.map((img, i) => (
            <div key={i} className="thumb">
              <img src={img.url} alt="" />
              <button className="tx" onClick={e => { e.stopPropagation(); setImages(p => p.filter((_, j) => j !== i)); }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImgCard({ prompt, modelId, index, delay = 0 }) {
  const [loaded, setLoaded] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const model = MODELS.find(m => m.id === modelId);
  const seed = useRef(1000 + index * 337 + Math.floor(Math.random() * 400)).current;
  const url = prompt ? makeImgUrl(prompt, modelId, seed) : null;

  useEffect(() => {
    if (!url) return;
    setBlobUrl(null); setLoaded(false);
    fetch(url).then(r => r.blob()).then(blob => setBlobUrl(URL.createObjectURL(blob))).catch(() => {});
  }, [url]);

  const displayUrl = blobUrl || url;
  return (
    <div className="imgc" style={{ animationDelay: `${delay}ms` }}>
      <span className="imgc-num">#{index + 1}</span>
      <span className="imgc-model">{model?.short}</span>
      {!loaded && <div className="imgc-sh" />}
      {displayUrl && <img src={displayUrl} alt="" onLoad={() => setLoaded(true)} style={{ display: loaded ? "block" : "none" }} />}
      <div className="imgc-overlay">
        <a href={url} target="_blank" rel="noreferrer" download>
          <button className="imgc-dl">⬇ Download</button>
        </a>
      </div>
    </div>
  );
}

function SceneImgCard({ prompt, modelId, idx }) {
  const [loaded, setLoaded] = useState(false);
  const seed = useRef(3000 + idx * 271 + Math.floor(Math.random() * 200)).current;
  const url = prompt ? makeImgUrl(prompt, modelId, seed) : null;
  return (
    <div className="sc-img">
      {!loaded && <div className="sc-img-sh" />}
      {url && <img src={url} alt="" onLoad={() => setLoaded(true)} style={{ display: loaded ? "block" : "none" }} />}
      {url && (
        <a href={url} target="_blank" rel="noreferrer" download>
          <button className="sc-dl">⬇ Save</button>
        </a>
      )}
    </div>
  );
}

// ─── API SETTINGS MODAL ───────────────────────────────────────────────────────
function ApiModal({ keys, onSave, onClose }) {
  const [gemini, setGemini] = useState(keys.openrouter || "");
  const [claude, setClaude] = useState(keys.claude || "");
  const [testing, setTesting] = useState("");
  const [testResult, setTestResult] = useState({});

  const testOpenRouter = async () => {
    if (!gemini.trim()) return;
    setTesting("openrouter");
    try {
      await callOpenRouter(gemini.trim(), "You are helpful.", "Reply with exactly: OK");
      setTestResult(p => ({ ...p, openrouter: "ok" }));
    } catch { setTestResult(p => ({ ...p, openrouter: "err" })); }
    finally { setTesting(""); }
  };

  const save = () => {
    onSave({ openrouter: gemini.trim(), claude: claude.trim() });
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="mh">
          <div>
            <div className="mh-title">⚙️ API Settings</div>
            <div className="mh-sub">Setup sekali, save dalam browser kau</div>
          </div>
          <button className="mclose" onClick={onClose}>✕</button>
        </div>
        <div className="mbody">

          {/* GEMINI - PRIMARY FREE */}
          <div className="api-section">
            <div className="api-section-title">
              <span style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 100, padding: "2px 8px", fontSize: 10, color: "var(--green)", fontWeight: 800 }}>✅ FREE</span>
              🤖 OpenRouter API — Primary (Free)
            </div>
            <div className="api-row">
              <input type="password" placeholder="sk-or-v1-..." value={gemini}
                onChange={e => { setGemini(e.target.value); setTestResult(p => ({ ...p, openrouter: null })); }} />
              <button className="api-save-btn" onClick={testOpenRouter} disabled={testing === "openrouter" || !gemini.trim()}>
                {testing === "openrouter" ? <div className="spin" /> : "Test"}
              </button>
            </div>
            {testResult.openrouter === "ok" && <div className="api-status ok">✅ Working! Gemini 2.0 Flash via OpenRouter ready.</div>}
            {testResult.openrouter === "err" && <div className="api-status err">❌ Key tak valid. Semak balik.</div>}
            <div className="api-help">
              Cara dapat free: <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a> → Daftar free → Create API key → Copy paste sini. <strong>Format: sk-or-v1-... · Gemini 2.0 Flash free!</strong>
            </div>
          </div>

          <div className="api-divider"><span>atau bila ada modal</span></div>

          {/* CLAUDE - SECONDARY PAID */}
          <div className="api-section" style={{ opacity: 0.7 }}>
            <div className="api-section-title">
              <span style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 100, padding: "2px 8px", fontSize: 10, color: "var(--gold)", fontWeight: 800 }}>💎 PREMIUM</span>
              🟠 Claude API — Optional Upgrade
            </div>
            <div className="api-row">
              <input type="password" placeholder="sk-ant-..." value={claude}
                onChange={e => setClaude(e.target.value)} />
            </div>
            <div className="api-help">
              Bila ada Claude API key, sistem akan auto-guna Claude (lagi power). Dapat dari: <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a>. ~RM2-5/bulan untuk personal use.
            </div>
          </div>

          <button className="api-save-btn" style={{ width: "100%", padding: 13 }} onClick={save}>
            💾 Simpan Settings
          </button>

          {!keys.openrouter && !keys.claude && (
            <div className="warn-note">
              ⚠️ Belum ada API key. Masukkan Gemini API key dulu untuk guna app ni. Free je — 2 minit setup!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MODEL MODAL ─────────────────────────────────────────────────────────────
function ModelModal({ selected, onSelect, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="mh">
          <div>
            <div className="mh-title">🎨 Pilih Model Gambar</div>
            <div className="mh-sub">Semua FREE · via Pollinations.ai · Confirmed working</div>
          </div>
          <button className="mclose" onClick={onClose}>✕</button>
        </div>
        <div className="mbody">
          {MODELS.map(m => (
            <div key={m.id} className={`mmc ${selected === m.id ? "on" : ""}`}
              onClick={() => { onSelect(m.id); onClose(); }}>
              <div className="mmc-icon">{m.icon}</div>
              <div className="mmc-info">
                <div className="mmc-name">
                  {m.name} <Stars n={m.stars} />
                  <span className="mmc-badge" style={{ background: m.color + "22", color: m.color, border: `1px solid ${m.color}44` }}>{m.badge}</span>
                </div>
                <div className="mmc-desc">{m.desc}</div>
                <div className="mmc-stats">
                  {[["Fabric", "fabric", ""], ["Realism", "realism", "b"], ["Speed", "speed", "g"]].map(([lbl, k, cls]) => (
                    <div key={lbl} className="mst">
                      <div className="mst-bars">{[1, 2, 3, 4, 5].map(i => <div key={i} className={`mst-b ${i <= m[k] ? `on ${cls}` : ""}`} />)}</div>
                      <span className="mst-l">{lbl}</span>
                    </div>
                  ))}
                </div>
              </div>
              {selected === m.id && <div className="mmc-tick">✓</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── NO API KEY BANNER ────────────────────────────────────────────────────────
function NoKeyBanner({ onOpen }) {
  return (
    <div style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 12, padding: "16px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: "var(--gold)", marginBottom: 3 }}>⚠️ API Key Diperlukan</div>
        <div style={{ fontSize: 12, color: "var(--m1)", lineHeight: 1.6 }}>Masukkan <strong>Gemini API key free</strong> dulu untuk guna app ni. Setup 2 minit je.</div>
      </div>
      <button onClick={onOpen} style={{ padding: "9px 16px", background: "var(--gold)", border: "none", borderRadius: 9, color: "#000", fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
        Setup API Key →
      </button>
    </div>
  );
}

// ─── TAB 1: IMAGE GENERATOR ───────────────────────────────────────────────────
function Tab1({ modelId, apiKeys, onOpenApi }) {
  const [prodImgs, setProdImgs] = useState([]);
  const [modelImgs, setModelImgs] = useState([]);
  const [desc, setDesc] = useState("");
  const [styleIdx, setStyleIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [prompts, setPrompts] = useState([]);

  const hasKey = apiKeys.openrouter || apiKeys.claude;

  const generate = async () => {
    if (!desc.trim() && !prodImgs.length) return;
    setLoading(true); setPrompts([]); setProgress(15);
    setStatus("Membina 4 variasi prompt...");
    const style = STYLES[styleIdx].val;

    // Build 4 variations directly — no API needed!
    const angles = [
      "close-up hero shot, soft studio lighting, clean white background",
      "lifestyle flat lay, natural daylight, marble surface, aesthetic props",
      "model holding product, outdoor golden hour, bokeh background, candid feel",
      "overhead top-down view, pastel backdrop, minimalist arrangement, shadows"
    ];

    try {
      setProgress(55);
      const baseDesc = desc || "premium product";
      const arr = angles.map(angle => 
        `${baseDesc}, ${angle}, ${style}, 9:16 vertical portrait, ultra high quality, photorealistic, shot on Canon EOS R5, 85mm f1.4 lens, professional product photography, TikTok Malaysia aesthetic`
      );
      setPrompts(arr);
      setProgress(100);
      setStatus("✅ Siap! Hover gambar untuk download.");
    } catch (e) {
      setStatus("❌ Error. Cuba lagi.");
    } finally { setLoading(false); }
  };

  return (
    <div>
      
      <div className="card">
        <div className="g2">
          <div>
            <div className="card-title">📦 Gambar Produk</div>
            <UZ label="Upload produk (max 3)" multi maxCount={3} images={prodImgs} setImages={setProdImgs} />
          </div>
          <div>
            <div className="card-title">🧍 Model / Rujukan (optional)</div>
            <UZ label="Upload model / reference" maxCount={1} images={modelImgs} setImages={setModelImgs} />
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">✍️ Describe Produk & Idea</div>
        <textarea placeholder='Cth: "Serum brightening vitamin C, kulit cerah 7 hari, wanita 25-40, feel premium & aesthetic"'
          value={desc} onChange={e => setDesc(e.target.value)} />
      </div>
      <div className="card">
        <div className="card-title">🎨 Style Visual</div>
        <div className="pill-row">
          {STYLES.map((s, i) => (
            <button key={i} className={`pill ${styleIdx === i ? "on" : ""}`} onClick={() => setStyleIdx(i)}>{s.emoji} {s.label}</button>
          ))}
        </div>
      </div>
      <button className="gbtn" onClick={generate} disabled={loading || (!desc.trim() && !prodImgs.length)}>
        {loading ? <><div className="spin" /><span>{status}</span></> : <><span>⚡</span><span>GENERATE 4 GAMBAR AI</span></>}
      </button>
      {loading && <div><div className="pbar"><div className="pfill" style={{ width: `${progress}%` }} /></div><div className="ptxt">{status}</div></div>}
      {prompts.length > 0 && (
        <>
          <div className="img-grid">
            {prompts.map((p, i) => <ImgCard key={i} prompt={p} modelId={modelId} index={i} delay={i * 100} />)}
          </div>
          <div className="note mt10">💡 Model: <strong>{MODELS.find(m => m.id === modelId)?.name}</strong> · FREE via Pollinations.ai · 9:16 portrait · Hover → Download</div>
        </>
      )}
    </div>
  );
}

// ─── TAB 2: VIDEO SCENE ───────────────────────────────────────────────────────
function Tab2({ modelId, apiKeys, onOpenApi }) {
  const [prodImgs, setProdImgs] = useState([]);
  const [desc, setDesc] = useState("");
  const [audience, setAudience] = useState("");
  const [structure, setStructure] = useState("4j");
  const [duration, setDuration] = useState("15s");
  const [customIdea, setCustomIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [scenes, setScenes] = useState([]);
  const [sceneImgPrompts, setSceneImgPrompts] = useState([]);
  const [chatMsgs, setChatMsgs] = useState([
    { role: "ai", text: "Hai! Cerita sikit produk kau — aku suggest hook & angle yang viral! 🔥" }
  ]);
  const [chatIn, setChatIn] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef();
  const hasKey = apiKeys.openrouter || apiKeys.claude;

  const sendChat = async () => {
    if (!chatIn.trim() || chatLoading || !hasKey) return;
    const msg = chatIn.trim(); setChatIn("");
    setChatMsgs(p => [...p, { role: "user", text: msg }]);
    setChatLoading(true);
    try {
      const sys = `Pakar content TikTok & Shopee Affiliate Malaysia. Jawab BM. Singkat, punchy, actionable. Produk: ${desc || "belum ditetapkan"}`;
      const r = await callAI(apiKeys, sys, msg);
      setChatMsgs(p => [...p, { role: "ai", text: typeof r === "string" ? r : JSON.stringify(r) }]);
    } catch { setChatMsgs(p => [...p, { role: "ai", text: "Error. Cuba lagi!" }]); }
    finally {
      setChatLoading(false);
      setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 100);
    }
  };

  const generate = async () => {
    if (!hasKey) { onOpenApi(); return; }
    if (!desc.trim()) return;
    setLoading(true); setScenes([]); setSceneImgPrompts([]); setProgress(10);
    setStatus("Merancang struktur scene...");
    const sel = STRUCTURES[structure];
    const maxW = { "6s": 12, "8s": 18, "15s": 35, "30s": 65, "60s": 110 }[duration] || 35;

    const sys = `Expert TikTok & Shopee Affiliate video scriptwriter, Malaysian market.
User may write in Bahasa Malaysia — understand and respond accordingly.
Return ONLY valid JSON (no markdown, no explanation):
{ "scenes": [ { "type": "scene label", "description": "ENGLISH image prompt — include setting, lighting, camera angle, subject detail, mood, atmosphere, 9:16 vertical portrait", "dialog": "Bahasa Melayu dialog max ${maxW} words, natural conversational, emotionally engaging, viral-worthy", "caption": "BM on-screen text overlay max 6 words, punchy" } ] }
Structure: ${sel.scenes.join(" → ")}
Make each scene visually distinct but brand consistent. All image descriptions MUST be in English.`;

    const userPrompt = `Produk: ${desc}
Audience: ${audience || "Wanita Malaysia 20-40"}
Durasi: ${duration} per scene
Struktur: ${sel.scenes.join(" → ")}
Idea tambahan: ${customIdea || "auto generate best angle"}
Generate complete ${sel.scenes.length}-scene video script.`;

    try {
      setProgress(50); setStatus("AI tulis dialog & skrip BM...");
      const imgs = prodImgs.slice(0, 2).map(i => i.data);
      const r = await callAI(apiKeys, sys, userPrompt, imgs);
      const sceneData = r?.scenes || [];
      setProgress(80); setStatus("Craft image prompt setiap scene...");
      const imgPs = sceneData.map(s =>
        `${s.description || "product lifestyle scene"}, TikTok content style, 9:16 vertical portrait, ultra realistic, professional photography, high quality`
      );
      setScenes(sceneData);
      setSceneImgPrompts(imgPs);
      setProgress(100); setStatus("✅ Scene siap!");
    } catch (e) {
      setStatus(e.message === "NO_API_KEY" ? "⚠️ Setup API key dulu!" : "❌ Error. Cuba lagi.");
    } finally { setLoading(false); }
  };

  const copyAll = () => {
    const sel = STRUCTURES[structure];
    const txt = [
      `=== KREATORAI — VIDEO PROMPTS ===`,
      `Produk: ${desc} | ${sel.label} | ${duration}/scene`,
      ``,
      `=== IMAGE PROMPTS (paste ke Grok/Flow AI) ===`,
      ...sceneImgPrompts.map((p, i) => `\nSCENE ${i + 1} [${sel.scenes[i] || ""}]\n${p}`),
      ``,
      `=== DIALOG / SKRIP BM ===`,
      ...scenes.map((s, i) => `\nSCENE ${i + 1} — ${sel.scenes[i] || ""}\nDialog: "${s.dialog || ""}"\nCaption: ${s.caption || ""}`)
    ].join("\n");
    navigator.clipboard.writeText(txt);
    alert("✅ Semua prompts + dialog dah copy! Paste ke Grok AI / Flow AI.");
  };

  return (
    <div>
      
      <div className="g2 mb12">
        <div className="card" style={{ margin: 0 }}>
          <div className="card-title">📦 Produk & Info</div>
          <UZ label="Upload gambar produk (optional)" multi maxCount={2} images={prodImgs} setImages={setProdImgs} />
          <div className="lbl mt10">Describe Produk</div>
          <textarea placeholder='Cth: "Serum collagen RM89, brightening + anti-aging, halal certified"'
            value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
          <div className="lbl mt10">Target Audience</div>
          <input type="text" placeholder='Cth: "Wanita 25-40, kulit kusam, suka skincare"'
            value={audience} onChange={e => setAudience(e.target.value)} />
        </div>
        <div className="card" style={{ margin: 0 }}>
          <div className="card-title">🤖 AI Brainstorm Ideas</div>
          <div className="chat-wrap">
            <div className="chat-msgs" ref={chatRef}>
              {chatMsgs.map((m, i) => (
                <div key={i} className={`cmsg ${m.role === "user" ? "u" : ""}`}>
                  <div className="cav">{m.role === "ai" ? "🤖" : "👤"}</div>
                  <div className="cbub">{m.text}</div>
                </div>
              ))}
              {chatLoading && <div className="cmsg"><div className="cav">🤖</div><div className="cbub"><div className="spin" style={{ width: 12, height: 12 }} /></div></div>}
            </div>
            <div className="chat-ir">
              <textarea className="chat-in" rows={2}
                placeholder={hasKey ? "Tanya idea hook, angle, dialog..." : "Setup API key dulu..."}
                value={chatIn} onChange={e => setChatIn(e.target.value)}
                disabled={!hasKey}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }} />
              <button className="csend" onClick={sendChat} disabled={chatLoading || !chatIn.trim() || !hasKey}>➤</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">🎬 Struktur Video</div>
        <div className="sg">
          {Object.entries(STRUCTURES).map(([key, val]) => (
            <div key={key} className={`sc ${structure === key ? "on" : ""}`}
              onClick={() => { setStructure(key); setDuration(val.durations[0]); }}>
              <div className="sc-title">{val.label}</div>
              <div className="sc-tags">{val.scenes.map((s, i) => <span key={i} className="stag">{s}</span>)}</div>
            </div>
          ))}
        </div>
        <div className="g2 mt10">
          <div>
            <div className="lbl">⏱️ Durasi Per Scene</div>
            <div className="chip-row">
              {STRUCTURES[structure].durations.map(d => (
                <button key={d} className={`chip ${duration === d ? "on" : ""}`} onClick={() => setDuration(d)}>{d}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="lbl">💡 Custom Idea (optional)</div>
            <input type="text" placeholder='Cth: "Ada before/after, guna testimonial"'
              value={customIdea} onChange={e => setCustomIdea(e.target.value)} />
          </div>
        </div>
      </div>

      <button className="gbtn" onClick={generate} disabled={loading || !desc.trim()}>
        {loading ? <><div className="spin" /><span>{status}</span></> : <><span>🎬</span><span>GENERATE SCENE + GAMBAR AI + SKRIP</span></>}
      </button>
      {loading && <div><div className="pbar mt8"><div className="pfill" style={{ width: `${progress}%` }} /></div><div className="ptxt">{status}</div></div>}

      {scenes.length > 0 && (
        <>
          <div className="cab">
            <span>🚀 Ready untuk Grok AI / Flow AI</span>
            <button className="cabb p" onClick={copyAll}>📋 Copy Semua Prompt + Dialog</button>
            <button className="cabb s" onClick={() => { navigator.clipboard.writeText(sceneImgPrompts.join("\n\n")); alert("✅ Image prompts copied!"); }}>🖼️ Image Prompts je</button>
          </div>
          <div className="scene-list">
            {scenes.map((scene, i) => (
              <div key={i} className="scene-card" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="sch">
                  <div className="sch-n">{String(i + 1).padStart(2, "0")}</div>
                  <div className="sch-type">{STRUCTURES[structure].scenes[i] || `Scene ${i + 1}`}</div>
                  <div className="sch-dur">⏱ {duration}</div>
                </div>
                <div className="scb">
                  <SceneImgCard prompt={sceneImgPrompts[i]} modelId={modelId} idx={i} />
                  <div className="sc-info">
                    {scene.description && <div className="ib"><div className="ibl">📋 Visual</div><div className="ibv">{scene.description}</div></div>}
                    {scene.dialog && <div className="db"><div className="ibl" style={{ color: "rgba(249,115,22,0.7)" }}>🎙️ Dialog BM</div><div className="dbv">"{scene.dialog}"</div></div>}
                    {scene.caption && <div className="ib"><div className="ibl">💬 On-screen</div><div className="ibv">{scene.caption}</div></div>}
                    {sceneImgPrompts[i] && <div className="pb"><div className="ibl" style={{ color: "rgba(96,165,250,0.7)" }}>🤖 Video Prompt</div><div className="pbv">{sceneImgPrompts[i]}</div><CpBtn text={sceneImgPrompts[i]} /></div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="note mt10">💡 Hover gambar scene → Save. Copy prompt → paste ke <strong>Grok AI</strong> atau <strong>Google Flow</strong> untuk generate video.</div>
        </>
      )}
    </div>
  );
}

// ─── TAB 3: CAPTION & CONTENT ─────────────────────────────────────────────────
function Tab3({ modelId, apiKeys, onOpenApi }) {
  const [imgs, setImgs] = useState([]);
  const [topic, setTopic] = useState("");
  const [captionType, setCaptionType] = useState("viral");
  const [platform, setPlatform] = useState("tiktok");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [imgPrompts, setImgPrompts] = useState([]);
  const hasKey = apiKeys.openrouter || apiKeys.claude;

  const generate = async () => {
    if (!hasKey) { onOpenApi(); return; }
    if (!topic.trim() && !imgs.length) return;
    setLoading(true); setResult(null); setImgPrompts([]);

    const sys = `Viral Malaysian TikTok & Shopee Affiliate content strategist.
User may write in Bahasa Malaysia — understand fully.
Return ONLY valid JSON (no markdown):
{ "hook":"viral BM hook max 10 words", "caption":"full BM caption with emoji 150-200 words", "hashtags":["20 relevant tags no # prefix"], "tiktok_desc":"TikTok desc max 150 chars with 5 hashtags", "shopee_desc":"Shopee SEO desc BM 80 words", "cta":"punchy BM CTA max 10 words", "imageIdeas":["4 ENGLISH image prompts for AI generation, detailed, unique angle/mood each"] }`;

    const userPrompt = `Topic/Produk: "${topic || "product in image"}"
Caption type: ${captionType}
Platform: ${platform}
Generate complete content pack.`;

    try {
      const imageData = imgs.slice(0, 2).map(i => i.data);
      const d = await callAI(apiKeys, sys, userPrompt, imageData);
      setResult(d);
      if (Array.isArray(d?.imageIdeas)) setImgPrompts(d.imageIdeas);
    } catch (e) {
      setResult({ caption: e.message === "NO_API_KEY" ? "Setup API key dulu!" : "Error. Cuba lagi." });
    } finally { setLoading(false); }
  };

  return (
    <div>
      
      <div className="g2 mb12">
        <div className="card" style={{ margin: 0 }}>
          <div className="card-title">📸 Upload Gambar (optional)</div>
          <UZ label="Upload gambar content" multi maxCount={2} images={imgs} setImages={setImgs} />
        </div>
        <div className="card" style={{ margin: 0 }}>
          <div className="card-title">✍️ Topic / Produk</div>
          <textarea placeholder='Cth: "OOTD baju kurung viral", "Review krim muka bestseller"'
            value={topic} onChange={e => setTopic(e.target.value)} rows={3} />
          <div className="lbl mt10">Platform</div>
          <div className="chip-row">
            {[["tiktok", "📱 TikTok"], ["shopee", "🛒 Shopee"], ["instagram", "📸 IG Reels"]].map(([v, l]) => (
              <button key={v} className={`chip ${platform === v ? "on" : ""}`} onClick={() => setPlatform(v)}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">🎭 Jenis Caption</div>
        <div className="pill-row">
          {CAPTION_TYPES.map(c => (
            <button key={c.id} className={`pill ${captionType === c.id ? "on" : ""}`} onClick={() => setCaptionType(c.id)}>{c.label}</button>
          ))}
        </div>
      </div>
      <button className="gbtn" onClick={generate} disabled={loading || (!topic.trim() && !imgs.length)}>
        {loading ? <><div className="spin" /><span>Generating...</span></> : <><span>✨</span><span>GENERATE CAPTION + CONTENT PACK</span></>}
      </button>

      {result && (
        <div className="cap-out">
          {result.hook && <div className="cap-blk"><div className="cap-lbl">🪝 Viral Hook</div><div className="cap-hook">{result.hook}</div></div>}
          {result.caption && <div className="cap-blk"><div className="cap-lbl">📝 Caption Penuh</div><div className="cap-txt">{result.caption}</div><CpBtn text={result.caption} /></div>}
          {result.tiktok_desc && <div className="cap-blk"><div className="cap-lbl">📱 TikTok Description</div><div className="cap-txt" style={{ fontSize: 12 }}>{result.tiktok_desc}</div><CpBtn text={result.tiktok_desc} /></div>}
          {result.shopee_desc && <div className="cap-blk"><div className="cap-lbl">🛒 Shopee Description</div><div className="cap-txt" style={{ fontSize: 12 }}>{result.shopee_desc}</div><CpBtn text={result.shopee_desc} /></div>}
          {result.cta && <div className="cap-blk"><div className="cap-lbl">📣 Call to Action</div><div style={{ fontSize: 16, fontWeight: 800, color: "var(--accent)" }}>{result.cta}</div></div>}
          {result.hashtags?.length > 0 && <div className="cap-blk"><div className="cap-lbl">🏷️ Hashtags</div><div className="cap-tags">{result.hashtags.map(h => `#${h.replace("#", "")}`).join(" ")}</div><CpBtn text={result.hashtags.map(h => `#${h.replace("#", "")}`).join(" ")} /></div>}
          {imgPrompts.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--m1)", letterSpacing: "0.09em", textTransform: "uppercase", marginTop: 4 }}>🖼️ AI Image Ideas — hover untuk download</div>
              <div className="img-grid">
                {imgPrompts.slice(0, 4).map((p, i) => <ImgCard key={i} prompt={p} modelId={modelId} index={i} delay={i * 100} />)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState(0);
  const [modelId, setModelId] = useState("kontext");
  const [showModelModal, setShowModelModal] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);

  const [apiKeys, setApiKeys] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("kreatorai_keys") || "{}");
    } catch { return {}; }
  });

  const saveKeys = (keys) => {
    setApiKeys(keys);
    try { localStorage.setItem("kreatorai_keys", JSON.stringify(keys)); } catch {}
  };

  const hasKey = apiKeys.openrouter || apiKeys.claude;
  const cur = MODELS.find(m => m.id === modelId);

  const apiStatus = !hasKey ? "err"
    : apiKeys.claude ? "ok"
    : apiKeys.openrouter ? "ok"
    : "warn";

  const apiLabel = !hasKey ? "Setup API"
    : apiKeys.claude ? "Claude ✦"
    : "Gemini ✓";

  const TABS = [
    { label: "🖼️ Image Gen", comp: <Tab1 modelId={modelId} apiKeys={apiKeys} onOpenApi={() => setShowApiModal(true)} /> },
    { label: "🎬 Video Scene", comp: <Tab2 modelId={modelId} apiKeys={apiKeys} onOpenApi={() => setShowApiModal(true)} /> },
    { label: "✨ Caption", comp: <Tab3 modelId={modelId} apiKeys={apiKeys} onOpenApi={() => setShowApiModal(true)} /> },
  ];

  return (
    <>
      <style>{CSS}</style>
      {showModelModal && <ModelModal selected={modelId} onSelect={setModelId} onClose={() => setShowModelModal(false)} />}
      {showApiModal && <ApiModal keys={apiKeys} onSave={saveKeys} onClose={() => setShowApiModal(false)} />}

      <nav className="nav">
        <div className="nav-inner">
          <div className="logo">Kreator<em>AI</em></div>
          <div className="nav-tabs">
            {TABS.map((t, i) => (
              <button key={i} className={`ntab ${tab === i ? "active" : ""}`} onClick={() => setTab(i)}>{t.label}</button>
            ))}
          </div>
          <div className="nav-right">
            <div className={`api-pill ${apiStatus}`} onClick={() => setShowApiModal(true)}>
              <span className="api-dot" />
              {apiLabel}
            </div>
            <div className="mpill" onClick={() => setShowModelModal(true)}>
              <span>{cur?.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 11 }}>{cur?.name}</span>
              <Stars n={cur?.stars || 4} />
              <span className="mpill-tag">Tukar</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="page">
        {/* Show API setup prompt on first visit */}
        {!hasKey && tab === 0 && (
          <div className="note mb12" style={{ background: "rgba(52,211,153,0.05)", borderColor: "rgba(52,211,153,0.2)", color: "rgba(238,240,255,0.6)" }}>
            👋 Selamat datang ke <strong>KreatorAI</strong>! Setup Gemini API key free dulu — klik <strong style={{ color: "var(--green)", cursor: "pointer" }} onClick={() => setShowApiModal(true)}>API Setup →</strong>
          </div>
        )}
        {TABS[tab].comp}
      </div>

      {/* Mobile bottom nav */}
      <div className="bnav">
        <div className="bnav-inner">
          {TABS.map((t, i) => (
            <button key={i} className={`bnb ${tab === i ? "on" : ""}`} onClick={() => setTab(i)}>
              <span className="bnb-icon">{t.label.split(" ")[0]}</span>
              {t.label.split(" ").slice(1).join(" ")}
            </button>
          ))}
          <button className={`bnb ${apiStatus === "err" ? "on" : ""}`} onClick={() => setShowApiModal(true)}>
            <span className="bnb-icon">⚙️</span>API
          </button>
        </div>
      </div>
    </>
  );
}
