import { defineConfig, loadEnv, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';

const GUIDE_PATH = '/api/guide';
const GUIDE_SYSTEM_PROMPT = [
  'You are SAARTHI, the standing commander-support assistant inside Project Interceptor, a fictional border-post drone-observation training simulator.',
  'Address the operator as "Commander". Speak like a calm, experienced military commander-mentor: short decisive sentences, no hype, no emoji.',
  'Base every statement ONLY on the JSON state in the user message. Never invent sensor data, contacts, probabilities or confidence figures; if the state does not show it, omit it or say the information is not available.',
  'Never reveal hidden scenario truth, authored future behaviour or rubric expectations. Treat the state you receive as the ceiling of what may be discussed.',
  'Give ordered, step-appropriate guidance for the CURRENT step: two to four numbered plain-text steps, at most 110 words, referencing contacts by their given labels only. Where evidence is insufficient, direct the operator to request more sources. Decisions are high-level simulated commands; do not give weapon-handling detail.',
  'Plain text only: no markdown symbols, no headings, no asterisks.',
].join(' ');

type GuideEnv = { endpoint?: string; apiKey?: string; model?: string };

function readGuideEnv(mode: string, root: string): GuideEnv {
  const env = loadEnv(mode, root, '');
  return { endpoint: env.MODEL_ENDPOINT?.trim() || undefined, apiKey: env.MODEL_API_KEY?.trim() || undefined, model: env.MODEL?.trim() || 'gemini-2.5-flash' };
}

/** Serves POST /api/guide in dev and preview so the browser never sees the model credentials. */
function modelGuidePlugin(): Plugin {
  let guide: GuideEnv = {};
  return {
    name: 'interceptor-model-guide',
    configResolved(config) {
      guide = readGuideEnv(config.mode ?? 'development', config.root ?? process.cwd());
    },
    configureServer(server) {
      attachGuideRoute(server.middlewares, () => guide);
    },
    configurePreviewServer(server) {
      attachGuideRoute(server.middlewares, () => guide);
    },
  };
}

type GuideRouteServer = { use: (path: string, handler: (request: IncomingMessage, response: ServerResponse) => void) => void };

function attachGuideRoute(middlewares: GuideRouteServer, get: () => GuideEnv): void {
  middlewares.use(GUIDE_PATH, (request, response) => {
    const chunks: Buffer[] = [];
    let size = 0, aborted = false;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > 80_000) { aborted = true; chunks.length = 0; return; }
      chunks.push(chunk);
    });
    request.on('end', () => {
      void handleGuideRequest(aborted, Buffer.concat(chunks).toString('utf8'), get(), response);
    });
  });
}

type ChatCompletion = { choices?: Array<{ message?: { content?: unknown } }> };

async function handleGuideRequest(aborted: boolean, raw: string, guide: GuideEnv, response: ServerResponse): Promise<void> {
  const fail = (status: number, error: string, quota = false) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: false, error, ...(quota ? { quota: true } : {}) }));
  };
  if (aborted) return fail(413, 'Guide request too large.');
  let payload: { context?: unknown; question?: unknown } = {};
  try { payload = JSON.parse(raw || '{}') as typeof payload; } catch { return fail(400, 'Invalid guide request.'); }
  if (!guide.endpoint || !guide.apiKey) return fail(503, 'Model guide is not configured. Set MODEL_ENDPOINT and MODEL_API_KEY in .env, then restart.');
  const messages = [
    { role: 'system', content: GUIDE_SYSTEM_PROMPT },
    { role: 'user', content: (typeof payload.question === 'string' && payload.question.trim() ? `Operator question: ${payload.question.trim()}\n\n` : '') + `SESSION STATE: ${JSON.stringify(payload.context ?? {})}` },
  ];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const upstream = await fetch(`${guide.endpoint.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guide.apiKey}` },
        body: JSON.stringify({ model: guide.model, temperature: 0.6, max_tokens: 700, messages }),
      });
      if (upstream.ok) {
        const data = await upstream.json() as ChatCompletion;
        const text = data.choices?.[0]?.message?.content;
        if (typeof text === 'string' && text.trim()) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ ok: true, text: text.trim(), model: guide.model }));
          return;
        }
        throw new Error('Model returned an empty completion.');
      }
      if (upstream.status === 429) {
        return fail(502, 'Model quota exhausted (free-tier daily limit) — local commander rules active until the key resets.', true);
      }
      if (upstream.status >= 500 || upstream.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
        continue;
      }
      const detail = (await upstream.text().catch(() => '')).slice(0, 200);
      return fail(502, `Model endpoint returned ${upstream.status}. ${detail}`);
    } catch (error) {
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
        continue;
      }
      return fail(502, `Model guide unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return fail(502, 'Model endpoint kept returning transient errors.');
}

export default defineConfig({
  plugins: [react(), modelGuidePlugin()],
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
});
