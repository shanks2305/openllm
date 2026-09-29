import { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { spacing } from '../../theme';
import type { GenerationStats, Message } from '../../hooks/useChat';
import { MessageBubble } from './MessageBubble';

type MessageListProps = {
  messages: Message[];
  generating: boolean;
  loadingModel?: boolean;
  stats?: GenerationStats | null;
  onEdit?: (message: Message) => void;
  onRegenerate?: (message: Message) => void;
};

export function MessageList({
  messages,
  generating,
  loadingModel = false,
  stats = null,
  onEdit,
  onRegenerate,
}: MessageListProps) {
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (!generating) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [generating]);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={item => item.id}
      renderItem={({ item, index }) => {
        const isLast = index === messages.length - 1;

        return (
          <MessageBubble
            message={item}
            isStreaming={generating && isLast && item.role === 'assistant'}
            loadingModel={loadingModel && isLast && item.role === 'assistant'}
            actionsDisabled={generating}
            stats={generating && isLast ? stats : null}
            onEdit={onEdit}
            onRegenerate={onRegenerate}
          />
        );
      }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => {
        listRef.current?.scrollToEnd({ animated: true });
      }}
      ListFooterComponent={<View style={styles.footer} />}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    flexGrow: 1,
  },
  footer: {
    height: spacing.sm,
  },
});
