/**
 * Netlify scheduled function: keep-alive pinger for the Render backend.
 *
 * Render's free tier spins a web service down after ~15 minutes without
 * HTTP traffic, making the next visitor wait ~50 seconds for a cold start.
 * This function pings /api/health every 10 minutes, so the API is always
 * warm. It deploys with the site — no external pinger service or extra
 * account needed.
 *
 * Inspect invocations in the Netlify dashboard under Functions → ping-render.
 * Trigger manually (POST to /.netlify/functions/ping-render) to test.
 *
 * The target URL can be overridden with the RENDER_HEALTH_URL env var in
 * the Netlify dashboard (Site configuration → Environment variables).
 */
export const config = {
  // Every 10 minutes: comfortably inside Render's 15-minute spin-down window.
  schedule: "*/10 * * * *",
};

const TARGET =
  process.env.RENDER_HEALTH_URL ?? "https://unlawyered.onrender.com/api/health";

export default async (): Promise<Response> => {
  const started = Date.now();
  try {
    // Stay under Netlify's 10s function timeout. If Render is cold, the
    // request still starts the wake-up even when this fetch aborts.
    const res = await fetch(TARGET, { signal: AbortSignal.timeout(8_000) });
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return new Response(
      JSON.stringify({
        pinged: TARGET,
        status: res.status,
        ok: res.ok && body?.ok === true,
        latencyMs: Date.now() - started,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    // Expected while Render is waking from cold or mid-deploy; the next
    // scheduled ping 10 minutes later confirms it came up.
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        pinged: TARGET,
        ok: false,
        latencyMs: Date.now() - started,
        error: message,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
};
