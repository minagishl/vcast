import { useEffect, useState, useRef } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

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
  showIds: boolean;
  youtubeNoCookie: boolean;
};

type WsMessage =
  | { type: "state"; data: AppState }
  | { type: "added" | "removed" | "layout" }
  | { type: "textOverlay"; data: TextOverlay }
  | { type: "showIds"; data: boolean }
  | { type: "youtubeNoCookie"; data: boolean };

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

function StreamView({
  source,
  audioState,
  showId,
  ytReady,
  layoutColumns,
  youtubeNoCookie,
}: {
  source: Source;
  audioState: { volume: number; muted: boolean };
  showId: boolean;
  ytReady: boolean;
  layoutColumns: number;
  youtubeNoCookie: boolean;
}) {
  const playerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isYouTube = source.platform === "youtube";
  const isGeneric = source.platform === "generic";

  // YouTube Player setup
  useEffect(() => {
    if (!isYouTube || !ytReady || !containerRef.current) return;

    const videoId = source.embedUrl.match(/embed\/([^?]+)/)?.[1];
    if (!videoId) return;

    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId,
      host: youtubeNoCookie ? "https://www.youtube-nocookie.com" : "https://www.youtube.com",
      playerVars: {
        autoplay: 1,
        controls: 1,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: (event: any) => {
          event.target.setVolume(audioState.volume * 100);
          if (audioState.muted) {
            event.target.mute();
          } else {
            event.target.unMute();
          }
        },
      },
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [isYouTube, ytReady, source.embedUrl, youtubeNoCookie]);

  // Update YouTube audio state
  useEffect(() => {
    if (!isYouTube || !playerRef.current) return;

    try {
      if (audioState.muted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
      }
      playerRef.current.setVolume(audioState.volume * 100);
    } catch {
      // Player not ready yet
    }
  }, [isYouTube, audioState.muted, audioState.volume]);

  // Update generic video audio state
  useEffect(() => {
    if (!isGeneric || !videoRef.current) return;

    videoRef.current.muted = audioState.muted;
    videoRef.current.volume = audioState.volume;
  }, [isGeneric, audioState.muted, audioState.volume]);

  return (
    <div
      className="bg-black border border-neutral-800 overflow-hidden relative"
      style={{ flex: `0 0 ${100 / layoutColumns}%` }}
    >
      {isYouTube ? (
        <div ref={containerRef} className="w-full h-full" />
      ) : isGeneric && /\.(mp4|webm|ogg)$/i.test(source.embedUrl) ? (
        <video
          ref={videoRef}
          src={source.embedUrl}
          autoPlay
          loop
          muted={audioState.muted}
          className="w-full h-full object-cover"
        />
      ) : (
        <iframe
          src={source.embedUrl}
          allow="autoplay; encrypted-media"
          allowFullScreen
          className="w-full h-full border-0"
        />
      )}
      {showId && (
        <div className="absolute top-2 left-2 bg-black/80 text-white px-3 py-1 text-sm font-mono font-bold border border-neutral-600 z-20">
          {source.id}
        </div>
      )}
    </div>
  );
}

export default function ViewPage() {
  const [state, setState] = useState<AppState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [ytReady, setYtReady] = useState(false);

  useEffect(() => {
    fetchState();
    connectWs();

    // Load YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setYtReady(true);
      };
    } else {
      setYtReady(true);
    }

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
        if (payload.type === "showIds") {
          setState((prev) => (prev ? { ...prev, showIds: payload.data } : null));
        }
        if (payload.type === "youtubeNoCookie") {
          setState((prev) => (prev ? { ...prev, youtubeNoCookie: payload.data } : null));
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
          {row.map((source) => {
            const audioState = state.audio[source.id] || { volume: 1, muted: false };

            return (
              <StreamView
                key={source.id}
                source={source}
                audioState={audioState}
                showId={state.showIds}
                ytReady={ytReady}
                layoutColumns={layout.columns}
                youtubeNoCookie={state.youtubeNoCookie}
              />
            );
          })}
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
