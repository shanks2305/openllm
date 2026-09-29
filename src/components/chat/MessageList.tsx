import { useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { spacing } from '../../theme';
import type { Message } from '../../hooks/useChat';
import { MessageBubble } from './MessageBubble';

type MessageListProps = {
  messages: Message[];
  generating: boolean;
  loadingModel?: boolean;
};

export function MessageList({
  messages,
  generating,
  loadingModel = false,
}: MessageListProps) {
  const listRef = useRef<FlatList<Message>>(null);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={item => item.id}
      renderItem={({ item, index }) => (
        <MessageBubble
          message={item}
          isStreaming={
            generating && index === messages.length - 1 && item.role === 'assistant'
          }
          loadingModel={
            loadingModel &&
            index === messages.length - 1 &&
            item.role === 'assistant'
          }
        />
      )}
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
