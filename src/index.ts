import type { Context } from "hono";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { resolveCallback, HtmlEscapedCallbackPhase } from "hono/utils/html";
import { some } from "hono/combine";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";

import { writeFile } from "fs/promises";
import { build } from "esbuild";

const evalSvgMiddleware = createMiddleware(async (c, next) => {
  await next();

  const source = await c.res.clone().text();
  const result = await build({
    stdin: {
      contents: source,
      loader: "tsx",
      resolveDir: ".",
    },
    write: false,
    bundle: true,
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "hono/jsx",
  });
  const jsxNode = eval(result.outputFiles[0].text);
  const out = await resolveCallback(
    jsxNode.toString(),
    HtmlEscapedCallbackPhase.Stringify,
    false,
    {}
  );

  const outPath = new URL(c.req.url).pathname.replace("/static/", "./static/");
  await writeFile(outPath, out);

  c.res = new Response(out, {
    headers: {
      "content-type": "image/svg+xml",
      "content-length": out.length.toString(),
    },
  });
});

const app = new Hono();

app.get(
  "/static/*",
  some((c: Context) => !c.req.query("eval"), evalSvgMiddleware),
  serveStatic({ root: "./" })
);

const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
