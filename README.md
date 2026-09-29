# llmOS

On-device chat for iPhone. Replies are generated locally from a GGUF model through llama.cpp. Chats, settings, and model files stay in the app sandbox.

## Run

Install dependencies, then install the iOS pods and start Metro:

```sh
npm install
bundle install
bundle exec pod install
npm start
```

In another terminal:

```sh
npm run ios
```

## Models

Downloaded and imported weights live in the app documents directory at `models/`, with `models/manifest.json` recording what is installed. A download that stops early leaves a `.gguf.part` file and a small metadata file beside it. Open Models and tap Resume, or Discard to delete the partial file.

Large catalog models ask for confirmation and show how much space is free. The app refuses a download when the device does not have room for the file plus a little extra.

## Chat

The sidebar lists saved conversations. Search filters that list. Long-press a chat to rename or delete it. Each chat remembers the model that produced it and can keep its own instructions (General, Concise, Code, or custom). Those instructions replace the system prompt from Settings for that chat only.

Long-press a message to copy it. Long-press your own message to edit and resend from that point. Long-press a reply to regenerate it. Assistant replies render bold text, lists, links, and fenced code. Code blocks have a copy button.

While a reply is streaming, the bubble shows time to first token and tokens per second. Send and stop give a light haptic tap.

## Generation

Settings controls temperature, top-p, repeat penalty, context size (2048, 4096, or 8192), and response length. Response length cannot be more than half the context. History sent to the model is trimmed in estimated tokens so the reply still fits.

Top-p and repeat penalty are applied in the iOS Llama module. Rebuild the iOS app after pulling changes that touch `ios/LlamaModule.mm`.
