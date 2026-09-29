#import "LlamaModule.h"

#import <UIKit/UIKit.h>

#include <algorithm>
#include <atomic>
#include <cstring>
#include <string>
#include <vector>

#import <llama/ggml-backend.h>
#import <llama/gguf.h>
#import <llama/llama.h>

struct LlamaChatTurn {
  std::string role;
  std::string content;
};

static void append_fallback_turn(std::string &out, const std::string &arch,
                                 const std::string &role,
                                 const std::string &content) {
  if (arch.find("gemma") != std::string::npos) {
    const std::string mapped = role == "assistant" ? "model" : "user";
    out += "<start_of_turn>" + mapped + "\n" + content + "<end_of_turn>\n";
    return;
  }

  if (arch.find("llama") != std::string::npos) {
    if (out.empty()) {
      out += "<|begin_of_text|>";
    }
    out += "<|start_header_id|>" + role + "<|end_header_id|>\n\n" + content +
           "<|eot_id|>";
    return;
  }

  if (arch.find("phi") != std::string::npos) {
    out += "<|" + role + "|>\n" + content + "<|end|>\n";
    return;
  }

  out += "<|im_start|>" + role + "\n" + content + "<|im_end|>\n";
}

static std::string render_chat_fallback(const std::string &arch,
                                        const std::vector<LlamaChatTurn> &turns) {
  std::string out;

  for (const LlamaChatTurn &turn : turns) {
    append_fallback_turn(out, arch, turn.role, turn.content);
  }

  if (arch.find("gemma") != std::string::npos) {
    out += "<start_of_turn>model\n";
  } else if (arch.find("llama") != std::string::npos) {
    out += "<|start_header_id|>assistant<|end_header_id|>\n\n";
  } else if (arch.find("phi") != std::string::npos) {
    out += "<|assistant|>\n";
  } else {
    out += "<|im_start|>assistant\n";
  }

  return out;
}

static std::vector<LlamaChatTurn> parse_chat_turns(NSString *prompt) {
  std::vector<LlamaChatTurn> turns;

  if (prompt.length > 0 && [prompt hasPrefix:@"["]) {
    NSData *data = [prompt dataUsingEncoding:NSUTF8StringEncoding];
    id json = data == nil ? nil
                          : [NSJSONSerialization JSONObjectWithData:data
                                                             options:0
                                                               error:nil];

    if ([json isKindOfClass:[NSArray class]]) {
      for (id item in (NSArray *)json) {
        if (![item isKindOfClass:[NSDictionary class]]) {
          continue;
        }

        id roleValue = ((NSDictionary *)item)[@"role"];
        id contentValue = ((NSDictionary *)item)[@"content"];

        if (![roleValue isKindOfClass:[NSString class]] ||
            ![contentValue isKindOfClass:[NSString class]]) {
          continue;
        }

        NSString *content = (NSString *)contentValue;

        if (content.length == 0) {
          continue;
        }

        std::string role = ((NSString *)roleValue).UTF8String;

        if (role != "system" && role != "user" && role != "assistant") {
          role = "user";
        }

        turns.push_back({role, std::string(content.UTF8String)});
      }
    }
  }

  if (turns.empty() && prompt.length > 0) {
    turns.push_back({"user", std::string(prompt.UTF8String)});
  }

  return turns;
}

static std::string llama_formatted_chat_prompt(
    const llama_model *model, const std::vector<LlamaChatTurn> &turns) {
  std::vector<llama_chat_message> chat;
  chat.reserve(turns.size());

  for (const LlamaChatTurn &turn : turns) {
    chat.push_back({turn.role.c_str(), turn.content.c_str()});
  }

  const char *tmpl = llama_model_chat_template(model, nullptr);
  std::string formattedPrompt;

  if (tmpl != nullptr && !chat.empty()) {
    const int32_t needed = llama_chat_apply_template(
        tmpl, chat.data(), chat.size(), true, nullptr, 0);

    if (needed > 0) {
      std::vector<char> formatted((size_t)needed);
      const int32_t written = llama_chat_apply_template(
          tmpl, chat.data(), chat.size(), true, formatted.data(), needed);

      if (written > 0) {
        formattedPrompt.assign(formatted.data(), (size_t)written);
      }
    }
  }

  const bool looksUnrendered =
      formattedPrompt.find("{{") != std::string::npos ||
      formattedPrompt.find("{%") != std::string::npos;

  if (!formattedPrompt.empty() && !looksUnrendered) {
    return formattedPrompt;
  }

  char architecture[128] = {};
  llama_model_meta_val_str(model, "general.architecture", architecture,
                           sizeof(architecture));

  return render_chat_fallback(architecture, turns);
}

static bool tokenize_text(const llama_vocab *vocab, const std::string &text,
                          std::vector<llama_token> &out) {
  const int32_t length = (int32_t)text.size();
  int32_t count =
      llama_tokenize(vocab, text.c_str(), length, nullptr, 0, true, true);

  if (count == INT32_MIN) {
    return false;
  }

  if (count < 0) {
    count = -count;
  }

  out.resize((size_t)count);
  count = llama_tokenize(vocab, text.c_str(), length, out.data(), count, true,
                         true);

  if (count < 0) {
    return false;
  }

  out.resize((size_t)count);
  return true;
}

static void drop_oldest_turn(std::vector<LlamaChatTurn> &turns) {
  auto first = std::find_if(turns.begin(), turns.end(),
                            [](const LlamaChatTurn &turn) {
                              return turn.role != "system";
                            });

  if (first == turns.end()) {
    return;
  }

  first = turns.erase(first);

  // Templates such as Gemma require the history to open with a user turn.
  if (first != turns.end() && first + 1 != turns.end() &&
      first->role == "assistant") {
    turns.erase(first);
  }
}

static size_t droppable_turns(const std::vector<LlamaChatTurn> &turns) {
  const size_t conversational =
      (size_t)std::count_if(turns.begin(), turns.end(),
                            [](const LlamaChatTurn &turn) {
                              return turn.role != "system";
                            });
  return conversational > 1 ? conversational - 1 : 0;
}

static float option_float(NSDictionary *options, NSString *key,
                          float fallback) {
  id value = options[key];
  return [value isKindOfClass:[NSNumber class]] ? [value floatValue] : fallback;
}

static int32_t option_int(NSDictionary *options, NSString *key,
                          int32_t fallback) {
  id value = options[key];
  return [value isKindOfClass:[NSNumber class]] ? [value intValue] : fallback;
}

static std::vector<std::string> option_stops(NSDictionary *options) {
  std::vector<std::string> stops;
  id value = options[@"stop"];

  if (![value isKindOfClass:[NSArray class]]) {
    return stops;
  }

  for (id item in (NSArray *)value) {
    if ([item isKindOfClass:[NSString class]] && [item length] > 0) {
      stops.emplace_back([(NSString *)item UTF8String]);
    }
  }

  return stops;
}

// Length of the longest suffix of `text` that could still grow into a stop
// sequence. That part is held back so a stop string never reaches the UI.
static size_t partial_stop_suffix(const std::string &text,
                                  const std::vector<std::string> &stops) {
  size_t hold = 0;

  for (const std::string &stop : stops) {
    const size_t longest = std::min(stop.size() - 1, text.size());

    for (size_t length = longest; length > hold; --length) {
      if (text.compare(text.size() - length, length, stop, 0, length) == 0) {
        hold = length;
        break;
      }
    }
  }

  return hold;
}

static uint32_t gguf_context_length(const char *path, std::string &arch) {
  gguf_init_params params = {true, nullptr};
  gguf_context *ctx = gguf_init_from_file(path, params);

  if (ctx == nullptr) {
    return 0;
  }

  uint32_t contextLength = 0;
  const int64_t archKey = gguf_find_key(ctx, "general.architecture");

  if (archKey >= 0 && gguf_get_kv_type(ctx, archKey) == GGUF_TYPE_STRING) {
    arch = gguf_get_val_str(ctx, archKey);
    const std::string key = arch + ".context_length";
    const int64_t id = gguf_find_key(ctx, key.c_str());

    if (id >= 0) {
      switch (gguf_get_kv_type(ctx, id)) {
      case GGUF_TYPE_UINT32:
        contextLength = gguf_get_val_u32(ctx, id);
        break;
      case GGUF_TYPE_INT32:
        contextLength = (uint32_t)std::max(0, gguf_get_val_i32(ctx, id));
        break;
      case GGUF_TYPE_UINT64:
        contextLength = (uint32_t)std::min<uint64_t>(gguf_get_val_u64(ctx, id),
                                                     UINT32_MAX);
        break;
      default:
        break;
      }
    }
  }

  gguf_free(ctx);
  return contextLength;
}

@implementation LlamaModule {
  llama_model *model;
  llama_context *context;
  llama_sampler *sampler;

  dispatch_queue_t llamaQueue;
  std::atomic_bool stopRequested;
  BOOL hasListeners;
  BOOL usingGpu;
  ggml_backend_dev_t deviceList[2];
  // Tokens currently held in the KV cache for sequence 0, in position order.
  std::vector<llama_token> cachedTokens;
}

RCT_EXPORT_MODULE(Llama);

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[ @"LlamaToken" ];
}

- (void)startObserving {
  hasListeners = YES;
}

- (void)stopObserving {
  hasListeners = NO;
}

- (void)emitToken:(NSString *)token {
  if (token.length == 0) {
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    if (!self->hasListeners) {
      return;
    }

    [self sendEventWithName:@"LlamaToken" body:@{@"token" : token}];
  });
}

- (BOOL)isValidUtf8:(const std::string &)bytes {
  NSString *text = [[NSString alloc] initWithBytes:bytes.data()
                                            length:bytes.size()
                                          encoding:NSUTF8StringEncoding];
  return text != nil;
}

- (void)emitBytes:(const std::string &)bytes {
  if (bytes.empty()) {
    return;
  }

  NSString *text = [[NSString alloc] initWithBytes:bytes.data()
                                            length:bytes.size()
                                          encoding:NSUTF8StringEncoding];

  if (text != nil) {
    [self emitToken:text];
  }
}

- (instancetype)init {
  self = [super init];

  if (self) {
    model = nullptr;
    context = nullptr;
    sampler = nullptr;
    stopRequested = false;
    hasListeners = NO;
    usingGpu = NO;
    deviceList[0] = nullptr;
    deviceList[1] = nullptr;
    llamaQueue =
        dispatch_queue_create("com.freegpt.llama", DISPATCH_QUEUE_SERIAL);
  }

  return self;
}

- (void)freeSampler {
  if (sampler != nullptr) {
    llama_sampler_free(sampler);
    sampler = nullptr;
  }
}

- (void)freeContextAndModel {
  [self freeSampler];
  cachedTokens.clear();

  if (context != nullptr) {
    llama_free(context);
    context = nullptr;
  }

  if (model != nullptr) {
    llama_model_free(model);
    model = nullptr;
  }
}

RCT_EXPORT_METHOD(
    loadModel : (NSString *)path contextSize : (NSNumber *)
        contextSize batchSize : (NSNumber *)batchSize microBatchSize : (
            NSNumber *)microBatchSize resolver : (RCTPromiseResolveBlock)
            resolve rejecter : (RCTPromiseRejectBlock)reject) {
  dispatch_async(llamaQueue, ^{
    llama_log_set(
        [](enum ggml_log_level level, const char *text, void *) {
          if (level >= GGML_LOG_LEVEL_WARN) {
            NSLog(@"[llama] %s", text);
          }
        },
        nullptr);

    llama_backend_init();
    ggml_backend_load_all();

    [self freeContextAndModel];

    ggml_backend_dev_t cpuDevice =
        ggml_backend_dev_by_type(GGML_BACKEND_DEVICE_TYPE_CPU);

    if (cpuDevice == nullptr) {
      reject(@"CPU_BACKEND_MISSING", @"CPU backend is unavailable", nil);
      return;
    }

    ggml_backend_dev_t gpuDevice = nullptr;
#if !TARGET_OS_SIMULATOR
    // The simulator's Metal implementation produces garbage logits, so the GPU
    // is only used on physical devices.
    gpuDevice = ggml_backend_dev_by_type(GGML_BACKEND_DEVICE_TYPE_GPU);
#endif

    llama_model_params params = llama_model_default_params();
    params.check_tensors = true;

    if (gpuDevice != nullptr) {
      self->deviceList[0] = gpuDevice;
      self->deviceList[1] = nullptr;
      params.devices = self->deviceList;
      params.n_gpu_layers = -1;
      self->model = llama_model_load_from_file(path.UTF8String, params);
    }

    self->usingGpu = self->model != nullptr;

    if (self->model == nullptr) {
      self->deviceList[0] = cpuDevice;
      self->deviceList[1] = nullptr;
      params.devices = self->deviceList;
      params.n_gpu_layers = 0;
      self->model = llama_model_load_from_file(path.UTF8String, params);
    }

    if (self->model == nullptr) {
      reject(@"MODEL_LOAD_FAILED", @"Failed to load GGUF model", nil);
      return;
    }

    NSLog(@"[llama] using device %s",
          ggml_backend_dev_name(self->deviceList[0]));

    llama_context_params contextParams = llama_context_default_params();
    const int32_t trainContext = llama_model_n_ctx_train(self->model);
    uint32_t requestedContext = contextSize != nil
                                    ? (uint32_t)contextSize.unsignedIntValue
                                    : (uint32_t)trainContext;

    if (trainContext > 0 && requestedContext > (uint32_t)trainContext) {
      requestedContext = (uint32_t)trainContext;
    }

    contextParams.n_ctx = requestedContext;

    if (batchSize != nil) {
      contextParams.n_batch = (uint32_t)batchSize.unsignedIntValue;
    }

    if (microBatchSize != nil) {
      contextParams.n_ubatch = (uint32_t)microBatchSize.unsignedIntValue;
    } else {
      contextParams.n_ubatch = contextParams.n_batch;
    }

    if (contextParams.n_ubatch > contextParams.n_batch) {
      contextParams.n_ubatch = contextParams.n_batch;
    }

    contextParams.flash_attn_type = self->usingGpu
                                        ? LLAMA_FLASH_ATTN_TYPE_AUTO
                                        : LLAMA_FLASH_ATTN_TYPE_DISABLED;
    contextParams.offload_kqv = self->usingGpu;
    contextParams.op_offload = self->usingGpu;

    self->context = llama_init_from_model(self->model, contextParams);

    if (self->context == nullptr) {
      llama_model_free(self->model);
      self->model = nullptr;
      reject(@"CONTEXT_INIT_FAILED", @"Failed to create llama context", nil);
      return;
    }

    const int32_t nThreads =
        std::max(1, (int32_t)NSProcessInfo.processInfo.processorCount - 2);
    llama_set_n_threads(self->context, nThreads, nThreads);

    resolve(@{
      @"contextSize" : @(llama_n_ctx(self->context)),
      @"batchSize" : @(llama_n_batch(self->context)),
      @"microBatchSize" : @(contextParams.n_ubatch),
      @"contextTrain" : @(trainContext),
      @"gpu" : @(self->usingGpu),
    });
  });
}

RCT_EXPORT_METHOD(readModelMetadata : (NSString *)path resolver : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    std::string arch;
    const uint32_t contextTrain = gguf_context_length(path.UTF8String, arch);

    if (contextTrain == 0 && arch.empty()) {
      reject(@"METADATA_FAILED", @"Could not read model metadata", nil);
      return;
    }

    resolve(@{
      @"architecture" : [NSString stringWithUTF8String:arch.c_str()] ?: @"",
      @"contextTrain" : @(contextTrain),
    });
  });
}

RCT_EXPORT_METHOD(generate : (NSString *)prompt options : (NSDictionary *)
                      options resolver : (RCTPromiseResolveBlock)
                          resolve rejecter : (RCTPromiseRejectBlock)reject) {
  dispatch_async(llamaQueue, ^{
    if (self->model == nullptr || self->context == nullptr) {
      reject(@"MODEL_NOT_LOADED", @"Model must be loaded before generation",
             nil);
      return;
    }

    self->stopRequested = false;
    [self freeSampler];

    std::vector<LlamaChatTurn> turns = parse_chat_turns(prompt);

    if (turns.empty()) {
      reject(@"TOKENIZE_FAILED", @"Prompt is empty", nil);
      return;
    }

    const llama_vocab *vocab = llama_model_get_vocab(self->model);
    const int32_t nCtx = (int32_t)llama_n_ctx(self->context);
    const int32_t maxNewTokens = std::max(
        1, std::min(option_int(options, @"maxTokens", 256), nCtx / 2));
    const float temp = option_float(options, @"temperature", 0.7f);
    const float top =
        std::min(1.f, std::max(0.f, option_float(options, @"topP", 0.9f)));
    const float minP =
        std::min(1.f, std::max(0.f, option_float(options, @"minP", 0.05f)));
    const int32_t topK = std::max(0, option_int(options, @"topK", 0));
    const float penalty = std::min(
        2.f, std::max(1.f, option_float(options, @"repeatPenalty", 1.1f)));
    const int32_t seed = option_int(options, @"seed", -1);
    const std::vector<std::string> stops = option_stops(options);
    const int32_t promptBudget = nCtx - maxNewTokens;

    std::vector<llama_token> promptTokens;
    size_t droppedTurns = 0;

    while (true) {
      const std::string formattedPrompt =
          llama_formatted_chat_prompt(self->model, turns);

      if (!tokenize_text(vocab, formattedPrompt, promptTokens)) {
        reject(@"TOKENIZE_FAILED", @"Failed to tokenize prompt", nil);
        return;
      }

      if ((int32_t)promptTokens.size() <= promptBudget ||
          droppable_turns(turns) == 0) {
        break;
      }

      const size_t before = turns.size();
      drop_oldest_turn(turns);
      droppedTurns += before - turns.size();
    }

    const int32_t tokenCount = (int32_t)promptTokens.size();

    if (tokenCount == 0) {
      reject(@"TOKENIZE_FAILED", @"Prompt produced no tokens", nil);
      return;
    }

    if (tokenCount > promptBudget) {
      reject(@"CONTEXT_OVERFLOW",
             @"This message is too long for the context size. Shorten it, "
             @"lower the response length, or raise the context size in "
             @"Settings.",
             nil);
      return;
    }

    // Reuse the KV cache for the prefix shared with the previous prompt. At
    // least one prompt token is always decoded so fresh logits are available.
    size_t reused = 0;
    const size_t cacheLimit =
        std::min(self->cachedTokens.size(), promptTokens.size() - 1);

    while (reused < cacheLimit &&
           self->cachedTokens[reused] == promptTokens[reused]) {
      reused += 1;
    }

    llama_memory_t memory = llama_get_memory(self->context);

    if (reused == 0 ||
        !llama_memory_seq_rm(memory, 0, (llama_pos)reused, -1)) {
      llama_memory_clear(memory, true);
      reused = 0;
    }

    self->cachedTokens.assign(promptTokens.begin(),
                              promptTokens.begin() + (long)reused);

    const int32_t nBatch = (int32_t)llama_n_ubatch(self->context);
    llama_batch batch = llama_batch_init(nBatch, 0, 1);
    int32_t nPast = (int32_t)reused;

    for (int32_t consumed = (int32_t)reused; consumed < tokenCount;) {
      const int32_t remaining = tokenCount - consumed;
      const int32_t nEval = remaining < nBatch ? remaining : nBatch;
      batch.n_tokens = nEval;

      for (int32_t i = 0; i < nEval; ++i) {
        const int32_t absIndex = consumed + i;
        batch.token[i] = promptTokens[(size_t)absIndex];
        batch.pos[i] = nPast + i;
        batch.n_seq_id[i] = 1;
        batch.seq_id[i][0] = 0;
        batch.logits[i] = absIndex == tokenCount - 1 ? 1 : 0;
      }

      const int32_t result = llama_decode(self->context, batch);

      if (result != 0) {
        llama_batch_free(batch);
        llama_memory_clear(memory, true);
        self->cachedTokens.clear();
        reject(@"DECODE_FAILED", @"Failed to decode prompt", nil);
        return;
      }

      self->cachedTokens.insert(self->cachedTokens.end(),
                                promptTokens.begin() + consumed,
                                promptTokens.begin() + consumed + nEval);
      consumed += nEval;
      nPast += nEval;
    }

    if (llama_get_logits_ith(self->context, -1) == nullptr) {
      llama_batch_free(batch);
      reject(@"DECODE_FAILED", @"No logits available after prompt decode", nil);
      return;
    }

    llama_sampler_chain_params samplerParams =
        llama_sampler_chain_default_params();
    self->sampler = llama_sampler_chain_init(samplerParams);

    if (penalty > 1.001f) {
      const int32_t nVocab = llama_vocab_n_tokens(vocab);
      llama_sampler_chain_add(
          self->sampler, llama_sampler_init_penalties(nVocab, 64, penalty, 0.0f,
                                                      0.0f));
    }

    if (topK > 0) {
      llama_sampler_chain_add(self->sampler, llama_sampler_init_top_k(topK));
    }

    if (top > 0.0f && top < 1.0f) {
      llama_sampler_chain_add(self->sampler, llama_sampler_init_top_p(top, 1));
    }

    if (minP > 0.0f) {
      llama_sampler_chain_add(self->sampler, llama_sampler_init_min_p(minP, 1));
    }

    if (temp <= 0.0f) {
      llama_sampler_chain_add(self->sampler, llama_sampler_init_greedy());
    } else {
      llama_sampler_chain_add(self->sampler, llama_sampler_init_temp(temp));
      llama_sampler_chain_add(
          self->sampler,
          llama_sampler_init_dist(seed < 0 ? LLAMA_DEFAULT_SEED
                                           : (uint32_t)seed));
    }

    std::string utf8Carry;
    std::string pending;
    std::string generated;
    int32_t generatedTokens = 0;
    bool hitStop = false;

    for (int32_t i = 0; i < maxNewTokens && nPast < nCtx; ++i) {
      if (self->stopRequested) {
        break;
      }

      llama_token token =
          llama_sampler_sample(self->sampler, self->context, -1);

      if (llama_vocab_is_eog(vocab, token)) {
        break;
      }

      char piece[256];
      int32_t pieceLength =
          llama_token_to_piece(vocab, token, piece, sizeof(piece), 0, true);

      if (pieceLength < 0) {
        const int32_t needed = -pieceLength;
        std::vector<char> buffer((size_t)needed);
        pieceLength =
            llama_token_to_piece(vocab, token, buffer.data(), needed, 0, true);
        if (pieceLength > 0) {
          utf8Carry.append(buffer.data(), (size_t)pieceLength);
        }
      } else if (pieceLength > 0) {
        utf8Carry.append(piece, (size_t)pieceLength);
      }

      generatedTokens += 1;

      if (!utf8Carry.empty() && [self isValidUtf8:utf8Carry]) {
        pending.append(utf8Carry);
        utf8Carry.clear();

        size_t stopAt = std::string::npos;

        for (const std::string &stop : stops) {
          stopAt = std::min(stopAt, pending.find(stop));
        }

        if (stopAt != std::string::npos) {
          pending.resize(stopAt);
          hitStop = true;
        }

        const size_t hold = hitStop ? 0 : partial_stop_suffix(pending, stops);
        const std::string ready = pending.substr(0, pending.size() - hold);
        pending.erase(0, ready.size());
        generated.append(ready);
        [self emitBytes:ready];
      }

      if (hitStop) {
        break;
      }

      batch.n_tokens = 1;
      batch.token[0] = token;
      batch.pos[0] = nPast;
      batch.n_seq_id[0] = 1;
      batch.seq_id[0][0] = 0;
      batch.logits[0] = 1;

      const int32_t result = llama_decode(self->context, batch);

      if (result != 0) {
        llama_batch_free(batch);
        [self freeSampler];
        llama_memory_clear(memory, true);
        self->cachedTokens.clear();
        reject(@"DECODE_FAILED", @"Failed during token generation", nil);
        return;
      }

      self->cachedTokens.push_back(token);
      nPast += 1;
    }

    generated.append(pending);
    [self emitBytes:pending];

    llama_batch_free(batch);
    [self freeSampler];

    NSString *resultText =
        [[NSString alloc] initWithBytes:generated.data()
                                 length:generated.size()
                               encoding:NSUTF8StringEncoding];
    resolve(@{
      @"text" : resultText ?: @"",
      @"promptTokens" : @(tokenCount),
      @"reusedTokens" : @(reused),
      @"generatedTokens" : @(generatedTokens),
      @"droppedTurns" : @(droppedTurns),
      @"gpu" : @(self->usingGpu),
    });
  });
}

RCT_EXPORT_METHOD(impact) {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIImpactFeedbackGenerator *generator = [[UIImpactFeedbackGenerator alloc]
        initWithStyle:UIImpactFeedbackStyleLight];
    [generator prepare];
    [generator impactOccurred];
  });
}

RCT_EXPORT_METHOD(appendFile : (NSString *)source onto : (NSString *)
                      dest resolver : (RCTPromiseResolveBlock)
                          resolve rejecter : (RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
    NSFileHandle *input = [NSFileHandle fileHandleForReadingAtPath:source];
    NSFileHandle *output = [NSFileHandle fileHandleForWritingAtPath:dest];

    if (input == nil || output == nil) {
      reject(@"APPEND_FAILED", @"Could not resume the download file", nil);
      return;
    }

    @try {
      [output seekToEndOfFile];

      while (true) {
        @autoreleasepool {
          NSData *chunk = [input readDataOfLength:1024 * 1024];

          if (chunk.length == 0) {
            break;
          }

          [output writeData:chunk];
        }
      }

      [output synchronizeFile];
      resolve(@YES);
    } @catch (NSException *exception) {
      reject(@"APPEND_FAILED",
             exception.reason ?: @"Could not append the download", nil);
    } @finally {
      [input closeFile];
      [output closeFile];
    }
  });
}

RCT_EXPORT_METHOD(stop : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject) {
  stopRequested = true;
  resolve(@YES);
}

RCT_EXPORT_METHOD(readFilePrefix : (NSString *)path length : (nonnull NSNumber *)
                      length resolver : (RCTPromiseResolveBlock)
                          resolve rejecter : (RCTPromiseRejectBlock)reject) {
  dispatch_async(
      dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        const NSInteger byteCount = MAX((NSInteger)0, [length integerValue]);
        NSFileHandle *file = [NSFileHandle fileHandleForReadingAtPath:path];

        if (file == nil) {
          reject(@"ENOENT",
                 [NSString stringWithFormat:@"Could not open file: %@", path],
                 nil);
          return;
        }

        NSData *data = [file readDataOfLength:(NSUInteger)byteCount];
        [file closeFile];

        NSString *text =
            [[NSString alloc] initWithData:data
                                  encoding:NSISOLatin1StringEncoding];
        resolve(text ?: @"");
      });
}

RCT_EXPORT_METHOD(getModelInfo : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject) {
  dispatch_async(llamaQueue, ^{
    if (self->model == nullptr) {
      reject(@"MODEL_NOT_LOADED", @"No model is currently loaded", nil);
      return;
    }

    char architecture[128] = {};
    const int32_t result =
        llama_model_meta_val_str(self->model, "general.architecture",
                                 architecture, sizeof(architecture));

    NSString *architectureString =
        result >= 0 ? [NSString stringWithUTF8String:architecture] : @"unknown";

    resolve(@{
      @"architecture" : architectureString,
      @"contextTrain" : @(llama_model_n_ctx_train(self->model)),
      @"embeddingLength" : @(llama_model_n_embd(self->model)),
      @"vocabularySize" :
          @(llama_vocab_n_tokens(llama_model_get_vocab(self->model))),
    });
  });
}

- (void)dealloc {
  [self freeContextAndModel];
  llama_backend_free();
}

@end
