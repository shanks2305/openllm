import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { conversationStore } from '../chat/conversationStore';
import type { ConversationState } from '../chat/conversationStore';
import { messagesToTurns } from '../chat/prompt';
import type { ChatMessage } from '../chat/types';
import { NativeLlamaEngine } from '../engine/NativeLlamaEngine';
import { settingsStore } from '../settings/settingsStore';

export type Message = ChatMessage;
export type GenerationPhase = 'idle' | 'loading' | 'generating';

export function useChat() {
  const [state, setState] = useState<ConversationState>(() =>
    conversationStore.getState(),
  );
  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState<GenerationPhase>('idle');
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

    const current = conversationStore.getActive();
    const last = current?.messages[current.messages.length - 1];

    if (current && last?.role === 'assistant' && last.content.length === 0) {
      conversationStore.setMessages(current.id, current.messages.slice(0, -1));
    }

    await engine.stopGeneration();
    await conversationStore.flush();
  }, [engine]);

  const sendMessage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();

      if (!trimmed || busyRef.current) {
        return;
      }

      await conversationStore.hydrate();
      await settingsStore.hydrate();

      let chat = conversationStore.getActive();

      if (!chat) {
        chat = conversationStore.startNew();
      }

      const gen = ++generationRef.current;
      busyRef.current = true;
      setGenerating(true);
      setPhase('loading');

      const userMessage: ChatMessage = {
        id: `${gen}-user`,
        role: 'user',
        content: trimmed,
      };
      const assistantMessage: ChatMessage = {
        id: `${gen}-assistant`,
        role: 'assistant',
        content: '',
      };
      const chatId = chat.id;
      const history = [...chat.messages, userMessage];
      let displayed = [...history, assistantMessage];
      conversationStore.setMessages(chatId, displayed);

      try {
        const settings = settingsStore.getState();
        await engine.loadModel();

        if (generationRef.current !== gen) {
          return;
        }

        setPhase('generating');
        await engine.generate(
          messagesToTurns(history, settings.systemPrompt),
          token => {
            if (generationRef.current !== gen) {
              return;
            }

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
          },
        );
      } catch (error) {
        if (generationRef.current !== gen) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Generation failed';
        displayed = displayed.map(item =>
          item.id === assistantMessage.id
            ? { ...item, content: item.content || message }
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

  const newChat = useCallback(async () => {
    await conversationStore.hydrate();
    await stopGeneration();
    conversationStore.startNew();
  }, [stopGeneration]);

  const openChat = useCallback(
    async (id: string) => {
      await conversationStore.hydrate();

      if (id === conversationStore.getState().activeId) {
        return;
      }

      await stopGeneration();
      conversationStore.open(id);
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

  return {
    messages: active?.messages ?? [],
    conversations: state.conversations,
    activeId: state.activeId,
    generating,
    phase,
    sendMessage,
    stopGeneration,
    newChat,
    openChat,
    deleteChat,
  };
}
