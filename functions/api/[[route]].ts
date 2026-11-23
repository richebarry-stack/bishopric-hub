// API entry point (Cloudflare Pages Functions catch-all for /api/*). Each route group
// lives in its own module under ./_lib; the order below is the order routes are matched,
// and it matters: public routes run before the session check, and the per-hub access
// rules run before the generic CRUD handler.
import { getSession, json, type Ctx, type Env } from './_lib/core';
import { handleAuth } from './_lib/auth';
import { handlePublic } from './_lib/public';
import { handleUsers } from './_lib/users';
import { maybeRunDailyJobs } from './_lib/dailyJobs';
import { handleAccount } from './_lib/account';
import { handleAdmin } from './_lib/admin';
import { handleHubAccess } from './_lib/hubAccess';
import { handleAutomation } from './_lib/automation';
import { handleLcrSync } from './_lib/lcrSync';
import { handleCrud } from './_lib/crud';

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params, waitUntil } = context;
  const ctx: Ctx = {
    request,
    env,
    db: env.DB,
    url: new URL(request.url),
    routeParts: (params.route as string[]) || [],
    method: request.method,
    waitUntil: p => waitUntil(p),
  };

  // No session needed (users checks its own).
  for (const handle of [handleAuth, handlePublic, handleUsers]) {
    const res = await handle(ctx);
    if (res) return res;
  }

  const session = await getSession(request, ctx.db);
  if (!session) return json({ error: 'Unauthorized' }, 401);
  await maybeRunDailyJobs(ctx, session);

  for (const handle of [handleAccount, handleAdmin, handleHubAccess, handleAutomation, handleLcrSync]) {
    const res = await handle(ctx, session);
    if (res) return res;
  }
  return handleCrud(ctx, session);
};
