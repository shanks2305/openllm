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

The catalog marks Qwen3 models as Reasoning, and SmolVLM2 and Qwen2.5-VL as Vision. A vision model needs a second GGUF, the mmproj projector, which downloads automatically after the weights and is stored as `models/<id>.mmproj.gguf`. If that second download fails, the model card shows Get vision to retry. For an imported model, Add vision lets you pick its matching mmproj file. Deleting a model deletes its projector too.

## Chat

The sidebar lists saved conversations. Search matches chat titles and message text, and shows a snippet for message matches. Long-press a chat to pin, archive, move it to a project, rename, share, or delete it. Pinned chats sit at the top, and archived chats are hidden until you open Archived at the bottom of the list. Each chat remembers the model that produced it and can keep its own instructions (General, Concise, Code, or custom).

Projects group chats. Tap + next to Projects to make one, and long-press a project to start a chat in it, rename it, set its instructions, or delete it. Deleting a project keeps its chats. Instructions apply in this order: the chat's own, then the project's, then the system prompt from Settings.

Memory holds facts the model should know in every chat. Add them in Memory (sidebar or Settings), long-press your own message and choose Remember, or turn on Tools and ask the model to remember something. Memory can be switched off without deleting it.

After the first reply, the model writes a short title for the chat. A title you set yourself is never replaced. Clearing it goes back to the first message.

Long-press a message to copy or share it. Editing your own message or regenerating a reply keeps the old version. Use the ‹ 1/2 › arrows under the message to switch between versions. The share button in the header exports the whole chat as Markdown.

Assistant replies render headings, quotes, rules, bold, italics, strikethrough, nested and task lists, links, tables, and fenced code. LaTeX in `$…$`, `\(…\)`, `$$…$$`, and `\[…\]` is shown as Unicode math, for example `\frac{a}{b}` as a/b and `x^2` as x². Code blocks scroll sideways, highlight keywords, strings, numbers, and comments, and have a copy button.

HTML, SVG, and code blocks of three lines or more also get Preview or Open, which shows them in a full-screen panel. The panel pages through every artifact in the chat. HTML and SVG run in an offline sandbox: a Content Security Policy and a navigation filter stop the page from loading anything over the network.

### Attachments and voice

The + button in the composer attaches up to four photos or files. Files can be PDFs, text, source code, or images. The PDF text layer is extracted on device, so scanned PDFs without selectable text are rejected. Document text goes into the prompt inside `<document>` tags. When several documents don't fit the context, the newest keep the most text and older ones are shortened or left out with a note. Photos are re-encoded to JPEG at 1024 px or less and saved in `attachments/`. Only a vision model reads them; other models are told an image was attached.

The mic button dictates with on-device speech recognition, and the speaker button on a reply reads it aloud. Code blocks and Markdown symbols are skipped when reading.

### Tools and reasoning

The Tools chip lets the model call a calculator, the current date and time, unit conversion, chat search, and memory. Calls use the `<tool_call>` format that Qwen models are trained on, run locally, and show as chips above the reply. A reply can make up to three calls.

For reasoning models, the model's thinking appears in a collapsed "Thought for N words" block above the answer, and it is left out of later prompts. On Qwen3 the Think chip turns thinking on or off; off sends `/no_think`. While thinking is on, the response length is raised to at least 1536 tokens so the answer isn't cut off.

While a reply is streaming, the bubble shows time to first token and tokens per second. Finished replies keep those numbers along with the token count and whether the GPU or CPU produced them. Send and stop give a light haptic tap.

## Generation

On a physical iPhone, the model runs on the GPU through Metal and falls back to the CPU if Metal cannot load it. The simulator always uses the CPU because its Metal implementation returns bad output.

The KV cache is kept between turns. Each new prompt only processes the tokens after the prefix it shares with the previous one, so follow-up messages in a long chat start much faster.

Settings controls temperature, top-p, top-k, min-p, repeat penalty, seed, stop sequences, context size, and response length. Context sizes go up to 32768, but only up to what the selected model was trained on. Sizes above 8192 show a memory warning. Response length cannot be more than half the context.

History is trimmed natively with the model's own tokenizer and chat template. The oldest turns are dropped until the prompt fits, and the latest message is always kept. A single message that is too long for the context returns an error instead of being cut.

Stop sequences are entered one per line, with `\n` for a line break. Text is held back while it could still become a stop sequence, so the stop string never appears in the reply. A fixed seed makes replies repeatable for the same chat and settings. Leave it empty for random output.

A prompt with images is tokenized with mtmd and fully evaluated, so it doesn't reuse the KV cache. Every message in a chat that contains a photo re-encodes that photo.

All sampling runs in the iOS Llama module. PDF text, image preparation, the photo picker, speech, and dictation live in `ios/MediaModule.mm`. Rebuild the iOS app, after `bundle exec pod install`, when you pull changes that touch either file or add a native dependency.
