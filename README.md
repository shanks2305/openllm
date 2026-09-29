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

Most recommended models offer several quantizations (for example Q4_K_M, Q5_K_M, and Q8_0). Pick one on the model card before downloading. The default quant keeps the model's original id, and other quants install as separate models with the quant in their name.

When a model is added, the app reads its trained context length from the GGUF header and stores it in the manifest.

## Chat

The sidebar lists saved conversations. Search matches chat titles and message text, and shows a snippet for message matches. Long-press a chat to rename, share, or delete it. Each chat remembers the model that produced it and can keep its own instructions (General, Concise, Code, or custom). Those instructions replace the system prompt from Settings for that chat only.

After the first reply, the model writes a short title for the chat. A title you set yourself is never replaced. Clearing it goes back to the first message.

Long-press a message to copy or share it. Long-press your own message to edit and resend from that point. Long-press a reply to regenerate it. The share button in the header exports the whole chat as Markdown.

Assistant replies render headings, quotes, rules, bold, italics, lists, links, and fenced code. Code blocks scroll sideways, highlight keywords, strings, numbers, and comments, and have a copy button.

While a reply is streaming, the bubble shows time to first token and tokens per second. Finished replies keep those numbers along with the token count and whether the GPU or CPU produced them. Send and stop give a light haptic tap.

## Generation

On a physical iPhone, the model runs on the GPU through Metal and falls back to the CPU if Metal cannot load it. The simulator always uses the CPU because its Metal implementation returns bad output.

The KV cache is kept between turns. Each new prompt only processes the tokens after the prefix it shares with the previous one, so follow-up messages in a long chat start much faster.

Settings controls temperature, top-p, top-k, min-p, repeat penalty, seed, stop sequences, context size, and response length. Context sizes go up to 32768, but only up to what the selected model was trained on. Sizes above 8192 show a memory warning. Response length cannot be more than half the context.

History is trimmed natively with the model's own tokenizer and chat template. The oldest turns are dropped until the prompt fits, and the latest message is always kept. A single message that is too long for the context returns an error instead of being cut.

Stop sequences are entered one per line, with `\n` for a line break. Text is held back while it could still become a stop sequence, so the stop string never appears in the reply. A fixed seed makes replies repeatable for the same chat and settings. Leave it empty for random output.

All sampling runs in the iOS Llama module. Rebuild the iOS app after pulling changes that touch `ios/LlamaModule.mm`.
