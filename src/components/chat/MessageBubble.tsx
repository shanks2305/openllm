import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import type { Message } from '../../hooks/useChat';
import { TypingIndicator } from './TypingIndicator';

type MessageBubbleProps = {
  message: Message;
  isStreaming?: boolean;
  loadingModel?: boolean;
};

export function MessageBubble({
  message,
  isStreaming = false,
  loadingModel = false,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const showTyping = !isUser && isStreaming && message.content.length === 0;

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.body}>{message.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistantRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarLabel}>✦</Text>
      </View>
      <View style={styles.assistantBody}>
        {showTyping ? (
          <View>
            {loadingModel ? (
              <Text style={styles.loading}>Loading model…</Text>
            ) : null}
            <TypingIndicator />
          </View>
        ) : (
          <Text style={styles.body}>
            {message.content}
            {isStreaming ? <Text style={styles.caret}>▍</Text> : null}
          </Text>
        )}
      </View>
    </View>
  );
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
  },
});
