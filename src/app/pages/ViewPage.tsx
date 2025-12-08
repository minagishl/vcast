import { useEffect, useState, useRef } from "react";

type Source = {
  id: string;
  platform: string;
  originalUrl: string;
  embedUrl: string;
};

type TextOverlay = {
  text: string;
  position: "top" | "bottom" | "left" | "right";
  scrolling: boolean;
};

type AppState = {
  sources: Source[];
  layout: {
    rows: number;
    columns: number;
  };
  audio: Record<string, { volume: number; muted: boolean }>;
  windows: Record<string, { width: number; height: number; x?: number; y?: number }>;
  textOverlay: TextOverlay;
};

type WsMessage =
  | { type: "state"; data: AppState }
  | { type: "added" | "removed" | "layout" }
  | { type: "textOverlay"; data: TextOverlay };

function calculateLayout(count: number) {
  if (count === 0) return { columns: 1, rows: 1 };
  if (count === 1) return { columns: 1, rows: 1 };
  if (count === 2) return { columns: 2, rows: 1 };

  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);

  return { columns, rows };
}

function groupByRows(sources: Source[], columns: number): Source[][] {
  const rows: Source[][] = [];
  for (let i = 0; i < sources.length; i += columns) {
    rows.push(sources.slice(i, i + columns));
  }
  return rows;
}

export default function ViewPage() {
  const [state, setState] = useState<AppState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchState();
    connectWs();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  async function fetchState() {
    const res = await fetch("/api/state");
    if (res.ok) {
      setState(await res.json());
    }
  }

  function connectWs() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${location.host}/ws`);
    wsRef.current = ws;

    ws.onclose = () => {
      setTimeout(connectWs, 1500);
    };

    ws.onmessage = (event) => {
      try {
        const payload: WsMessage = JSON.parse(event.data);
        if (payload.type === "state") {
          setState(payload.data);
        }
        if (payload.type === "added" || payload.type === "removed" || payload.type === "layout") {
          fetchState();
        }
        if (payload.type === "textOverlay") {
          setState((prev) => (prev ? { ...prev, textOverlay: payload.data } : null));
        }
      } catch (err) {
        console.error(err);
      }
    };
  }

  if (!state) return null;

  const layout = calculateLayout(state.sources.length);
  const rows = groupByRows(state.sources, layout.columns);
  const overlay = state.textOverlay;

  const getOverlayPositionStyles = () => {
    const baseStyles = "absolute z-10 text-white px-4 py-2 text-2xl font-bold";
    const bgStyles = "bg-black/70";

    switch (overlay.position) {
      case "top":
        return `${baseStyles} ${bgStyles} top-0 left-0 right-0 text-center`;
      case "bottom":
        return `${baseStyles} ${bgStyles} bottom-0 left-0 right-0 text-center`;
      case "left":
        return `${baseStyles} ${bgStyles} top-0 bottom-0 left-0 flex items-center writing-mode-vertical-rl`;
      case "right":
        return `${baseStyles} ${bgStyles} top-0 bottom-0 right-0 flex items-center writing-mode-vertical-rl`;
      default:
        return `${baseStyles} ${bgStyles} top-0 left-0 right-0 text-center`;
    }
  };

  return (
    <div className="h-screen w-screen bg-neutral-900 p-1 m-0 overflow-hidden flex flex-col gap-1 relative">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex-1 flex gap-1 justify-center">
          {row.map((source) => (
            <div
              key={source.id}
              className="bg-black border border-neutral-800 overflow-hidden"
              style={{ flex: `0 0 ${100 / layout.columns}%` }}
            >
              <iframe
                src={source.embedUrl}
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          ))}
        </div>
      ))}

      {overlay.text && (
        <div className={getOverlayPositionStyles()}>
          {overlay.scrolling ? (
            <div className="overflow-hidden whitespace-nowrap">
              <div className="inline-block animate-marquee">{overlay.text}</div>
            </div>
          ) : (
            <div>{overlay.text}</div>
          )}
        </div>
      )}
    </div>
  );
}
