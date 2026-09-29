import {
  Alert,
  Clipboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import type { GenerationStats, Message } from '../../hooks/useChat';
import { MarkdownBody } from './MarkdownBody';
import { TypingIndicator } from './TypingIndicator';

type MessageBubbleProps = {
  message: Message;
  isStreaming?: boolean;
  loadingModel?: boolean;
  actionsDisabled?: boolean;
  stats?: GenerationStats | null;
  onEdit?: (message: Message) => void;
  onRegenerate?: (message: Message) => void;
};

export function MessageBubble({
  message,
  isStreaming = false,
  loadingModel = false,
  actionsDisabled = false,
  stats = null,
  onEdit,
  onRegenerate,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const showTyping = !isUser && isStreaming && message.content.length === 0;
  const statsLabel = formatStats(isStreaming ? stats : null);

  const openActions = () => {
    if (actionsDisabled || showTyping) {
      return;
    }

    const actions: Array<{
      text: string;
      style?: 'cancel' | 'destructive';
      onPress?: () => void;
    }> = [
      {
        text: 'Copy',
        onPress: () => {
          Clipboard.setString(message.content);
        },
      },
    ];

    if (isUser && onEdit) {
      actions.unshift({
        text: 'Edit',
        onPress: () => onEdit(message),
      });
    }

    if (!isUser && onRegenerate) {
      actions.push({
        text: 'Regenerate',
        onPress: () => onRegenerate(message),
      });
    }

    actions.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(isUser ? 'Your message' : 'Reply', undefined, actions);
  };

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Message actions"
          accessibilityHint="Long press to edit or copy"
          delayLongPress={280}
          onLongPress={openActions}
          style={styles.userBubble}
        >
          <Text selectable style={styles.body}>
            {message.content}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.assistantRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarLabel}>✦</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reply actions"
        accessibilityHint="Long press to copy or regenerate"
        delayLongPress={280}
        onLongPress={openActions}
        style={styles.assistantBody}
      >
        {showTyping ? (
          <View>
            {loadingModel ? (
              <Text style={styles.loading}>Loading model…</Text>
            ) : null}
            <TypingIndicator />
          </View>
        ) : (
          <View>
            <MarkdownBody content={message.content} />
            {isStreaming ? <Text style={styles.caret}>▍</Text> : null}
          </View>
        )}
        {statsLabel ? <Text style={styles.stats}>{statsLabel}</Text> : null}
      </Pressable>
    </View>
  );
}

function formatStats(stats: GenerationStats | null) {
  if (!stats) {
    return '';
  }

  const parts: string[] = [];

  if (stats.timeToFirstTokenMs != null) {
    parts.push(`first token ${(stats.timeToFirstTokenMs / 1000).toFixed(1)}s`);
  }

  if (stats.tokensPerSecond != null) {
    parts.push(`${Math.round(stats.tokensPerSecond)} tok/s`);
  }

  return parts.join(' · ');
}

const styles = StyleSheet.create({
  userRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderBottomRightRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    marginTop: 2,
  },
  avatarLabel: {
    color: colors.accent,
    fontSize: 12,
  },
  assistantBody: {
    flex: 1,
    paddingTop: 4,
  },
  loading: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  body: {
    ...typography.body,
    lineHeight: 22,
  },
  caret: {
    color: colors.accent,
    marginTop: spacing.xs,
  },
  stats: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
