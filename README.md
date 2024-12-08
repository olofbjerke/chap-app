# Chap app

Video chapter editor for mp4 files. This is a small utility app that I made to scratch my own itch when I digitized old family videos. It is a GUI for the ffmpeg command line tool.

The app is written in [Preact](https://preactjs.com/) and [Tauri](https://tauri.app/) and is currently only meant to be run on MacOs.

## Building during development

```bash
npm run tauri dev
```

## Building for production

```bash
npm run tauri build
```

## TODO 

-   [ ] ffmpeg as sidecar
-   [ ] New icon
-   [x] Change title in metadata

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)


