import { promises as fs } from "fs";
import { watch, existsSync } from "fs";
import { dirname, join } from "path";
import os from "os";

export type StreamSource = {
  id: string;
  platform: string;
  embedUrl: string;
  originalUrl: string;
  addedAt: number;
};

export type Layout = {
  rows: number;
  columns: number;
};

export type TextOverlay = {
  text: string;
  position: "top" | "bottom" | "left" | "right";
  scrolling: boolean;
};

export type ConfigShape = {
  version: number;
  sources: StreamSource[];
  layout: Layout;
  audio: Record<string, { volume: number; muted: boolean }>;
  windows: Record<string, { x: number; y: number; width: number; height: number }>;
  textOverlay: TextOverlay;
  showIds: boolean;
  youtubeNoCookie: boolean;
  hideCursor: boolean;
};

const DEFAULT_CONFIG: ConfigShape = {
  version: 1,
  sources: [],
  layout: { rows: 2, columns: 2 },
  audio: {},
  windows: {},
  textOverlay: { text: "", position: "top", scrolling: false },
  showIds: true,
  youtubeNoCookie: true,
  hideCursor: false,
};

async function ensureDir(path: string) {
  await fs.mkdir(path, { recursive: true });
}

export class VcastState {
  readonly configPath: string;
  data: ConfigShape = { ...DEFAULT_CONFIG };
  private listeners: Set<(cfg: ConfigShape) => void> = new Set();
  private watcher?: ReturnType<typeof watch>;

  constructor(configPath?: string) {
    this.configPath = configPath || join(os.homedir(), ".vcast", "config.json");
  }

  async initSkeleton() {
    await ensureDir(dirname(this.configPath));
    if (!existsSync(this.configPath)) {
      this.data = { ...DEFAULT_CONFIG };
      await this.save();
    } else {
      await this.load();
    }
  }

  async load() {
    try {
      const raw = await fs.readFile(this.configPath, "utf8");
      const parsed = JSON.parse(raw);
      this.data = {
        ...DEFAULT_CONFIG,
        ...parsed,
        layout: parsed.layout || DEFAULT_CONFIG.layout,
        sources: parsed.sources || [],
        audio: parsed.audio || {},
        windows: parsed.windows || {},
        textOverlay: parsed.textOverlay || DEFAULT_CONFIG.textOverlay,
        showIds: parsed.showIds ?? DEFAULT_CONFIG.showIds,
        youtubeNoCookie: parsed.youtubeNoCookie ?? DEFAULT_CONFIG.youtubeNoCookie,
        hideCursor: parsed.hideCursor ?? DEFAULT_CONFIG.hideCursor,
      };
      this.emit();
    } catch (err) {
      console.error("Failed to load config, using defaults", err);
      this.data = { ...DEFAULT_CONFIG };
    }
  }

  async save() {
    await ensureDir(dirname(this.configPath));
    await fs.writeFile(this.configPath, JSON.stringify(this.data, null, 2), "utf8");
  }

  watchExternal() {
    if (this.watcher) return;
    try {
      this.watcher = watch(this.configPath, async () => {
        await this.load();
      });
    } catch (err) {
      console.error("Unable to watch config", err);
    }
  }

  snapshot(): ConfigShape {
    return JSON.parse(JSON.stringify(this.data));
  }

  onChange(fn: (cfg: ConfigShape) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private async update(mutator: () => void) {
    mutator();
    await this.save();
    this.emit();
  }

  private emit() {
    const snapshot = this.snapshot();
    for (const fn of this.listeners) fn(snapshot);
  }

  async addSource(source: Omit<StreamSource, "addedAt">) {
    const existingIdx = this.data.sources.findIndex((s) => s.id === source.id);
    const payload: StreamSource = { ...source, addedAt: Date.now() };
    await this.update(() => {
      if (existingIdx >= 0) {
        this.data.sources[existingIdx] = payload;
      } else {
        this.data.sources.push(payload);
      }
      if (!this.data.audio[source.id]) {
        this.data.audio[source.id] = { volume: 1, muted: false };
      }
    });
    return payload;
  }

  async removeSource(id: string) {
    await this.update(() => {
      this.data.sources = this.data.sources.filter((s) => s.id !== id);
      delete this.data.audio[id];
      delete this.data.windows[id];
    });
  }

  async updateLayout(layout: Partial<Layout>) {
    await this.update(() => {
      this.data.layout = {
        rows: layout.rows ?? this.data.layout.rows,
        columns: layout.columns ?? this.data.layout.columns,
      };
    });
  }

  async updateAudio(id: string, audio: Partial<{ volume: number; muted: boolean }>) {
    await this.update(() => {
      const existing = this.data.audio[id] || { volume: 1, muted: false };
      this.data.audio[id] = {
        volume: audio.volume ?? existing.volume,
        muted: audio.muted ?? existing.muted,
      };
    });
  }

  async updateWindow(
    id: string,
    window: Partial<{ x: number; y: number; width: number; height: number }>
  ) {
    await this.update(() => {
      const existing = this.data.windows[id] || { x: 0, y: 0, width: 1, height: 1 };
      this.data.windows[id] = {
        x: window.x ?? existing.x,
        y: window.y ?? existing.y,
        width: window.width ?? existing.width,
        height: window.height ?? existing.height,
      };
    });
  }

  async reorder(order: string[]) {
    await this.update(() => {
      this.data.sources = [...this.data.sources].sort((a, b) => {
        const ai = order.indexOf(a.id);
        const bi = order.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    });
  }

  async updateTextOverlay(overlay: Partial<TextOverlay>) {
    await this.update(() => {
      this.data.textOverlay = {
        text: overlay.text ?? this.data.textOverlay.text,
        position: overlay.position ?? this.data.textOverlay.position,
        scrolling: overlay.scrolling ?? this.data.textOverlay.scrolling,
      };
    });
  }

  async updateShowIds(showIds: boolean) {
    await this.update(() => {
      this.data.showIds = showIds;
    });
  }

  async updateYoutubeNoCookie(youtubeNoCookie: boolean) {
    await this.update(() => {
      this.data.youtubeNoCookie = youtubeNoCookie;
    });
  }

  async updateHideCursor(hideCursor: boolean) {
    await this.update(() => {
      this.data.hideCursor = hideCursor;
    });
  }
}
