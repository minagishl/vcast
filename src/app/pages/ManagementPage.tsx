import { useEffect, useState, useRef, FormEvent } from "react";

type Source = {
  id: string;
  platform: string;
  originalUrl: string;
  embedUrl: string;
};

type AudioState = {
  volume: number;
  muted: boolean;
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
  audio: Record<string, AudioState>;
  textOverlay: TextOverlay;
  showIds: boolean;
  youtubeNoCookie: boolean;
  hideCursor: boolean;
};

type WsMessage = { type: "state"; data: AppState } | { type: "reload" };

export default function ManagementPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [connected, setConnected] = useState(false);
  const [textInput, setTextInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const textTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchState();
    connectWs();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (textTimerRef.current) {
        clearTimeout(textTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state?.textOverlay.text !== undefined) {
      setTextInput(state.textOverlay.text);
    }
  }, [state?.textOverlay.text]);

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

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connectWs, 1500);
    };

    ws.onmessage = (event) => {
      try {
        const payload: WsMessage = JSON.parse(event.data);
        if (payload.type === "state") {
          setState(payload.data);
        }
        if (payload.type === "reload") {
          window.location.reload();
        }
      } catch (err) {
        console.error(err);
      }
    };
  }

  async function handleAddSource(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = formData.get("url") as string;
    if (!url) return;
    await fetch("/api/add", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    e.currentTarget.reset();
  }

  async function handleRemove(id: string) {
    await fetch("/api/remove", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  }

  async function handleToggleMute(id: string) {
    const muted = !(state?.audio?.[id]?.muted ?? false);
    await fetch("/api/audio", {
      method: "POST",
      body: JSON.stringify({ id, muted }),
    });
  }

  async function handleVolumeChange(id: string, volume: number) {
    await fetch("/api/audio", {
      method: "POST",
      body: JSON.stringify({ id, volume }),
    });
  }

  async function handleTextOverlayChange(overlay: Partial<TextOverlay>) {
    await fetch("/api/text-overlay", {
      method: "POST",
      body: JSON.stringify(overlay),
    });
  }

  function handleTextInputChange(text: string) {
    setTextInput(text);

    if (textTimerRef.current) {
      clearTimeout(textTimerRef.current);
    }

    textTimerRef.current = setTimeout(() => {
      handleTextOverlayChange({ text });
    }, 500);
  }

  async function handleShowIdsChange(showIds: boolean) {
    await fetch("/api/show-ids", {
      method: "POST",
      body: JSON.stringify({ showIds }),
    });
  }

  async function handleYoutubeNoCookieChange(youtubeNoCookie: boolean) {
    await fetch("/api/youtube-nocookie", {
      method: "POST",
      body: JSON.stringify({ youtubeNoCookie }),
    });
  }

  async function handleHideCursorChange(hideCursor: boolean) {
    await fetch("/api/hide-cursor", {
      method: "POST",
      body: JSON.stringify({ hideCursor }),
    });
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      <div className="max-w-7xl mx-auto p-6">
        <section className="bg-neutral-800 border border-neutral-700 p-6 mb-4">
          <h2 className="text-2xl font-bold text-neutral-100 m-0 mb-2">Text Overlay</h2>
          <p className="text-xs text-neutral-400 uppercase tracking-wide mb-4">
            Display text on the viewer screen
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-neutral-300 uppercase tracking-wide mb-2">
                Text Content
              </label>
              <input
                type="text"
                value={textInput}
                onChange={(e) => handleTextInputChange(e.target.value)}
                placeholder="Enter text to display..."
                className="w-full px-3 py-2 border border-neutral-600 bg-neutral-700 text-neutral-100"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-neutral-300 uppercase tracking-wide mb-2">
                  Position
                </label>
                <select
                  value={state?.textOverlay.position || "top"}
                  onChange={(e) =>
                    handleTextOverlayChange({
                      position: e.target.value as "top" | "bottom" | "left" | "right",
                    })
                  }
                  className="w-full px-4 py-2.5 border border-neutral-600 bg-neutral-700 text-neutral-100"
                >
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 px-4 py-3 bg-neutral-700 border border-neutral-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state?.textOverlay.scrolling || false}
                    onChange={(e) => handleTextOverlayChange({ scrolling: e.target.checked })}
                    className="size-4"
                  />
                  <span className="text-xs text-neutral-300 uppercase tracking-wide">
                    Enable Scrolling
                  </span>
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-neutral-800 border border-neutral-700 p-6 mb-4">
          <h2 className="text-2xl font-bold text-neutral-100 m-0 mb-2">Display Settings</h2>
          <p className="text-xs text-neutral-400 uppercase tracking-wide mb-4">
            Control viewer display options
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 px-4 py-3 bg-neutral-700 border border-neutral-600 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={state?.showIds ?? true}
                  onChange={(e) => handleShowIdsChange(e.target.checked)}
                  className="size-4"
                />
                <span className="text-xs text-neutral-300 uppercase tracking-wide">
                  Show Stream IDs
                </span>
              </label>
              <p className="text-xs text-neutral-400 mt-2 ml-1">
                Display stream IDs in the top-left corner of each video
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 px-4 py-3 bg-neutral-700 border border-neutral-600 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={state?.youtubeNoCookie ?? true}
                  onChange={(e) => handleYoutubeNoCookieChange(e.target.checked)}
                  className="size-4"
                />
                <span className="text-xs text-neutral-300 uppercase tracking-wide">
                  YouTube Privacy Mode (No Cookies)
                </span>
              </label>
              <p className="text-xs text-neutral-400 mt-2 ml-1">
                Use youtube-nocookie.com to prevent tracking cookies
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 px-4 py-3 bg-neutral-700 border border-neutral-600 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={state?.hideCursor ?? false}
                  onChange={(e) => handleHideCursorChange(e.target.checked)}
                  className="size-4"
                />
                <span className="text-xs text-neutral-300 uppercase tracking-wide">
                  Hide Cursor
                </span>
              </label>
              <p className="text-xs text-neutral-400 mt-2 ml-1">
                Hide mouse cursor on the viewer screen
              </p>
            </div>
          </div>
        </section>

        <section className="bg-neutral-800 border border-neutral-700 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-neutral-100 m-0">Streams</h2>
              <p className="text-xs text-neutral-400 uppercase tracking-wide mt-1">
                Add, remove, and control registered sources.
              </p>
            </div>
            <div
              className={`px-3 py-1 text-xs font-semibold border uppercase ${
                connected
                  ? "bg-green-900 text-green-50 border-green-700"
                  : "bg-neutral-700 text-neutral-300 border-neutral-600"
              }`}
            >
              {connected ? "live" : "offline"}
            </div>
          </div>

          <form onSubmit={handleAddSource} className="flex gap-2 mb-4">
            <input
              type="url"
              name="url"
              placeholder="https://..."
              required
              className="flex-1 px-3 py-2 border border-neutral-600 bg-neutral-700 text-neutral-100"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-neutral-800 text-neutral-50 border border-neutral-700 uppercase text-sm tracking-wide hover:bg-neutral-700 cursor-pointer"
            >
              Add Source
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-neutral-900">
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide border-b border-neutral-700 text-neutral-300">
                    ID
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide border-b border-neutral-700 text-neutral-300">
                    Platform
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide border-b border-neutral-700 text-neutral-300">
                    URL
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide border-b border-neutral-700 text-neutral-300">
                    Audio
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide border-b border-neutral-700 text-neutral-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {state?.sources.map((source) => {
                  const audio = state.audio[source.id] || {
                    volume: 1,
                    muted: false,
                  };
                  return (
                    <tr key={source.id} className="border-b border-neutral-700">
                      <td className="px-3 py-2 text-neutral-200">{source.id}</td>
                      <td className="px-3 py-2 text-neutral-200">{source.platform}</td>
                      <td className="px-3 py-2 max-w-xs overflow-hidden text-ellipsis text-neutral-200">
                        {source.originalUrl}
                      </td>
                      <td className="px-3 py-2 text-neutral-200">
                        <div className="flex gap-2 items-center">
                          <button
                            onClick={() => handleToggleMute(source.id)}
                            className="px-3 py-1 bg-neutral-800 text-neutral-50 border border-neutral-700 text-xs uppercase"
                          >
                            {audio.muted ? "Unmute" : "Mute"}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={audio.volume}
                            onChange={(e) => handleVolumeChange(source.id, Number(e.target.value))}
                            className="w-32"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-neutral-200">
                        <button
                          onClick={() => handleRemove(source.id)}
                          className="px-3 py-1 bg-neutral-700 text-neutral-200 border border-neutral-600 text-xs uppercase"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
