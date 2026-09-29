#import "LlamaModule.h"

#import <UIKit/UIKit.h>

#include <algorithm>
#include <atomic>
#include <cstring>
#include <string>
#include <vector>

#import <llama/ggml-backend.h>
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

@implementation LlamaModule {
  llama_model *model;
  llama_context *context;
  llama_sampler *sampler;

  dispatch_queue_t llamaQueue;
  std::atomic_bool stopRequested;
  BOOL hasListeners;
  ggml_backend_dev_t cpuDeviceList[2];
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

- (instancetype)init {
  self = [super init];

  if (self) {
    model = nullptr;
    context = nullptr;
    sampler = nullptr;
    stopRequested = false;
    hasListeners = NO;
    cpuDeviceList[0] = nullptr;
    cpuDeviceList[1] = nullptr;
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

    self->cpuDeviceList[0] = cpuDevice;
    self->cpuDeviceList[1] = nullptr;

    NSLog(@"[llama] using device %s", ggml_backend_dev_name(cpuDevice));

    llama_model_params params = llama_model_default_params();
    params.devices = self->cpuDeviceList;
    params.n_gpu_layers = 0;
    params.check_tensors = true;
    self->model = llama_model_load_from_file(path.UTF8String, params);

    if (self->model == nullptr) {
      reject(@"MODEL_LOAD_FAILED", @"Failed to load GGUF model", nil);
      return;
    }

    llama_context_params contextParams = llama_context_default_params();

    contextParams.n_ctx = contextSize != nil
                              ? (uint32_t)contextSize.unsignedIntValue
                              : llama_model_n_ctx_train(self->model);

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

    contextParams.flash_attn_type = LLAMA_FLASH_ATTN_TYPE_DISABLED;
    contextParams.offload_kqv = false;
    contextParams.op_offload = false;

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
    });
  });
}

RCT_EXPORT_METHOD(generate : (NSString *)prompt maxTokens : (NSNumber *)
                      maxTokens temperature : (NSNumber *)
                          temperature topP : (NSNumber *)
                              topP repeatPenalty : (NSNumber *)
                                  repeatPenalty resolver : (RCTPromiseResolveBlock)
                                      resolve rejecter : (RCTPromiseRejectBlock)
                                          reject) {
  dispatch_async(llamaQueue, ^{
    if (self->model == nullptr || self->context == nullptr) {
      reject(@"MODEL_NOT_LOADED", @"Model must be loaded before generation",
             nil);
      return;
    }

    self->stopRequested = false;
    [self freeSampler];

    llama_memory_t memory = llama_get_memory(self->context);
    llama_memory_seq_rm(memory, -1, -1, -1);
    llama_memory_clear(memory, true);

    const std::vector<LlamaChatTurn> turns = parse_chat_turns(prompt);

    if (turns.empty()) {
      reject(@"TOKENIZE_FAILED", @"Prompt is empty", nil);
      return;
    }

    const llama_vocab *vocab = llama_model_get_vocab(self->model);
    const int32_t maxNewTokens = maxTokens != nil ? maxTokens.intValue : 256;
    const float temp = temperature != nil ? temperature.floatValue : 0.8f;
    const float top = topP != nil ? std::min(1.f, std::max(0.f, topP.floatValue))
                                  : 0.9f;
    const float penalty =
        repeatPenalty != nil
            ? std::min(2.f, std::max(1.f, repeatPenalty.floatValue))
            : 1.1f;
    const std::string formattedPrompt =
        llama_formatted_chat_prompt(self->model, turns);
    const int32_t promptLength = (int32_t)formattedPrompt.size();
    const bool isFirst = llama_memory_seq_pos_max(memory, 0) == -1;

    int32_t tokenCount = llama_tokenize(vocab, formattedPrompt.c_str(),
                                        promptLength, nullptr, 0, isFirst,
                                        true);

    if (tokenCount == INT32_MIN) {
      reject(@"TOKENIZE_FAILED", @"Prompt is too long to tokenize", nil);
      return;
    }

    if (tokenCount < 0) {
      tokenCount = -tokenCount;
    }

    std::vector<llama_token> promptTokens((size_t)tokenCount);
    tokenCount = llama_tokenize(vocab, formattedPrompt.c_str(), promptLength,
                                promptTokens.data(), tokenCount, isFirst,
                                true);

    if (tokenCount < 0) {
      reject(@"TOKENIZE_FAILED", @"Failed to tokenize prompt", nil);
      return;
    }

    promptTokens.resize((size_t)tokenCount);

    if (tokenCount == 0) {
      reject(@"TOKENIZE_FAILED", @"Prompt produced no tokens", nil);
      return;
    }

    const int32_t nBatch = (int32_t)llama_n_ubatch(self->context);
    llama_batch batch = llama_batch_init(nBatch, 0, 1);
    int32_t nPast = 0;

    for (int32_t consumed = 0; consumed < tokenCount;) {
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
        reject(@"DECODE_FAILED", @"Failed to decode prompt", nil);
        return;
      }

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

    llama_sampler_chain_add(self->sampler, llama_sampler_init_min_p(0.05f, 1));

    if (top > 0.0f && top < 1.0f) {
      llama_sampler_chain_add(self->sampler, llama_sampler_init_top_p(top, 1));
    }

    if (temp <= 0.0f) {
      llama_sampler_chain_add(self->sampler, llama_sampler_init_greedy());
    } else {
      llama_sampler_chain_add(self->sampler, llama_sampler_init_temp(temp));
      llama_sampler_chain_add(self->sampler,
                              llama_sampler_init_dist(LLAMA_DEFAULT_SEED));
    }

    std::string utf8Carry;
    std::string generated;

    for (int32_t i = 0; i < maxNewTokens; ++i) {
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

      if (!utf8Carry.empty()) {
        NSString *text = [[NSString alloc] initWithBytes:utf8Carry.data()
                                                  length:utf8Carry.size()
                                                encoding:NSUTF8StringEncoding];
        if (text != nil) {
          generated.append(utf8Carry);
          utf8Carry.clear();
          [self emitToken:text];
        }
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
        reject(@"DECODE_FAILED", @"Failed during token generation", nil);
        return;
      }

      nPast += 1;
    }

    llama_batch_free(batch);
    [self freeSampler];

    NSString *resultText =
        [[NSString alloc] initWithBytes:generated.data()
                                 length:generated.size()
                               encoding:NSUTF8StringEncoding];
    resolve(resultText ?: @"");
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
