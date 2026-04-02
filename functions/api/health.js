export async function onRequestGet(context) {
  const hasDB = Boolean(context.env?.DB);
  const hasCache = Boolean(context.env?.CACHE);
  let dbStatus = "not_configured";

  if (hasDB) {
    try {
      await context.env.DB.prepare("SELECT 1 as ok").first();
      dbStatus = "ok";
    } catch (error) {
      dbStatus = "error";
    }
  }

  return Response.json({
    ok: true,
    service: "praan-pages-functions",
    time: new Date().toISOString(),
    bindings: {
      DB: hasDB,
      CACHE: hasCache
    },
    dbStatus
  });
}
