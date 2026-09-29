import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { conversationStore } from '../chat/conversationStore';
import type { ConversationState } from '../chat/conversationStore';
import { createId } from '../chat/ids';
import { messagesToTurns, promptTokenBudget } from '../chat/prompt';
import type { ChatMessage } from '../chat/types';
import { NativeLlamaEngine } from '../engine/NativeLlamaEngine';
import { modelManager } from '../model/ModelManager';
import { settingsStore } from '../settings/settingsStore';

export type Message = ChatMessage;
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
    }

    await engine.stopGeneration();
    await conversationStore.flush();
  }, [engine]);

  const runGeneration = useCallback(
    async (chatId: string, history: ChatMessage[]) => {
      const gen = ++generationRef.current;
      busyRef.current = true;
      setGenerating(true);
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

        const settings = settingsStore.getState();
        const chat =
          conversationStore
            .getState()
            .conversations.find(item => item.id === chatId) ?? null;
        const systemPrompt = chat?.systemPrompt?.trim()
          ? chat.systemPrompt
          : settings.systemPrompt;
        const selected = modelManager.getState().selectedModel;

        if (selected) {
          conversationStore.setModel(chatId, selected.id);
        }

        await engine.loadModel({ contextSize: settings.contextSize });

        if (generationRef.current !== gen) {
          return;
        }

        setPhase('generating');
        generatedAt = Date.now();
        await engine.generate(
          messagesToTurns(
            history,
            systemPrompt,
            promptTokenBudget(settings.contextSize, settings.maxTokens),
          ),
          token => {
            if (generationRef.current !== gen) {
              return;
            }

            tokens += 1;

            if (firstTokenAt == null) {
              firstTokenAt = Date.now();
            }

            const elapsed = (Date.now() - generatedAt) / 1000;
            setStats({
              tokensPerSecond: elapsed >= 0.4 ? tokens / elapsed : null,
              timeToFirstTokenMs: firstTokenAt - startedAt,
            });
            displayed = displayed.map(message =>
              message.id === assistantMessage.id
                ? { ...message, content: message.content + token }
                : message,
            );
            conversationStore.setMessages(chatId, displayed);
          },
          {
            maxTokens: settings.maxTokens,
            temperature: settings.temperature,
            topP: settings.topP,
            repeatPenalty: settings.repeatPenalty,
            contextSize: settings.contextSize,
          },
        );
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
    [engine],
  );

  const sendMessage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();

      if (!trimmed || busyRef.current) {
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
        content: trimmed,
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

      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content: trimmed,
      };
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

      await runGeneration(chat.id, chat.messages.slice(0, userIndex + 1));
    },
    [runGeneration],
  );

  const newChat = useCallback(async () => {
    await conversationStore.hydrate();
    await stopGeneration();
    conversationStore.startNew();
    setStats(null);
  }, [stopGeneration]);

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
    conversations: state.conversations,
    activeId: state.activeId,
    instructionPrompt: active?.systemPrompt ?? '',
    storageError: state.saveError,
    generating,
    phase,
    stats,
    sendMessage,
    editAndResend,
    regenerate,
    stopGeneration,
    newChat,
    openChat,
    deleteChat,
    renameChat,
    assignModel,
    setInstruction,
  };
}
