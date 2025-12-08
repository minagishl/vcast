import { VcastState } from "./state.js";
import { parseStream } from "./stream.js";

export async function handleMcpRequest(request: Request, state: VcastState): Promise<Response> {
  try {
    const body = await request.json();
    const { id, method, params } = body;

    const respond = (result: unknown, error?: string) => {
      const payload = error ? { id, error } : { id, result };
      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      });
    };

    switch (method) {
      case "listSources":
        return respond(state.snapshot().sources);
      case "addSource": {
        const target = params?.url;
        if (!target) return respond(null, "url is required");
        const parsed = parseStream(target);
        const created = await state.addSource(parsed);
        return respond(created);
      }
      case "removeSource": {
        const sourceId = params?.id;
        if (!sourceId) return respond(null, "id is required");
        await state.removeSource(sourceId);
        return respond({ ok: true });
      }
      case "updateLayout": {
        await state.updateLayout(params || {});
        return respond(state.snapshot().layout);
      }
      case "updateAudio": {
        const sourceId = params?.id;
        if (!sourceId) return respond(null, "id is required");
        await state.updateAudio(sourceId, params);
        return respond(state.snapshot().audio[sourceId]);
      }
      case "updateWindow": {
        const sourceId = params?.id;
        if (!sourceId) return respond(null, "id is required");
        await state.updateWindow(sourceId, params);
        return respond(state.snapshot().windows[sourceId]);
      }
      default:
        return respond(null, "Unknown method");
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
