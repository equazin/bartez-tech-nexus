import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import usersHandler from "./api/users";
import commerceHandler from "./api/commerce";
import pricingHandler from "./api/pricing";
import productsHandler from "./api/products";
import emailHandler from "./api/email";
import checkoutHandler from "./api/checkout";
import airProxyHandler from "./api/air-proxy";
const ELIT_BASE = "https://clientes.elit.com.ar/v1/api";

const ELIT_ALLOWED_PATHS = new Set(["productos"]);

function resolveEnvValue(env: Record<string, string>, key: string): string {
  return env[key]?.trim() || process.env[key]?.trim() || "";
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function attachVercelCompat(res: ServerResponse) {
  const target = res as ServerResponse & {
    status: (code: number) => typeof target;
    json: (payload: unknown) => typeof target;
  };

  target.status = (code: number) => {
    target.statusCode = code;
    return target;
  };

  target.json = (payload: unknown) => {
    if (!target.getHeader("Content-Type")) {
      target.setHeader("Content-Type", "application/json");
    }
    target.end(JSON.stringify(payload));
    return target;
  };

  return target;
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(payload));
}

async function sendFetchResponse(res: ServerResponse, upstream: Response) {
  const contentType = upstream.headers.get("content-type") || "application/json";
  const body = Buffer.from(await upstream.arrayBuffer());
  res.statusCode = upstream.status;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(body);
}

async function invokeFetchHandler(
  req: IncomingMessage,
  res: ServerResponse,
  requestUrl: URL,
  handler: (request: Request) => Promise<Response>,
) {
  const rawBody = await readRequestBody(req);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    } else if (value != null) {
      headers.set(key, value);
    }
  }

  const request = new Request(requestUrl, {
    method: req.method ?? "GET",
    headers,
    body:
      req.method && !["GET", "HEAD"].includes(req.method.toUpperCase()) && rawBody
        ? rawBody
        : undefined,
  });

  const response = await handler(request);
  await sendFetchResponse(res, response);
}

function devApiProxyPlugin(env: Record<string, string>): PluginOption {
  return {
    name: "dev-api-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = req.url ? new URL(req.url, "http://localhost") : null;
        const pathname = requestUrl?.pathname ?? "";

        if (requestUrl && pathname === "/api/checkout") {
          try {
            await invokeFetchHandler(req, res, requestUrl, checkoutHandler);
            return;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            sendJson(res, 500, { ok: false, error: message });
            return;
          }
        }

        if (requestUrl && pathname === "/api/air-proxy") {
          try {
            await invokeFetchHandler(req, res, requestUrl, airProxyHandler);
            return;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            sendJson(res, 500, { ok: false, error: message });
            return;
          }
        }

        const MAPPING: Record<string, { handler: any; scope?: string; resource?: string }> = {
          "/api/users":       { handler: usersHandler },
          "/api/create-user": { handler: usersHandler },
          "/api/profiles":    { handler: usersHandler,   scope: "profile" },
          "/api/impersonate": { handler: usersHandler,   scope: "impersonate" },
          "/api/commerce":    { handler: commerceHandler },
          "/api/quotes":      { handler: commerceHandler, resource: "quotes" },
          "/api/rma":         { handler: commerceHandler, resource: "rma" },
          "/api/pricing":     { handler: pricingHandler },
          "/api/coupons":     { handler: pricingHandler }, // vercel.json has /api/coupons -> /api/pricing/coupons but local handler checks subpath
          "/api/products":    { handler: productsHandler },
          "/api/stock":       { handler: productsHandler, scope: "stock" },
          "/api/email":       { handler: emailHandler },
          "/api/contact":     { handler: emailHandler,    scope: "contact" },
        };

        const matched = MAPPING[pathname];
        if (matched) {
          try {
            const rawBody = await readRequestBody(req);
            const parsedBody = rawBody ? JSON.parse(rawBody) : {};
            const vercelReq = req as IncomingMessage & {
              body?: unknown;
              query?: Record<string, string>;
            };

            vercelReq.body = parsedBody;
            const query = Object.fromEntries(requestUrl?.searchParams.entries() ?? []);
            if (matched.scope)    query.scope = matched.scope;
            if (matched.resource) query.resource = matched.resource;
            vercelReq.query = query;

            const vercelRes = attachVercelCompat(res);
            await matched.handler(vercelReq as never, vercelRes as never);
            return;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            sendJson(res, 500, { ok: false, error: message });
            return;
          }
        }

        if (pathname !== "/api/elit-proxy") {
          next();
          return;
        }

        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "Method not allowed. Use POST." });
          return;
        }

        try {
          const pathParam = requestUrl?.searchParams.get("path") ?? "";
          if (!pathParam || !ELIT_ALLOWED_PATHS.has(pathParam)) {
            sendJson(res, 400, { ok: false, error: "Missing or disallowed path parameter." });
            return;
          }

          const userId = resolveEnvValue(env, "ELIT_API_USER_ID");
          const token = resolveEnvValue(env, "ELIT_API_TOKEN");
          if (!userId || !token) {
            sendJson(res, 500, { ok: false, error: "ELIT credentials not configured." });
            return;
          }

          const query = new URLSearchParams();
          requestUrl?.searchParams.forEach((value, key) => {
            if (key !== "path") {
              query.set(key, value);
            }
          });
          if (!query.has("limit")) {
            query.set("limit", "100");
          }

          const rawBody = await readRequestBody(req);
          let body: Record<string, unknown> = {};
          if (rawBody) {
            const parsed = JSON.parse(rawBody);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              body = parsed as Record<string, unknown>;
            }
          }

          const elitUrl = `${ELIT_BASE}/${pathParam}?${query.toString()}`;
          const upstream = await fetch(elitUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...body,
              user_id: Number(userId),
              token,
            }),
          });

          await sendFetchResponse(res, upstream);
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          sendJson(res, 502, { ok: false, error: message });
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Make Vercel-style handlers work under `vite dev` by exposing loaded env vars
  // through process.env before the in-process API handlers execute.
  for (const key of [
    "VITE_SUPABASE_URL",
    "SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "AIR_API_TOKEN",
    "AIR_API_USER",
    "AIR_API_PASS",
    "AIR_TOKEN",
    "VITE_AIR_TOKEN",
    "ELIT_API_USER_ID",
    "ELIT_API_TOKEN",
  ]) {
    if (env[key]) {
      process.env[key] = env[key];
    }
  }

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), devApiProxyPlugin(env)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, "/");

            if (!normalizedId.includes("node_modules")) {
              return undefined;
            }

            if (
              normalizedId.includes("/react/") ||
              normalizedId.includes("/react-dom/") ||
              normalizedId.includes("/react-router/") ||
              normalizedId.includes("/react-router-dom/") ||
              normalizedId.includes("/scheduler/") ||
              normalizedId.includes("/@tanstack/react-query/")
            ) {
              return "framework";
            }

            if (normalizedId.includes("/@supabase/")) {
              return "supabase";
            }

            if (normalizedId.includes("/jspdf/") || normalizedId.includes("/jspdf-autotable/")) {
              return "jspdf-vendor";
            }

            if (normalizedId.includes("/html2canvas/")) {
              return "html2canvas-vendor";
            }

            if (
              normalizedId.includes("/@radix-ui/") ||
              normalizedId.includes("/lucide-react/") ||
              normalizedId.includes("/cmdk/") ||
              normalizedId.includes("/class-variance-authority/") ||
              normalizedId.includes("/clsx/") ||
              normalizedId.includes("/tailwind-merge/")
            ) {
              return "ui-vendor";
            }

            // Let Rollup decide the rest to avoid artificial circular chunk groups.
            return undefined;
          },
        },
      },
    },
  };
});
