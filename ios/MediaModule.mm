#import <React/RCTEventEmitter.h>
#import <React/RCTUtils.h>

#import <AVFoundation/AVFoundation.h>
#import <PDFKit/PDFKit.h>
#import <PhotosUI/PhotosUI.h>
#import <Speech/Speech.h>
#import <UIKit/UIKit.h>

// Vision models read JPEG or PNG. Photos are often HEIC and much larger than
// the encoder needs, so they are re-encoded at a bounded size.
static NSDictionary *writeBoundedJpeg(UIImage *image, NSString *destination,
                                      CGFloat maxSide) {
  const CGFloat limit = MAX(64, maxSide);
  const CGSize size = image.size;

  if (size.width <= 0 || size.height <= 0) {
    return nil;
  }

  const CGFloat scale = MIN(1.0, limit / MAX(size.width, size.height));
  const CGSize target = CGSizeMake(MAX(1, floor(size.width * scale)),
                                   MAX(1, floor(size.height * scale)));

  UIGraphicsImageRendererFormat *format =
      [UIGraphicsImageRendererFormat defaultFormat];
  format.scale = 1;
  format.opaque = YES;
  UIGraphicsImageRenderer *renderer =
      [[UIGraphicsImageRenderer alloc] initWithSize:target format:format];
  NSData *data = [renderer
      JPEGDataWithCompressionQuality:0.85
                             actions:^(UIGraphicsImageRendererContext *ctx) {
                               [UIColor.whiteColor setFill];
                               [ctx fillRect:CGRectMake(0, 0, target.width,
                                                        target.height)];
                               [image drawInRect:CGRectMake(0, 0, target.width,
                                                            target.height)];
                             }];

  if (![data writeToFile:destination atomically:YES]) {
    return nil;
  }

  return @{
    @"path" : destination,
    @"width" : @(target.width),
    @"height" : @(target.height),
  };
}

@interface MediaModule
    : RCTEventEmitter <AVSpeechSynthesizerDelegate, PHPickerViewControllerDelegate>
@end

@implementation MediaModule {
  AVSpeechSynthesizer *synthesizer;
  AVSpeechUtterance *currentUtterance;
  AVAudioEngine *audioEngine;
  SFSpeechRecognizer *recognizer;
  SFSpeechAudioBufferRecognitionRequest *request;
  SFSpeechRecognitionTask *task;
  BOOL hasListeners;
  RCTPromiseResolveBlock photoResolve;
  NSString *photoDirectory;
  CGFloat photoMaxSide;
}

RCT_EXPORT_MODULE(Media);

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

- (NSArray<NSString *> *)supportedEvents {
  return @[ @"MediaTranscript", @"MediaListeningEnded", @"MediaSpeechDone" ];
}

- (void)startObserving {
  hasListeners = YES;
}

- (void)stopObserving {
  hasListeners = NO;
}

- (void)emit:(NSString *)name body:(id)body {
  if (hasListeners) {
    [self sendEventWithName:name body:body];
  }
}

#pragma mark - Documents

RCT_EXPORT_METHOD(extractPdfText : (NSString *)path resolver : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSURL *url = [path hasPrefix:@"file://"] ? [NSURL URLWithString:path]
                                             : [NSURL fileURLWithPath:path];
    PDFDocument *document = [[PDFDocument alloc] initWithURL:url];

    if (document == nil) {
      reject(@"PDF_OPEN_FAILED", @"Could not open this PDF", nil);
      return;
    }

    if (document.isLocked) {
      reject(@"PDF_LOCKED", @"This PDF is password protected", nil);
      return;
    }

    NSMutableString *text = [NSMutableString string];

    for (NSInteger index = 0; index < document.pageCount; index += 1) {
      @autoreleasepool {
        NSString *page = [document pageAtIndex:index].string;

        if (page.length > 0) {
          if (text.length > 0) {
            [text appendString:@"\n\n"];
          }

          [text appendString:page];
        }
      }
    }

    resolve(@{@"text" : text, @"pages" : @(document.pageCount)});
  });
}

RCT_EXPORT_METHOD(prepareImage : (NSString *)source destination : (
    NSString *)destination maxSide : (nonnull NSNumber *)maxSide resolver : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSString *path = [source hasPrefix:@"file://"]
                         ? [NSURL URLWithString:source].path
                         : source;
    UIImage *image = [UIImage imageWithContentsOfFile:path];

    if (image == nil) {
      reject(@"IMAGE_OPEN_FAILED", @"Could not read this image", nil);
      return;
    }

    NSDictionary *saved =
        writeBoundedJpeg(image, destination, maxSide.doubleValue);

    if (saved == nil) {
      reject(@"IMAGE_WRITE_FAILED", @"Could not save the image", nil);
      return;
    }

    resolve(saved);
  });
}

// PHPicker runs out of process, so it needs no photo library permission.
RCT_EXPORT_METHOD(pickPhotos : (nonnull NSNumber *)limit directory : (
    NSString *)directory maxSide : (nonnull NSNumber *)maxSide resolver : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  if (photoResolve != nil) {
    reject(@"PICKER_BUSY", @"The photo picker is already open", nil);
    return;
  }

  UIViewController *presenter = RCTPresentedViewController();

  if (presenter == nil) {
    reject(@"PICKER_FAILED", @"Could not open the photo picker", nil);
    return;
  }

  PHPickerConfiguration *config = [[PHPickerConfiguration alloc] init];
  config.filter = [PHPickerFilter imagesFilter];
  config.selectionLimit = MAX(1, limit.integerValue);
  config.preferredAssetRepresentationMode =
      PHPickerConfigurationAssetRepresentationModeCurrent;

  photoResolve = resolve;
  photoDirectory = directory;
  photoMaxSide = maxSide.doubleValue;

  PHPickerViewController *picker =
      [[PHPickerViewController alloc] initWithConfiguration:config];
  picker.delegate = self;
  [presenter presentViewController:picker animated:YES completion:nil];
}

- (void)picker:(PHPickerViewController *)picker
    didFinishPicking:(NSArray<PHPickerResult *> *)results {
  [picker dismissViewControllerAnimated:YES completion:nil];

  RCTPromiseResolveBlock resolve = photoResolve;
  NSString *directory = photoDirectory;
  const CGFloat maxSide = photoMaxSide;
  photoResolve = nil;
  photoDirectory = nil;

  if (resolve == nil) {
    return;
  }

  if (results.count == 0) {
    resolve(@[]);
    return;
  }

  [[NSFileManager defaultManager] createDirectoryAtPath:directory
                            withIntermediateDirectories:YES
                                             attributes:nil
                                                  error:nil];

  NSMutableArray *saved = [NSMutableArray arrayWithCapacity:results.count];

  for (NSUInteger i = 0; i < results.count; i += 1) {
    [saved addObject:[NSNull null]];
  }

  dispatch_group_t group = dispatch_group_create();

  [results enumerateObjectsUsingBlock:^(PHPickerResult *result, NSUInteger index,
                                        BOOL *stop) {
    NSItemProvider *provider = result.itemProvider;

    if (![provider canLoadObjectOfClass:[UIImage class]]) {
      return;
    }

    dispatch_group_enter(group);
    NSString *name = provider.suggestedName.length > 0 ? provider.suggestedName
                                                       : @"Photo";
    [provider loadObjectOfClass:[UIImage class]
              completionHandler:^(id<NSItemProviderReading> object,
                                  NSError *error) {
                if ([(NSObject *)object isKindOfClass:[UIImage class]]) {
                  NSString *fileId = [NSUUID UUID].UUIDString;
                  NSString *destination = [directory
                      stringByAppendingPathComponent:
                          [NSString stringWithFormat:@"%@.jpg", fileId]];
                  NSDictionary *file = writeBoundedJpeg(
                      (UIImage *)object, destination, maxSide);

                  if (file != nil) {
                    NSMutableDictionary *entry = [file mutableCopy];
                    entry[@"id"] = fileId;
                    entry[@"name"] = name;

                    @synchronized(saved) {
                      saved[index] = entry;
                    }
                  }
                }

                dispatch_group_leave(group);
              }];
  }];

  dispatch_group_notify(group, dispatch_get_main_queue(), ^{
    NSMutableArray *files = [NSMutableArray array];

    for (id entry in saved) {
      if (entry != [NSNull null]) {
        [files addObject:entry];
      }
    }

    resolve(files);
  });
}

#pragma mark - Text to speech

RCT_EXPORT_METHOD(speak : (NSString *)text rate : (nonnull NSNumber *)rate) {
  if (synthesizer == nil) {
    synthesizer = [[AVSpeechSynthesizer alloc] init];
    synthesizer.delegate = self;
  }

  [synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
  [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback
                                          mode:AVAudioSessionModeSpokenAudio
                                       options:AVAudioSessionCategoryOptionDuckOthers
                                         error:nil];
  [[AVAudioSession sharedInstance] setActive:YES error:nil];

  AVSpeechUtterance *utterance = [AVSpeechUtterance speechUtteranceWithString:text];
  utterance.rate = (float)MIN(
      AVSpeechUtteranceMaximumSpeechRate,
      MAX(AVSpeechUtteranceMinimumSpeechRate,
          AVSpeechUtteranceDefaultSpeechRate * rate.floatValue));
  utterance.voice = [AVSpeechSynthesisVoice
      voiceWithLanguage:[AVSpeechSynthesisVoice currentLanguageCode]];
  currentUtterance = utterance;
  [synthesizer speakUtterance:utterance];
}

RCT_EXPORT_METHOD(stopSpeaking) {
  [synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
}

// Replacing an utterance cancels the old one; only the current one reports
// back, so a stale cancel cannot end the new speech in JS.
- (void)finishUtterance:(AVSpeechUtterance *)utterance cancelled:(BOOL)cancelled {
  if (utterance != currentUtterance) {
    return;
  }

  currentUtterance = nil;
  [[AVAudioSession sharedInstance]
        setActive:NO
      withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
            error:nil];
  [self emit:@"MediaSpeechDone" body:@{@"cancelled" : @(cancelled)}];
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)synth
    didFinishSpeechUtterance:(AVSpeechUtterance *)utterance {
  [self finishUtterance:utterance cancelled:NO];
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)synth
    didCancelSpeechUtterance:(AVSpeechUtterance *)utterance {
  [self finishUtterance:utterance cancelled:YES];
}

#pragma mark - Speech to text

- (void)requestSpeechAccess:(void (^)(NSString *error))done {
  [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (status != SFSpeechRecognizerAuthorizationStatusAuthorized) {
        done(@"Allow Speech Recognition for llmOS in Settings to dictate.");
        return;
      }

      [[AVAudioSession sharedInstance] requestRecordPermission:^(BOOL granted) {
        dispatch_async(dispatch_get_main_queue(), ^{
          done(granted ? nil
                       : @"Allow microphone access for llmOS in Settings to dictate.");
        });
      }];
    });
  }];
}

- (void)finishListening {
  if (audioEngine.isRunning) {
    [audioEngine stop];
    [audioEngine.inputNode removeTapOnBus:0];
  }

  [request endAudio];
  request = nil;
  task = nil;
  [[AVAudioSession sharedInstance]
        setActive:NO
      withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
            error:nil];
}

RCT_EXPORT_METHOD(startListening : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject) {
  [self requestSpeechAccess:^(NSString *error) {
    if (error != nil) {
      reject(@"SPEECH_DENIED", error, nil);
      return;
    }

    [self->task cancel];
    [self finishListening];
    [self->synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];

    self->recognizer = [[SFSpeechRecognizer alloc] initWithLocale:NSLocale.currentLocale];

    if (self->recognizer == nil || !self->recognizer.isAvailable) {
      self->recognizer = [[SFSpeechRecognizer alloc]
          initWithLocale:[NSLocale localeWithLocaleIdentifier:@"en-US"]];
    }

    if (self->recognizer == nil || !self->recognizer.supportsOnDeviceRecognition) {
      reject(@"SPEECH_UNAVAILABLE",
             @"On-device dictation is not available for this language. Add "
             @"the language under Settings → General → Keyboard → Dictation.",
             nil);
      return;
    }

    NSError *sessionError = nil;
    AVAudioSession *session = [AVAudioSession sharedInstance];
    [session setCategory:AVAudioSessionCategoryRecord
                    mode:AVAudioSessionModeMeasurement
                 options:AVAudioSessionCategoryOptionDuckOthers
                   error:&sessionError];
    [session setActive:YES
           withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
                 error:&sessionError];

    if (sessionError != nil) {
      reject(@"AUDIO_SESSION_FAILED", sessionError.localizedDescription, nil);
      return;
    }

    self->request = [[SFSpeechAudioBufferRecognitionRequest alloc] init];
    self->request.shouldReportPartialResults = YES;
    self->request.requiresOnDeviceRecognition = YES;
    self->request.addsPunctuation = YES;

    if (self->audioEngine == nil) {
      self->audioEngine = [[AVAudioEngine alloc] init];
    }

    AVAudioInputNode *input = self->audioEngine.inputNode;
    AVAudioFormat *format = [input outputFormatForBus:0];
    SFSpeechAudioBufferRecognitionRequest *activeRequest = self->request;
    [input installTapOnBus:0
                bufferSize:1024
                    format:format
                     block:^(AVAudioPCMBuffer *buffer, AVAudioTime *when) {
                       [activeRequest appendAudioPCMBuffer:buffer];
                     }];

    __weak MediaModule *weakSelf = self;
    self->task = [self->recognizer
        recognitionTaskWithRequest:self->request
                     resultHandler:^(SFSpeechRecognitionResult *result, NSError *taskError) {
                       dispatch_async(dispatch_get_main_queue(), ^{
                         MediaModule *strongSelf = weakSelf;

                         if (strongSelf == nil) {
                           return;
                         }

                         if (result != nil) {
                           [strongSelf emit:@"MediaTranscript"
                                       body:@{
                                         @"text" : result.bestTranscription.formattedString,
                                         @"final" : @(result.isFinal),
                                       }];
                         }

                         if (taskError != nil || result.isFinal) {
                           [strongSelf finishListening];
                           [strongSelf emit:@"MediaListeningEnded"
                                       body:@{
                                         @"error" : taskError != nil && result == nil
                                             ? taskError.localizedDescription
                                             : [NSNull null],
                                       }];
                         }
                       });
                     }];

    [self->audioEngine prepare];

    if (![self->audioEngine startAndReturnError:&sessionError]) {
      [self finishListening];
      reject(@"AUDIO_ENGINE_FAILED", sessionError.localizedDescription, nil);
      return;
    }

    resolve(@YES);
  }];
}

RCT_EXPORT_METHOD(stopListening) {
  if (audioEngine.isRunning) {
    [audioEngine stop];
    [audioEngine.inputNode removeTapOnBus:0];
  }

  [request endAudio];
}

- (void)invalidate {
  [task cancel];
  [self finishListening];
  [synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
  [super invalidate];
}

@end
