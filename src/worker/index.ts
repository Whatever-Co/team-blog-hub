export interface Env {
  ASSETS: Fetcher;
  BUILD_HOOK_URL: string;
  SITE_ORIGIN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.BUILD_HOOK_URL) {
      console.error("[cron] BUILD_HOOK_URL is not set");
      return;
    }
    ctx.waitUntil(
      fetch(env.BUILD_HOOK_URL, { method: "POST" }).then(async (res) => {
        if (!res.ok) {
          console.error(`[cron] deploy hook failed: ${res.status} ${await res.text()}`);
        } else {
          console.log(`[cron] deploy hook triggered: ${res.status}`);
        }
      })
    );
  },
};
