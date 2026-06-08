#!/usr/bin/env node
/**
 * Gemini Imagen 3 — Google Advertisement Style Image Generator
 * Patience AI Brand Campaign Assets
 *
 * Usage:
 *   node scripts/generate-images.mjs [options]
 *
 * Options:
 *   --type <type>    Campaign type: podcast | product | newsletter | blog | security | hero | all
 *   --count <n>      Images per prompt (1-4, default: 1)
 *   --aspect <r>     Aspect ratio: 16:9 | 1:1 | 4:3 | 9:16  (default: 16:9)
 *   --out <dir>      Output directory (default: public/generated-ads)
 *   --prompt <text>  Custom prompt override
 *   --fast           Use imagen-3.0-fast-generate-001 instead of imagen-3.0-generate-002
 *   --overlay        Composite Patience AI logo bottom-left (requires: npm install sharp)
 *   --help           Show this help
 *
 * Required env:
 *   GEMINI_API_KEY   Google AI Studio API key — https://aistudio.google.com/apikey
 *
 * Examples:
 *   GEMINI_API_KEY=xxx node scripts/generate-images.mjs --type podcast
 *   GEMINI_API_KEY=xxx node scripts/generate-images.mjs --type all --count 2 --overlay
 *   GEMINI_API_KEY=xxx node scripts/generate-images.mjs --type product --aspect 1:1
 *   GEMINI_API_KEY=xxx node scripts/generate-images.mjs --prompt "custom prompt" --count 4
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOGO_PATH = path.join(ROOT, 'src', 'assets', 'patience-logo.png');

// ─── Brand Constants ──────────────────────────────────────────────────────────
const BRAND = {
  name: 'Patience AI',
  tagline: "India's AI Platform for Business & Education",
  domain: 'patienceai.in',
  // Visual language fed into every prompt for consistent identity
  palette: 'deep navy #0f172a, electric violet #7c3aed, pure white #ffffff, slate gray #334155',
  style: [
    'Google advertisement visual language',
    'clean minimalist composition',
    'bold confident typography',
    'no people, no text overlays',
    'premium tech brand aesthetic',
    'professional high-production-value ad',
  ].join(', '),
};

// Style suffix appended to every prompt for brand consistency
const STYLE_SUFFIX = `${BRAND.style}. Color palette: ${BRAND.palette}. Brand: ${BRAND.name}. No watermarks, no logos embedded in image.`;

// ─── Campaign Prompt Library ──────────────────────────────────────────────────
const CAMPAIGNS = {

  podcast: {
    label: 'Podcast Feature',
    prompts: [
      `Google advertisement banner for an AI podcast show. Cinematic dark navy background. Central abstract sound-wave visualization rendered in electric violet gradient — flowing, dynamic, modern. Bold white sans-serif headline area at top third: "AI INSIGHTS PODCAST". Bottom: thin violet separator line, then domain text area. Ultra-clean, zero clutter. ${STYLE_SUFFIX}`,

      `Sleek podcast episode card. Horizontal split layout. Left half: deep space dark with glowing violet orbital rings representing audio waveform. Right half: matte slate with large bold "LISTEN • LEARN • LEAD" in white. Thin neon-violet vertical divider. Bottom-left: clear space reserved for logo. Inspired by Spotify Wrapped aesthetic but minimal. ${STYLE_SUFFIX}`,

      `Premium podcast launch billboard. Full-width dark gradient (navy to deep violet). Abstract 3D sound-cone shape in center emitting concentric circles of light. Headline space "EPISODE 04" top-left in small caps. Main text area center. Cinematic letterbox crop lines. ${STYLE_SUFFIX}`,
    ],
  },

  product: {
    label: 'Product Showcase',
    prompts: [
      `Google-quality SaaS product advertisement. Dark navy background. Centered glowing holographic dashboard interface — abstract, no real text, floating UI panels in violet/blue tones with subtle lens-flare. Bold headline space top: "AUTOMATE YOUR BUSINESS" in white. Geometric grid overlay (very subtle). Bottom brand strip with space for logo and domain. ${STYLE_SUFFIX}`,

      `Modern B2B software product ad. Isometric 3D illustration of interconnected AI nodes/blocks in electric violet against deep navy, arranged like a city skyline abstraction. Headline area: "AI BUILT FOR INDIA". Minimal white space at bottom for branding. Clean perspective lines. ${STYLE_SUFFIX}`,

      `Product detail video thumbnail in Google ad style. Split composition: left 60% shows abstract glowing AI brain/network in violet on dark, right 40% clean white panel with bold black headline space and CTA button shape in violet. Premium production quality. ${STYLE_SUFFIX}`,

      `Enterprise software billboard. Full bleed dark background. Large abstract geometric shape in center — a dodecahedron made of light-lines in violet/cyan gradient, rotating feel. Tagline space below: "INTELLIGENCE AT SCALE". Very minimal. Google Tensor chip ad aesthetic. ${STYLE_SUFFIX}`,
    ],
  },

  newsletter: {
    label: 'Newsletter CTA',
    prompts: [
      `Email newsletter subscription advertisement card. Clean pure white background. Top: bold navy headline area for "STAY AHEAD WITH AI". Center: abstract envelope icon constructed from geometric violet shapes. Bottom: violet rounded-rectangle CTA button shape with space for text. Subtle dotted-grid texture on white. Google Workspace ad style. Crisp, airy, professional. ${STYLE_SUFFIX}`,

      `Newsletter promo banner. Minimal dark version. Navy background, violet accent dots forming a subtle constellation pattern. Center: large open-envelope icon in glowing white wireframe. Bottom third: gradient fade to slightly lighter navy with text space. Modern fintech/edtech newsletter aesthetic. ${STYLE_SUFFIX}`,
    ],
  },

  blog: {
    label: 'Blog Feature',
    prompts: [
      `Editorial blog feature header image. Abstract geometric composition — overlapping diagonal planes in navy and violet with thin white rule lines. Top-left: horizontal white bar for category label space. Center: open space for headline text placement. Right-aligned accent: thin violet vertical stripe. Magazine-quality tech editorial. ${STYLE_SUFFIX}`,

      `Blog article OG image (Open Graph). Wide 16:9. Muted dark navy background with very subtle paper texture. Large abstract ink-splash in violet with crisp edges, centered but offset left. White text area on right side for blog title. Clean and journalistic. Inspired by MIT Technology Review visual style. ${STYLE_SUFFIX}`,
    ],
  },

  security: {
    label: 'Security Update Announcement',
    prompts: [
      `Enterprise security announcement banner. Deep charcoal-navy background with subtle hex-grid pattern, circuit-trace lines in very dark navy (barely visible, adds depth). Center: glowing shield icon rendered in crystalline violet light, soft pulsing-aura effect around it. Top headline space: "ENTERPRISE SECURITY" in white. Bottom: thin violet rule + space for version text. Trust and authority aesthetic. ${STYLE_SUFFIX}`,

      `Security patch release visual. Dark background, sophisticated. Abstract lock icon constructed from geometric light-lines in violet and white. Surrounding: thin concentric hexagons fading outward. Top-third reserved for headline. Clean, serious, Google Security blog aesthetic. ${STYLE_SUFFIX}`,
    ],
  },

  hero: {
    label: 'Hero / Brand Awareness',
    prompts: [
      `Full brand hero advertisement for Indian AI company. Cinematic wide format. Deep navy-to-violet atmospheric gradient sky. Foreground: abstract neural constellation — hundreds of glowing nodes connected by thin violet threads forming a vast intelligent network. Headline space centered: large white bold logotype area. Subheadline space below. Utterly epic, aspirational, like a Google IO keynote slide background. ${STYLE_SUFFIX}`,

      `Clean brand awareness ad — white background variant. Pure white with very subtle light-gray geometric tessellation. Center: large clear space for brand wordmark. Below: thin violet underline accent, then subtext space. Right side: abstract AI-brain made of fine violet lines, elegant. Inspired by Notion, Linear, Vercel brand ads — confident, minimal, modern. ${STYLE_SUFFIX}`,

      `Aspirational India AI brand billboard. Sunrise/dawn atmosphere — deep navy fading to warm violet-indigo at horizon, stars fading into light. Abstract silhouette of data center / smart city skyline in deep violet at bottom edge. Stars formed by network nodes. "From India, for the World" visual spirit. Premium cinematic quality. ${STYLE_SUFFIX}`,
    ],
  },

};

// ─── CLI Argument Parsing ──────────────────────────────────────────────────────
const argv = process.argv.slice(2);

const getArg = (flag) => {
  const i = argv.indexOf(flag);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : null;
};
const hasFlag = (flag) => argv.includes(flag);

// ─── Help ─────────────────────────────────────────────────────────────────────
if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
Gemini Imagen 3 — Patience AI Google-Style Ad Generator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage:
  GEMINI_API_KEY=<key> node scripts/generate-images.mjs [options]

Options:
  --type <type>    Campaign: podcast | product | newsletter | blog | security | hero | all
  --count <n>      Images per prompt: 1-4  (default: 1)
  --aspect <r>     Aspect ratio: 16:9 | 1:1 | 4:3 | 9:16  (default: 16:9)
  --out <dir>      Output directory  (default: public/generated-ads)
  --prompt <text>  Custom prompt (overrides preset prompts for chosen --type)
  --fast           Use faster Imagen 3 model (lower quality, quicker)
  --overlay        Composite patience-logo.png bottom-left  (needs: npm install sharp)
  --help           Show this message

API Key:
  Get yours free at https://aistudio.google.com/apikey

Examples:
  GEMINI_API_KEY=xxx node scripts/generate-images.mjs --type hero
  GEMINI_API_KEY=xxx node scripts/generate-images.mjs --type podcast --count 2
  GEMINI_API_KEY=xxx node scripts/generate-images.mjs --type all --overlay
  GEMINI_API_KEY=xxx node scripts/generate-images.mjs --type product --aspect 1:1 --count 4
  GEMINI_API_KEY=xxx node scripts/generate-images.mjs --prompt "your prompt" --count 2

Campaign types:
  podcast     — Podcast show / episode promo banners
  product     — SaaS product showcase & video thumbnail ads
  newsletter  — Email subscription CTAs
  blog        — Editorial article feature images
  security    — Security patch & trust announcements
  hero        — Full brand awareness / billboard ads
  all         — Generate every campaign type
`);
  process.exit(0);
}

// ─── Validate Config ──────────────────────────────────────────────────────────
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('\n❌  Missing GEMINI_API_KEY environment variable.');
  console.error('    Get your free key at: https://aistudio.google.com/apikey');
  console.error('    Then run: GEMINI_API_KEY=your_key node scripts/generate-images.mjs\n');
  process.exit(1);
}

const CAMPAIGN_TYPE = getArg('--type') || 'hero';
const COUNT = Math.min(4, Math.max(1, parseInt(getArg('--count') || '1', 10)));
const ASPECT = getArg('--aspect') || '16:9';
const OUT_DIR = path.resolve(ROOT, getArg('--out') || 'public/generated-ads');
const CUSTOM_PROMPT = getArg('--prompt');
const USE_FAST = hasFlag('--fast');
const DO_OVERLAY = hasFlag('--overlay');

const VALID_ASPECTS = ['16:9', '1:1', '4:3', '9:16', '3:4'];
if (!VALID_ASPECTS.includes(ASPECT)) {
  console.error(`\n❌  Invalid --aspect "${ASPECT}". Valid options: ${VALID_ASPECTS.join(' | ')}\n`);
  process.exit(1);
}

const VALID_TYPES = [...Object.keys(CAMPAIGNS), 'all'];
if (!VALID_TYPES.includes(CAMPAIGN_TYPE)) {
  console.error(`\n❌  Unknown --type "${CAMPAIGN_TYPE}". Valid options: ${VALID_TYPES.join(' | ')}\n`);
  process.exit(1);
}

// ─── Gemini Imagen API ────────────────────────────────────────────────────────
const MODEL = USE_FAST ? 'imagen-3.0-fast-generate-001' : 'imagen-3.0-generate-002';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict?key=${API_KEY}`;

async function callImagenAPI(prompt, sampleCount) {
  const payload = {
    instances: [{ prompt }],
    parameters: {
      sampleCount,
      aspectRatio: ASPECT,
      safetyFilterLevel: 'block_few',
      personGeneration: 'dont_allow',
      outputOptions: {
        mimeType: 'image/png',
      },
    },
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let hint = '';
    if (res.status === 400) hint = ' (check prompt for policy violations)';
    if (res.status === 401 || res.status === 403) hint = ' (check your GEMINI_API_KEY)';
    if (res.status === 429) hint = ' (rate limit — wait a minute and retry)';
    if (res.status === 404) hint = ' (model not available in your region/plan)';
    throw new Error(`HTTP ${res.status}${hint}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.predictions ?? [];
}

// ─── Logo Overlay (optional — requires sharp) ─────────────────────────────────
async function withLogoOverlay(imageBuffer) {
  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch {
    console.warn('  ⚠️  sharp not found — skipping overlay. Install it with: npm install sharp');
    return imageBuffer;
  }

  if (!fs.existsSync(LOGO_PATH)) {
    console.warn(`  ⚠️  Logo not found at ${LOGO_PATH} — skipping overlay.`);
    return imageBuffer;
  }

  try {
    const logoBuffer = fs.readFileSync(LOGO_PATH);
    const meta = await sharp(imageBuffer).metadata();

    // Logo = 18% of image width, positioned 3% margin from bottom-left
    const logoW = Math.round(meta.width * 0.18);
    const margin = Math.round(meta.width * 0.03);

    const resizedLogo = await sharp(logoBuffer)
      .resize(logoW, null, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();

    const logoMeta = await sharp(resizedLogo).metadata();

    return sharp(imageBuffer)
      .composite([{
        input: resizedLogo,
        left: margin,
        top: meta.height - logoMeta.height - margin,
      }])
      .png()
      .toBuffer();
  } catch (err) {
    console.warn(`  ⚠️  Logo overlay failed: ${err.message}`);
    return imageBuffer;
  }
}

// ─── Save One Image ───────────────────────────────────────────────────────────
async function saveImage(b64data, filename) {
  let buf = Buffer.from(b64data, 'base64');
  if (DO_OVERLAY) buf = await withLogoOverlay(buf);
  const filepath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filepath, buf);
  return filepath;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function bar(current, total, width = 30) {
  const filled = Math.round((current / total) * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${current}/${total}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const campaignEntries = CAMPAIGN_TYPE === 'all'
    ? Object.entries(CAMPAIGNS)
    : [[CAMPAIGN_TYPE, CAMPAIGNS[CAMPAIGN_TYPE]]];

  const totalPrompts = campaignEntries.reduce((sum, [, c]) => {
    return sum + (CUSTOM_PROMPT ? 1 : c.prompts.length);
  }, 0);

  console.log(`
🎨  Patience AI — Gemini Imagen 3 Ad Generator
${'─'.repeat(50)}
  Model     : ${MODEL}
  Type      : ${CAMPAIGN_TYPE}${CAMPAIGN_TYPE === 'all' ? ` (${campaignEntries.length} campaigns)` : ''}
  Aspect    : ${ASPECT}
  Count     : ${COUNT} image${COUNT > 1 ? 's' : ''} per prompt
  Overlay   : ${DO_OVERLAY ? 'yes (Patience AI logo, bottom-left)' : 'no'}
  Output    : ${OUT_DIR}
  Prompts   : ${totalPrompts} total
${'─'.repeat(50)}`);

  let done = 0;
  let savedTotal = 0;
  const allResults = [];

  for (const [type, campaign] of campaignEntries) {
    const prompts = CUSTOM_PROMPT ? [CUSTOM_PROMPT] : campaign.prompts;
    console.log(`\n▶  ${campaign.label}`);

    for (let pi = 0; pi < prompts.length; pi++) {
      const prompt = prompts[pi];
      const preview = prompt.length > 90 ? prompt.slice(0, 90) + '…' : prompt;

      done++;
      process.stdout.write(`   ${bar(done, totalPrompts)}  Prompt ${pi + 1}/${prompts.length}\r`);

      let predictions;
      try {
        predictions = await callImagenAPI(prompt, COUNT);
      } catch (err) {
        console.log('');
        console.error(`   ❌  ${err.message}`);
        // Rate limit backoff
        if (err.message.includes('429')) {
          console.log('   ⏳  Waiting 60s for rate limit reset…');
          await new Promise(r => setTimeout(r, 60_000));
        }
        continue;
      }

      console.log('');

      let saved = 0;
      for (let vi = 0; vi < predictions.length; vi++) {
        const pred = predictions[vi];
        if (!pred?.bytesBase64Encoded) {
          console.warn(`   ⚠️  Variant ${vi + 1}: no image data returned (filtered or empty)`);
          continue;
        }

        const ts = Date.now();
        const filename = `${type}-p${pi + 1}-v${vi + 1}-${ts}.png`;

        try {
          const filepath = await saveImage(pred.bytesBase64Encoded, filename);
          console.log(`   ✅  ${path.relative(ROOT, filepath)}`);
          allResults.push({ type, label: campaign.label, file: filepath, prompt: preview });
          saved++;
          savedTotal++;
        } catch (saveErr) {
          console.error(`   ❌  Save failed: ${saveErr.message}`);
        }
      }

      if (saved === 0 && predictions.length > 0) {
        console.warn(`   ⚠️  Prompt ${pi + 1} returned ${predictions.length} prediction(s) but none had image data`);
      }

      // Polite delay between prompts to avoid hitting rate limits
      if (pi < prompts.length - 1 || campaignEntries.indexOf([type, campaign]) < campaignEntries.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✨  Complete — ${savedTotal} image${savedTotal !== 1 ? 's' : ''} generated\n`);

  if (allResults.length) {
    // Group by campaign type
    const byType = {};
    for (const r of allResults) {
      (byType[r.label] ??= []).push(r);
    }
    for (const [label, items] of Object.entries(byType)) {
      console.log(`  ${label} (${items.length})`);
      for (const item of items) {
        console.log(`    → ${path.relative(ROOT, item.file)}`);
      }
    }
  }

  console.log(`
💡  Next steps:
   • Serve images via: /generated-ads/<filename>
   • Add --overlay flag to composite the Patience AI logo
   • Use --count 4 to generate multiple creative variants
   • Use --type all --count 2 for a full campaign set
   • Import into blog posts, product pages, newsletter headers
`);
}

run().catch(err => {
  console.error(`\n💥  Fatal error: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
