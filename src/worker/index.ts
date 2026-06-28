export interface Env {
  ASSETS: Fetcher;
  BUILD_HOOK_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.BUILD_HOOK_URL) {
      throw new Error("[cron] BUILD_HOOK_URL is not set");
    }
    const hookUrl = env.BUILD_HOOK_URL;
    ctx.waitUntil(
      (async () => {
        try {
          const res = await fetch(hookUrl, { method: "POST" });
          if (!res.ok) {
            const body = await res.text().catch(() => "<unreadable body>");
            throw new Error(`[cron] deploy hook failed: ${res.status} ${body}`);
          }
          console.log(`[cron] deploy hook triggered: ${res.status}`);
        } catch (err) {
          console.error("[cron] deploy hook error:", err);
          throw err;
        }
      })()
    );
  },
} satisfies ExportedHandler<Env>;
