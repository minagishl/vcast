# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v0.1.2] - 2025-12-09

### Added

- YouTube privacy mode toggle that switches embeds to `youtube-nocookie.com` with a dedicated player host
- Viewer cursor hide toggle controlled from the management UI and persisted in state
- Up/down controls in the management table to reorder streams without drag and drop

### Fixed

- Per-stream audio controls now properly sync mute/volume for YouTube and generic sources via the IFrame API
- `vcast start --open` reloads existing management/viewer tabs instead of spawning duplicates

## [v0.1.1] - 2025-12-09

### Added

- Text overlay feature with customizable position (top/bottom/left/right)
- Scrolling marquee animation for text overlay
- Stream ID display toggle in viewer UI
- Display settings section in management UI

### Fixed

- Japanese IME input handling with debounced text updates
- Text overlay animation now properly loops with complete exit before re-entry

## [v0.1.0] - 2025-12-08

### Added

- Initial release of vcast - local multi-stream casting toolkit
- CLI commands: `init`, `start`, `add`, `remove`
- Local HTTP + WebSocket server
- Management UI for stream control
- Viewer UI with live grid layout
- MCP (Model Context Protocol) JSON-RPC endpoint
- Stream detection support for YouTube, Twitch, Nicovideo, Vimeo
- Per-stream audio controls (volume, mute)
- Drag-to-reorder and resize functionality
- Config persistence at `~/.vcast/config.json`
- GitHub Actions CI workflow
- Issue and pull request templates
- Code quality tools: ESLint, Prettier, TypeScript, Husky
- EditorConfig for consistent code formatting

### Changed

- Migrated frontend to React + Vite + Tailwind CSS architecture
- Moved static files from `/public` to build output at `dist/public`
- Updated README.md to reflect new development workflow

### Removed

- Removed legacy `/public` directory (replaced by Vite build output)

[Unreleased]: https://github.com/minagishl/vcast/compare/v0.1.2...HEAD
[v0.1.2]: https://github.com/minagishl/vcast/compare/v0.1.1...v0.1.2
[v0.1.1]: https://github.com/minagishl/vcast/compare/v0.1.0...v0.1.1
[v0.1.0]: https://github.com/minagishl/vcast/releases/tag/v0.1.0
