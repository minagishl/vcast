# vcast

Local-first multi-stream casting toolkit powered by Bun. Includes a CLI, lightweight HTTP/WebSocket server, management dashboard, viewer grid UI, and an embedded MCP endpoint for automation.

## Features

- Bun-native CLI (`vcast`) with `init`, `start`, `add`, and `remove`
- Local HTTP + WebSocket server (no cloud dependencies)
- Management UI to add/remove streams, edit layout, and control audio
- Viewer UI with live grid (drag to reorder, resize panels, per-stream audio controls)
- Modular stream detection (YouTube, Twitch, Nicovideo, Vimeo, IPTV/HLS (.m3u8), generic)
- Embedded MCP JSON-RPC endpoint for automation

## Install

```sh
bun install
```

## Build

Produces the publishable CLI at `dist/index.js` with an executable shebang.

```sh
bun run build
```

## Run

Initialize the config, then start the server:

```sh
vcast init
vcast start            # starts server on 127.0.0.1:3579
# optional
vcast start --port 4000
```

Add or remove sources:

```sh
vcast add https://www.youtube.com/watch?v=dQw4w9WgXcQ
vcast remove youtube:dQw4w9WgXcQ
```

Management UI: `http://127.0.0.1:3579/`

Viewer UI: `http://127.0.0.1:3579/view.html`

## MCP endpoint

JSON-RPC style POST to `/mcp` (local only). Example:

```sh
curl -X POST http://127.0.0.1:3579/mcp \
  -H "Content-Type: application/json" \
  -d '{"id":1,"method":"addSource","params":{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}}'
```

Supported methods: `listSources`, `addSource(url)`, `removeSource(id)`, `updateLayout({rows,columns})`, `updateAudio({id, volume, muted})`, `updateWindow({id, x, y, width, height})`.

## Config

The config is stored at `~/.vcast/config.json` and is watched for external changes. Layout, audio state, window spans, and source order are persisted here.

## Development notes

- Runtime: Bun (>=1.0)
- Language: TypeScript
- Package name/binary: `vcast`
- No external network is required for the server/UI itself; streaming URLs load directly from their platforms.
- Frontend: React + Vite + Tailwind CSS (source in `src/app/`, built to `dist/public/`)
- Backend: Bun TypeScript server (source in `src/`, compiled to `dist/`)

### Development workflow

```sh
# Build backend + frontend
bun run build

# Run frontend dev server (with hot reload)
bun run dev:frontend

# Run production build
bun run start
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
