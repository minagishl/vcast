import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { VcastState } from "./state.js";
import { parseStream } from "./stream.js";
import { handleMcpRequest } from "./mcp.js";
import type { ServerWebSocket } from "bun";

export type ServerOptions = {
  port?: number;
  host?: string;
};

type WebSocketClient = ServerWebSocket<{ kind: "client" }>;

// Points to dist/public when running the built version
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "public");

async function readJson<T>(request: Request): Promise<T> {
  const text = await request.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function serveStatic(pathname: string): Promise<Response> {
  const safePath =
    pathname === "/" ? "/index.html" : pathname === "/view" ? "/view.html" : pathname;
  const target = join(PUBLIC_DIR, safePath.replace(/^\//, ""));
  try {
    const file = Bun.file(target);
    if (!(await file.exists())) return new Response("Not found", { status: 404 });
    const ext = target.split(".").pop();
    const type =
      ext === "html"
        ? "text/html"
        : ext === "js"
          ? "application/javascript"
          : ext === "css"
            ? "text/css"
            : "application/octet-stream";
    return new Response(file, { headers: { "Content-Type": type } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function startServer(options: ServerOptions = {}) {
  const state = new VcastState();
  await state.initSkeleton();
  state.watchExternal();

  const clients = new Set<WebSocketClient>();

  const broadcast = (payload: unknown) => {
    const message = JSON.stringify(payload);
    for (const client of clients) {
      try {
        client.send(message);
      } catch (err) {
        console.error("WebSocket send failed", err);
      }
    }
  };

  state.onChange((cfg) => broadcast({ type: "state", data: cfg }));

  const server = Bun.serve<{ kind: "client" }>({
    port: options.port || 3579,
    hostname: options.host || "127.0.0.1",
    fetch: async (request, server) => {
      const url = new URL(request.url);

      if (url.pathname === "/ws") {
        if (server.upgrade(request, { data: { kind: "client" } })) {
          return new Response(null);
        }
        return new Response("Failed to upgrade", { status: 400 });
      }

      if (url.pathname === "/mcp" && request.method === "POST") {
        return handleMcpRequest(request, state);
      }

      if (url.pathname === "/api/state" && request.method === "GET") {
        return json(state.snapshot());
      }

      if (url.pathname === "/api/sources" && request.method === "GET") {
        return json(state.snapshot().sources);
      }

      if (url.pathname === "/api/add" && request.method === "POST") {
        const body = await readJson<{ url?: string }>(request);
        if (!body.url) return json({ error: "url required" }, 400);
        try {
          const parsed = parseStream(body.url);
          const created = await state.addSource(parsed);
          broadcast({ type: "added", data: created });
          return json(created);
        } catch (err: any) {
          return json({ error: err?.message || "unable to add" }, 400);
        }
      }

      if (url.pathname === "/api/remove" && request.method === "POST") {
        const body = await readJson<{ id?: string }>(request);
        if (!body.id) return json({ error: "id required" }, 400);
        await state.removeSource(body.id);
        broadcast({ type: "removed", id: body.id });
        return json({ ok: true });
      }

      if (url.pathname === "/api/layout" && request.method === "POST") {
        const body = await readJson<{ rows?: number; columns?: number }>(request);
        await state.updateLayout({ rows: body.rows, columns: body.columns });
        broadcast({ type: "layout", data: state.snapshot().layout });
        return json(state.snapshot().layout);
      }

      if (url.pathname === "/api/audio" && request.method === "POST") {
        const body = await readJson<{ id?: string; volume?: number; muted?: boolean }>(request);
        if (!body.id) return json({ error: "id required" }, 400);
        await state.updateAudio(body.id, { volume: body.volume, muted: body.muted });
        broadcast({ type: "audio", id: body.id, data: state.snapshot().audio[body.id] });
        return json(state.snapshot().audio[body.id]);
      }

      if (url.pathname === "/api/window" && request.method === "POST") {
        const body = await readJson<{
          id?: string;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
        }>(request);
        if (!body.id) return json({ error: "id required" }, 400);
        await state.updateWindow(body.id, {
          x: body.x,
          y: body.y,
          width: body.width,
          height: body.height,
        });
        broadcast({ type: "window", id: body.id, data: state.snapshot().windows[body.id] });
        return json(state.snapshot().windows[body.id]);
      }

      if (url.pathname === "/api/reorder" && request.method === "POST") {
        const body = await readJson<{ order?: string[] }>(request);
        if (!body.order) return json({ error: "order required" }, 400);
        await state.reorder(body.order);
        broadcast({ type: "state", data: state.snapshot() });
        return json({ ok: true });
      }

      if (url.pathname === "/api/text-overlay" && request.method === "POST") {
        const body = await readJson<{
          text?: string;
          position?: "top" | "bottom" | "left" | "right";
          scrolling?: boolean;
        }>(request);
        await state.updateTextOverlay({
          text: body.text,
          position: body.position,
          scrolling: body.scrolling,
        });
        broadcast({ type: "textOverlay", data: state.snapshot().textOverlay });
        return json(state.snapshot().textOverlay);
      }

      if (url.pathname === "/api/show-ids" && request.method === "POST") {
        const body = await readJson<{ showIds?: boolean }>(request);
        if (body.showIds === undefined) return json({ error: "showIds required" }, 400);
        await state.updateShowIds(body.showIds);
        broadcast({ type: "showIds", data: state.snapshot().showIds });
        return json({ showIds: state.snapshot().showIds });
      }

      if (url.pathname === "/api/youtube-nocookie" && request.method === "POST") {
        const body = await readJson<{ youtubeNoCookie?: boolean }>(request);
        if (body.youtubeNoCookie === undefined)
          return json({ error: "youtubeNoCookie required" }, 400);
        await state.updateYoutubeNoCookie(body.youtubeNoCookie);
        broadcast({ type: "youtubeNoCookie", data: state.snapshot().youtubeNoCookie });
        return json({ youtubeNoCookie: state.snapshot().youtubeNoCookie });
      }

      if (url.pathname === "/api/hide-cursor" && request.method === "POST") {
        const body = await readJson<{ hideCursor?: boolean }>(request);
        if (body.hideCursor === undefined) return json({ error: "hideCursor required" }, 400);
        await state.updateHideCursor(body.hideCursor);
        broadcast({ type: "hideCursor", data: state.snapshot().hideCursor });
        return json({ hideCursor: state.snapshot().hideCursor });
      }

      return serveStatic(url.pathname);
    },
    websocket: {
      open(ws) {
        clients.add(ws);
        ws.send(JSON.stringify({ type: "state", data: state.snapshot() }));
      },
      close(ws) {
        clients.delete(ws as WebSocketClient);
      },
      async message(ws, message) {
        try {
          const text =
            typeof message === "string"
              ? message
              : new TextDecoder().decode(message as unknown as Buffer<ArrayBuffer>);
          const payload = JSON.parse(text);
          const type = payload.type;
          if (type === "add" && payload.url) {
            const parsed = parseStream(payload.url);
            const created = await state.addSource(parsed);
            broadcast({ type: "added", data: created });
          }
          if (type === "remove" && payload.id) {
            await state.removeSource(payload.id);
            broadcast({ type: "removed", id: payload.id });
          }
          if (type === "layout") {
            await state.updateLayout(payload.data || {});
            broadcast({ type: "layout", data: state.snapshot().layout });
          }
          if (type === "audio" && payload.id) {
            await state.updateAudio(payload.id, payload.data || {});
            broadcast({ type: "audio", id: payload.id, data: state.snapshot().audio[payload.id] });
          }
          if (type === "window" && payload.id) {
            await state.updateWindow(payload.id, payload.data || {});
            broadcast({
              type: "window",
              id: payload.id,
              data: state.snapshot().windows[payload.id],
            });
          }
          if (type === "reorder" && Array.isArray(payload.order)) {
            await state.reorder(payload.order);
            broadcast({ type: "state", data: state.snapshot() });
          }
          if (type === "textOverlay" && payload.data) {
            await state.updateTextOverlay(payload.data);
            broadcast({ type: "textOverlay", data: state.snapshot().textOverlay });
          }
          if (type === "showIds" && typeof payload.data === "boolean") {
            await state.updateShowIds(payload.data);
            broadcast({ type: "showIds", data: state.snapshot().showIds });
          }
          if (type === "youtubeNoCookie" && typeof payload.data === "boolean") {
            await state.updateYoutubeNoCookie(payload.data);
            broadcast({ type: "youtubeNoCookie", data: state.snapshot().youtubeNoCookie });
          }
          if (type === "hideCursor" && typeof payload.data === "boolean") {
            await state.updateHideCursor(payload.data);
            broadcast({ type: "hideCursor", data: state.snapshot().hideCursor });
          }
          if (type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
          }
        } catch (err) {
          console.error("WS message error", err);
        }
      },
    },
  });

  const address = `http://${server.hostname}:${server.port}`;
  console.log(`vcast server running at ${address}`);

  const getClientCount = () => clients.size;

  return { server, state, address, broadcast, getClientCount };
}
