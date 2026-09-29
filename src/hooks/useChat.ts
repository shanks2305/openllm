import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { conversationStore } from '../chat/conversationStore';
import type { ConversationState } from '../chat/conversationStore';
import { createId } from '../chat/ids';
import {
  buildSystemPrompt,
  cleanGeneratedTitle,
  coarseHistoryBudget,
  messagesToTurns,
  TITLE_REQUEST,
} from '../chat/prompt';
import { documentBudgetChars } from '../chat/documents';
import {
  findToolCall,
  NO_THINK,
  THINKING_MIN_TOKENS,
  visibleToolText,
  withThinkingSwitch,
} from '../chat/generation';
import { stripReasoning } from '../chat/reasoning';
import { matchChat } from '../chat/search';
import {
  MAX_TOOL_ROUNDS,
  runTool,
  TOOL_CALL_CLOSE,
  toolResponseTurn,
  toolsPrompt,
} from '../chat/tools';
import type { ToolContext } from '../chat/tools';
import { memoryStore } from '../memory/memoryStore';
import type {
  Attachment,
  ChatMessage,
  MessageStats,
  ToolCall,
} from '../chat/types';
import type { ChatTurn } from '../engine/LlamaEngine';
import { NativeLlamaEngine } from '../engine/NativeLlamaEngine';
import { hasVision, reasoningStyle } from '../model/capabilities';
import type { ReasoningStyle } from '../model/capabilities';
import { modelManager } from '../model/ModelManager';
import {
  effectiveContextSize,
  settingsStore,
} from '../settings/settingsStore';

export type Message = ChatMessage;

function createToolContext(chatId: string): ToolContext {
  return {
    now: () => new Date(),
    searchChats: query =>
      conversationStore
        .getState()
        .conversations.filter(chat => chat.id !== chatId)
        .flatMap(chat => {
          const match = matchChat(chat, query);
          return match
            ? [
                {
                  title: chat.title,
                  snippet:
                    match.snippet ??
                    (chat.messages[0]?.content ?? '').slice(0, 120),
                },
              ]
            : [];
        })
        .slice(0, 5),
    remember: fact => memoryStore.add(fact),
  };
}

function defaultPrompt(attachments: Attachment[]) {
  const images = attachments.filter(item => item.kind === 'image').length;
  const documents = attachments.length - images;

  if (images > 0 && documents === 0) {
    return images === 1 ? "What's in this image?" : "What's in these images?";
  }

  return documents === 1 && images === 0
    ? 'Summarize this document.'
    : 'Summarize these attachments.';
}
export type GenerationPhase = 'idle' | 'loading' | 'generating';

export type GenerationStats = {
  tokensPerSecond: number | null;
  timeToFirstTokenMs: number | null;
};

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useChat() {
  const [state, setState] = useState<ConversationState>(() =>
    conversationStore.getState(),
  );
  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const engine = useMemo(() => new NativeLlamaEngine(), []);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const titleRef = useRef<Promise<void> | null>(null);

  const generateTitle = useCallback(
    async (
      chatId: string,
      turns: ChatTurn[],
      contextSize: number,
      reasoning: ReasoningStyle,
    ) => {
      try {
        const request =
          reasoning === 'toggle' ? `${TITLE_REQUEST} ${NO_THINK}` : TITLE_REQUEST;
        const result = await engine.generate(
          [...turns, { role: 'user', content: request }],
          () => undefined,
          {
            maxTokens: reasoning === 'always' ? 400 : 24,
            temperature: 0.2,
            topP: 0.9,
            repeatPenalty: 1.1,
            contextSize,
          },
        );
        const title = result
          ? cleanGeneratedTitle(stripReasoning(result.text))
          : null;

        if (title) {
          conversationStore.setGeneratedTitle(chatId, title);
        }
      } catch {
        // Keep the title taken from the first message.
      }
    },
    [engine],
  );

  useEffect(() => {
    const unsubscribe = conversationStore.subscribe(() => {
      setState(conversationStore.getState());
    });

    conversationStore.hydrate().catch(() => {
      // The store falls back to an empty chat list.
    });
    settingsStore.hydrate().catch(() => {
      // Generation uses the in-memory defaults.
    });

    return unsubscribe;
  }, []);

  const active =
    state.conversations.find(chat => chat.id === state.activeId) ?? null;

  const stopGeneration = useCallback(async () => {
    generationRef.current += 1;
    busyRef.current = false;
    setGenerating(false);
    setPhase('idle');
    setStats(null);

    const current = conversationStore.getActive();
    const last = current?.messages[current.messages.length - 1];

    if (current && last?.role === 'assistant' && last.content.length === 0) {
      conversationStore.setMessages(current.id, current.messages.slice(0, -1));
      conversationStore.discardEmptyBranch(current.id);
    }

    await engine.stopGeneration();
    await conversationStore.flush();
  }, [engine]);

  const runGeneration = useCallback(
    async (chatId: string, history: ChatMessage[]) => {
      const gen = ++generationRef.current;
      busyRef.current = true;
      setGenerating(true);
      await titleRef.current;

      if (generationRef.current !== gen) {
        return;
      }

      setPhase('loading');
      setStats(null);

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: 'assistant',
        content: '',
      };
      let displayed = [...history, assistantMessage];
      conversationStore.setMessages(chatId, displayed);

      const startedAt = Date.now();
      let generatedAt = startedAt;
      let firstTokenAt: number | null = null;
      let tokens = 0;

      try {
        await settingsStore.hydrate();
        await modelManager.hydrate();

        if (generationRef.current !== gen) {
          return;
        }

        await memoryStore.hydrate();
        const settings = settingsStore.getState();
        const memory = memoryStore.getState();
        const chat =
          conversationStore
            .getState()
            .conversations.find(item => item.id === chatId) ?? null;
        const systemPrompt = buildSystemPrompt({
          chat: chat?.systemPrompt,
          project: conversationStore.getProject(chat?.projectId)?.instructions,
          global: settings.systemPrompt,
          memory: memory.enabled ? memory.items.map(item => item.text) : [],
        });
        const selected = modelManager.getState().selectedModel;

        if (selected) {
          conversationStore.setModel(chatId, selected.id);
        }

        const contextSize = effectiveContextSize(
          settings.contextSize,
          selected?.contextTrain,
        );
        const reasoning = reasoningStyle(selected);
        const thinks =
          reasoning === 'always' || (reasoning === 'toggle' && settings.thinking);
        // Thinking eats into the reply budget, so reasoning models get more.
        const maxTokens = Math.min(
          thinks ? Math.max(settings.maxTokens, THINKING_MIN_TOKENS) : settings.maxTokens,
          contextSize / 2,
        );
        const useTools = settings.tools;
        const fullPrompt = useTools
          ? buildSystemPrompt({
              chat: chat?.systemPrompt,
              project: conversationStore.getProject(chat?.projectId)?.instructions,
              global: settings.systemPrompt,
              memory: memory.enabled ? memory.items.map(item => item.text) : [],
              tools: toolsPrompt(),
            })
          : systemPrompt;
        await engine.loadModel({ contextSize });

        if (generationRef.current !== gen) {
          return;
        }

        setPhase('generating');
        generatedAt = Date.now();
        const baseTurns = withThinkingSwitch(
          messagesToTurns(
            history,
            fullPrompt,
            coarseHistoryBudget(contextSize, maxTokens),
            {
              documentChars: documentBudgetChars(contextSize, maxTokens),
              vision: hasVision(selected),
            },
          ),
          reasoning,
          settings.thinking,
        );
        let turns = baseTurns;
        const toolContext = createToolContext(chatId);
        const toolCalls: ToolCall[] = [];
        let earlier = '';
        let generatedTokens = 0;
        let usedGpu = false;
        const show = (content: string) => {
          displayed = displayed.map(message =>
            message.id === assistantMessage.id
              ? {
                  ...message,
                  content,
                  ...(toolCalls.length ? { toolCalls: [...toolCalls] } : {}),
                }
              : message,
          );
          conversationStore.setMessages(chatId, displayed);
        };

        for (let round = 0; ; round += 1) {
          let current = '';
          const result = await engine.generate(
            turns,
            token => {
              if (generationRef.current !== gen) {
                return;
              }

              tokens += 1;
              current += token;

              if (firstTokenAt == null) {
                firstTokenAt = Date.now();
              }

              const elapsed = (Date.now() - generatedAt) / 1000;
              setStats({
                tokensPerSecond: elapsed >= 0.4 ? tokens / elapsed : null,
                timeToFirstTokenMs: firstTokenAt - startedAt,
              });
              show(earlier + (useTools ? visibleToolText(current) : current));
            },
            {
              maxTokens,
              temperature: settings.temperature,
              topP: settings.topP,
              topK: settings.topK,
              minP: settings.minP,
              repeatPenalty: settings.repeatPenalty,
              seed: settings.seed,
              stop: useTools
                ? [...settings.stopSequences, TOOL_CALL_CLOSE]
                : settings.stopSequences,
              contextSize,
            },
          );

          if (generationRef.current !== gen || !result) {
            return;
          }

          generatedTokens += result.generatedTokens;
          usedGpu = result.gpu;
          const call =
            useTools && round < MAX_TOOL_ROUNDS ? findToolCall(current) : null;

          if (!call) {
            show(earlier + current);
            break;
          }

          const executed = runTool(call, toolContext);
          toolCalls.push(executed);
          earlier += call.before;
          show(earlier);
          turns = [
            ...turns,
            {
              role: 'assistant',
              content: `${stripReasoning(call.before)}${call.raw}`.trim(),
            },
            { role: 'user', content: toolResponseTurn(executed) },
          ];
        }

        const finishedAt = Date.now();
        const decodeSeconds =
          firstTokenAt != null ? (finishedAt - firstTokenAt) / 1000 : 0;
        const messageStats: MessageStats = {
          tokens: generatedTokens,
          gpu: usedGpu,
          timeToFirstTokenMs:
            firstTokenAt != null ? firstTokenAt - startedAt : null,
          tokensPerSecond:
            generatedTokens > 1 && decodeSeconds > 0
              ? (generatedTokens - 1) / decodeSeconds
              : null,
        };
        const reply = stripReasoning(
          displayed.find(item => item.id === assistantMessage.id)?.content ??
            '',
        );
        displayed = displayed.map(item =>
          item.id === assistantMessage.id
            ? { ...item, stats: messageStats }
            : item,
        );
        conversationStore.setMessages(chatId, displayed);

        const chatNow = conversationStore
          .getState()
          .conversations.find(item => item.id === chatId);
        const firstReply =
          displayed.filter(item => item.role === 'assistant').length === 1;

        if (
          chatNow &&
          firstReply &&
          reply.trim() &&
          !chatNow.titleCustom &&
          !chatNow.titleGenerated
        ) {
          titleRef.current = generateTitle(
            chatId,
            [
              ...baseTurns.map(({ images: _images, ...turn }) => turn),
              { role: 'assistant', content: reply },
            ],
            contextSize,
            reasoning,
          ).finally(() => {
            titleRef.current = null;
          });
        }
      } catch (error) {
        if (generationRef.current !== gen) {
          return;
        }

        displayed = displayed.map(item =>
          item.id === assistantMessage.id
            ? {
                ...item,
                content: item.content || errorText(error, 'Generation failed'),
              }
            : item,
        );
        conversationStore.setMessages(chatId, displayed);
      } finally {
        if (generationRef.current === gen) {
          busyRef.current = false;
          setGenerating(false);
          setPhase('idle');
        }

        await conversationStore.flush();
      }
    },
    [engine, generateTitle],
  );

  const sendMessage = useCallback(
    async (prompt: string, attachments: Attachment[] = []) => {
      const trimmed = prompt.trim();

      if ((!trimmed && attachments.length === 0) || busyRef.current) {
        return;
      }

      await conversationStore.hydrate();

      let chat = conversationStore.getActive();

      if (!chat) {
        chat = conversationStore.startNew();
      }

      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content: trimmed || defaultPrompt(attachments),
        ...(attachments.length ? { attachments } : {}),
      };
      await runGeneration(chat.id, [...chat.messages, userMessage]);
    },
    [runGeneration],
  );

  const editAndResend = useCallback(
    async (messageId: string, prompt: string) => {
      const trimmed = prompt.trim();

      if (!trimmed || busyRef.current) {
        return;
      }

      await conversationStore.hydrate();
      const chat = conversationStore.getActive();
      const index = chat?.messages.findIndex(
        message => message.id === messageId && message.role === 'user',
      );

      if (!chat || index == null || index < 0) {
        return;
      }

      const original = chat.messages[index];
      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content: trimmed,
        ...(original.attachments ? { attachments: original.attachments } : {}),
      };
      conversationStore.beginBranch(chat.id, index);
      await runGeneration(chat.id, [
        ...chat.messages.slice(0, index),
        userMessage,
      ]);
    },
    [runGeneration],
  );

  const regenerate = useCallback(
    async (messageId: string) => {
      if (busyRef.current) {
        return;
      }

      await conversationStore.hydrate();
      const chat = conversationStore.getActive();

      if (!chat) {
        return;
      }

      const index = chat.messages.findIndex(
        message => message.id === messageId,
      );

      if (index < 0) {
        return;
      }

      let userIndex = index;

      while (userIndex >= 0 && chat.messages[userIndex].role !== 'user') {
        userIndex -= 1;
      }

      if (userIndex < 0) {
        return;
      }

      conversationStore.beginBranch(chat.id, userIndex + 1);
      await runGeneration(chat.id, chat.messages.slice(0, userIndex + 1));
    },
    [runGeneration],
  );

  const switchBranch = useCallback((index: number, target: number) => {
    const chat = conversationStore.getActive();

    if (!chat || busyRef.current) {
      return;
    }

    conversationStore.switchBranch(chat.id, index, target);
  }, []);

  const newChat = useCallback(
    async (projectId?: string) => {
      await conversationStore.hydrate();
      await stopGeneration();
      conversationStore.startNew(projectId);
      setStats(null);
    },
    [stopGeneration],
  );

  const openChat = useCallback(
    async (id: string) => {
      await conversationStore.hydrate();
      await modelManager.hydrate();

      if (id === conversationStore.getState().activeId) {
        return;
      }

      await stopGeneration();
      conversationStore.open(id);
      setStats(null);

      const chat = conversationStore.getActive();

      if (!chat?.modelId) {
        return;
      }

      const installed = modelManager
        .getState()
        .installed.some(model => model.id === chat.modelId);

      if (installed && modelManager.getState().selectedId !== chat.modelId) {
        await modelManager.select(chat.modelId);
      }
    },
    [stopGeneration],
  );

  const deleteChat = useCallback(
    async (id: string) => {
      await conversationStore.hydrate();

      if (conversationStore.getState().activeId === id) {
        await stopGeneration();
      }

      conversationStore.remove(id);
    },
    [stopGeneration],
  );

  const renameChat = useCallback((id: string, title: string) => {
    conversationStore.rename(id, title);
  }, []);

  const archiveChat = useCallback(
    async (id: string, archived: boolean) => {
      if (archived && conversationStore.getState().activeId === id) {
        await stopGeneration();
      }

      conversationStore.setArchived(id, archived);
    },
    [stopGeneration],
  );

  const assignModel = useCallback((modelId: string) => {
    const id = conversationStore.getState().activeId;

    if (id) {
      conversationStore.setModel(id, modelId);
    }
  }, []);

  const setInstruction = useCallback((prompt: string) => {
    let chat = conversationStore.getActive();

    if (!chat) {
      chat = conversationStore.startNew();
    }

    conversationStore.setInstruction(chat.id, prompt);
  }, []);

  return {
    messages: active?.messages ?? [],
    branches: active?.branches,
    activeProject:
      state.projects.find(project => project.id === active?.projectId) ?? null,
    conversations: state.conversations,
    projects: state.projects,
    activeId: state.activeId,
    instructionPrompt: active?.systemPrompt ?? '',
    storageError: state.saveError,
    generating,
    phase,
    stats,
    sendMessage,
    editAndResend,
    regenerate,
    switchBranch,
    stopGeneration,
    newChat,
    openChat,
    deleteChat,
    renameChat,
    archiveChat,
    pinChat: (id: string, pinned: boolean) =>
      conversationStore.setPinned(id, pinned),
    moveChat: (id: string, projectId: string | null) =>
      conversationStore.moveToProject(id, projectId),
    createProject: (name: string) => conversationStore.createProject(name),
    renameProject: (id: string, name: string) =>
      conversationStore.renameProject(id, name),
    setProjectInstructions: (id: string, text: string) =>
      conversationStore.setProjectInstructions(id, text),
    deleteProject: (id: string) => conversationStore.removeProject(id),
    assignModel,
    setInstruction,
  };
}
