# Note-y

Note-y is a local-first notes and lecture workspace. Documents are stored in the
browser's local storage and the UI contains no seeded personal or lecture data.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`, then serve the `dist` directory
with any static web server. This is suitable for self-hosting on a Linux
machine. The app can connect to an installed local model through an
OpenAI-compatible endpoint such as Ollama or LM Studio:

1. Open **Settings** in Note-y.
2. Set the endpoint (Ollama defaults to `http://localhost:11434/v1/chat/completions`).
3. Set the model name, for example `llama3.2`.

Summaries fall back to a local extractive response when the model is unavailable.
Audio recordings are saved in the browser/app's local IndexedDB store. To make
the microphone workflow transcribe on your own machine, start the included
Whisper service in a second terminal:

```bash
cd local-services/transcription
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8000
```

The first start downloads the selected Whisper model. Set `WHISPER_MODEL=base`
for a faster CPU model or `WHISPER_MODEL=medium` for better accuracy. In Note-y
Settings, use `http://localhost:8000/transcribe` as the transcription endpoint.
The service returns timestamped segments. Speaker diarization is intentionally
kept separate: use WhisperX or another diarization-capable service with the
same multipart endpoint when automatic speaker identity is required.

## Linux app

The repository now includes a Tauri Linux desktop wrapper. On Ubuntu/Debian,
install the native prerequisites once:

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev \
  build-essential curl wget file libxdo-dev libssl-dev librsvg2-dev
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

Then run the desktop app in development mode:

```bash
npm install
npm run desktop:dev
```

Build installable Linux packages:

```bash
npm run desktop:build
```

The AppImage and Debian package will be written to
`src-tauri/target/release/bundle/`. The desktop app uses the same local
IndexedDB/localStorage document store as the website, so notes and recordings
remain on the machine. Keep the Whisper service running when you want automatic
transcription.

The included architecture follows the useful local-first ideas from
[Speakr](https://github.com/murtaza-nasir/speakr): bring-your-own ASR/LLM
providers, timestamped transcript segments, and private self-hosted storage.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
