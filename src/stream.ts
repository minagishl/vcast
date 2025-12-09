import { Buffer } from "buffer";

export type StreamParseResult = {
  id: string;
  platform: string;
  embedUrl: string;
  originalUrl: string;
};

export abstract class StreamProvider {
  abstract name: string;
  abstract match(url: string): boolean;
  abstract extractId(url: string): string | null;

  embedUrl(id: string): string {
    return id;
  }

  parse(url: string): StreamParseResult | null {
    if (!this.match(url)) return null;
    const id = this.extractId(url);
    if (!id) return null;
    return {
      id: `${this.name}:${id}`,
      platform: this.name,
      embedUrl: this.embedUrl(id),
      originalUrl: url,
    };
  }
}

class YouTubeProvider extends StreamProvider {
  name = "youtube";
  match(url: string): boolean {
    return /(youtube\.com|youtu\.be)/i.test(url);
  }
  extractId(url: string): string | null {
    try {
      const u = new URL(url);
      if (u.hostname === "youtu.be") {
        return u.pathname.replace(/^\//, "");
      }
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const pathParts = u.pathname.split("/").filter(Boolean);
      const watchIndex = pathParts.indexOf("v");
      if (watchIndex >= 0 && pathParts[watchIndex + 1]) return pathParts[watchIndex + 1];
      return null;
    } catch {
      return null;
    }
  }
  embedUrl(id: string): string {
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1`;
  }
}

class TwitchProvider extends StreamProvider {
  name = "twitch";
  match(url: string): boolean {
    return /twitch\.tv/i.test(url);
  }
  extractId(url: string): string | null {
    try {
      const u = new URL(url);
      const parts = u.pathname.split("/").filter(Boolean);
      return parts[0] || null;
    } catch {
      return null;
    }
  }
  embedUrl(id: string): string {
    return `https://player.twitch.tv/?channel=${id}&parent=localhost&parent=127.0.0.1`;
  }
}

class NicoProvider extends StreamProvider {
  name = "nicovideo";
  match(url: string): boolean {
    return /(nicovideo\.jp|nico\.ms)/i.test(url);
  }
  extractId(url: string): string | null {
    try {
      const u = new URL(url);
      const parts = u.pathname.split("/").filter(Boolean);
      return parts.pop() || null;
    } catch {
      return null;
    }
  }
  embedUrl(id: string): string {
    return `https://embed.nicovideo.jp/watch/${id}`;
  }
}

class VimeoProvider extends StreamProvider {
  name = "vimeo";
  match(url: string): boolean {
    return /vimeo\.com/i.test(url);
  }
  extractId(url: string): string | null {
    try {
      const u = new URL(url);
      const parts = u.pathname.split("/").filter(Boolean);
      return parts[0] || null;
    } catch {
      return null;
    }
  }
  embedUrl(id: string): string {
    return `https://player.vimeo.com/video/${id}`;
  }
}

class GenericProvider extends StreamProvider {
  name = "generic";
  match(url: string): boolean {
    return /^https?:\/\//i.test(url);
  }
  extractId(url: string): string | null {
    return Buffer.from(url)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "");
  }
  embedUrl(): string {
    return "";
  }
  parse(url: string): StreamParseResult | null {
    if (!this.match(url)) return null;
    const id = this.extractId(url);
    if (!id) return null;
    return {
      id: `${this.name}:${id}`,
      platform: this.name,
      embedUrl: url,
      originalUrl: url,
    };
  }
}

export const providers: StreamProvider[] = [
  new YouTubeProvider(),
  new TwitchProvider(),
  new NicoProvider(),
  new VimeoProvider(),
  new GenericProvider(),
];

export function parseStream(url: string): StreamParseResult {
  for (const provider of providers) {
    const result = provider.parse(url);
    if (result) return result;
  }
  throw new Error("Unsupported stream URL");
}
