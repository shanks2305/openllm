import { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { spacing } from '../../theme';
import { branchInfo, type Branches } from '../../chat/branches';
import type { GenerationStats, Message } from '../../hooks/useChat';
import { MessageBubble } from './MessageBubble';

type MessageListProps = {
  messages: Message[];
  branches?: Branches;
  generating: boolean;
  loadingModel?: boolean;
  stats?: GenerationStats | null;
  onEdit?: (message: Message) => void;
  onRegenerate?: (message: Message) => void;
  onSwitchBranch?: (index: number, target: number) => void;
  onRemember?: (message: Message) => void;
  onOpenArtifact?: (message: Message, code: string) => void;
};

export function MessageList({
  messages,
  branches,
  generating,
  loadingModel = false,
  stats = null,
  onEdit,
  onRegenerate,
  onSwitchBranch,
  onRemember,
  onOpenArtifact,
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
      extraData={branches}
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
            branch={branchInfo(branches, messages, index)}
            onEdit={onEdit}
            onRegenerate={onRegenerate}
            onRemember={onRemember}
            onOpenArtifact={onOpenArtifact}
            onSwitchBranch={
              onSwitchBranch
                ? target => onSwitchBranch(index, target)
                : undefined
            }
          />
        );
      }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      onContentSizeChange={() => {
        listRef.current?.scrollToEnd({ animated: true });
      }}
      ListFooterComponent={<View style={styles.footer} />}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.md,
    flexGrow: 1,
  },
  footer: {
    height: spacing.md,
  },
});
