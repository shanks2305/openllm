import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Clipboard,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { hapticTap } from '../../haptics';
import {
  getSpeakingId,
  mediaAvailable,
  speak,
  speakableText,
  stopSpeaking,
  subscribeSpeech,
} from '../../media/media';
import { colors, spacing, typography } from '../../theme';
import type { BranchInfo } from '../../chat/branches';
import { splitReasoning } from '../../chat/reasoning';
import type { MessageStats } from '../../chat/types';
import type { GenerationStats, Message } from '../../hooks/useChat';
import { IconButton } from '../ui/IconButton';
import { AttachmentStrip } from './AttachmentStrip';
import { BranchSwitcher } from './BranchSwitcher';
import { MarkdownBody } from './MarkdownBody';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallList } from './ToolCallList';
import { TypingIndicator } from './TypingIndicator';

type MessageBubbleProps = {
  message: Message;
  isStreaming?: boolean;
  loadingModel?: boolean;
  actionsDisabled?: boolean;
  stats?: GenerationStats | null;
  branch?: BranchInfo | null;
  onEdit?: (message: Message) => void;
  onRegenerate?: (message: Message) => void;
  onSwitchBranch?: (target: number) => void;
  onRemember?: (message: Message) => void;
  onOpenArtifact?: (message: Message, code: string) => void;
};

export function MessageBubble({
  message,
  isStreaming = false,
  loadingModel = false,
  actionsDisabled = false,
  stats = null,
  branch = null,
  onEdit,
  onRegenerate,
  onSwitchBranch,
  onRemember,
  onOpenArtifact,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUser = message.role === 'user';
  const parts = useMemo(
    () =>
      isUser
        ? { thinking: null, thinkingDone: true, answer: message.content }
        : splitReasoning(message.content),
    [isUser, message.content],
  );
  const speaking =
    useSyncExternalStore(subscribeSpeech, getSpeakingId) === message.id;
  const toolCalls = message.toolCalls ?? [];
  const showTyping =
    !isUser &&
    isStreaming &&
    message.content.length === 0 &&
    toolCalls.length === 0;
  const statsLabel = isStreaming
    ? formatStats(stats)
    : formatSavedStats(message.stats);

  useEffect(
    () => () => {
      if (copiedTimer.current) {
        clearTimeout(copiedTimer.current);
      }
    },
    [],
  );

  const copy = () => {
    Clipboard.setString(parts.answer);
    hapticTap();
    setCopied(true);

    if (copiedTimer.current) {
      clearTimeout(copiedTimer.current);
    }

    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  const share = () => {
    Share.share({ message: parts.answer }).catch(() => undefined);
  };

  const toggleSpeech = () => {
    hapticTap();

    if (speaking) {
      stopSpeaking();
      return;
    }

    try {
      speak(message.id, speakableText(parts.answer));
    } catch (error) {
      Alert.alert(
        'Read aloud unavailable',
        error instanceof Error ? error.message : 'Could not start speech',
      );
    }
  };

  const openActions = () => {
    if (actionsDisabled || showTyping) {
      return;
    }

    const actions: Array<{
      text: string;
      style?: 'cancel' | 'destructive';
      onPress?: () => void;
    }> = [
      { text: 'Copy', onPress: copy },
      { text: 'Share', onPress: share },
    ];

    if (isUser && onEdit) {
      actions.unshift({
        text: 'Edit',
        onPress: () => onEdit(message),
      });
    }

    if (isUser && onRemember) {
      actions.push({
        text: 'Remember',
        onPress: () => onRemember(message),
      });
    }

    if (!isUser && onRegenerate) {
      actions.push({
        text: 'Regenerate',
        onPress: () => onRegenerate(message),
      });
    }

    if (!isUser && mediaAvailable && parts.answer.trim()) {
      actions.push({
        text: speaking ? 'Stop reading' : 'Read aloud',
        onPress: toggleSpeech,
      });
    }

    actions.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(isUser ? 'Your message' : 'Reply', undefined, actions);
  };

  if (isUser) {
    return (
      <View style={styles.userRow}>
        {message.attachments?.length ? (
          <View style={styles.userAttachments}>
            <AttachmentStrip attachments={message.attachments} align="end" />
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Message actions"
          accessibilityHint="Long press to edit or copy"
          delayLongPress={280}
          onLongPress={openActions}
          style={({ pressed }) => [
            styles.userBubble,
            pressed && styles.userBubblePressed,
          ]}
        >
          <Text selectable style={styles.userText}>
            {message.content}
          </Text>
        </Pressable>
        {branch && onSwitchBranch ? (
          <View style={styles.userBranch}>
            <BranchSwitcher
              branch={branch}
              disabled={actionsDisabled}
              onSwitch={onSwitchBranch}
            />
          </View>
        ) : null}
      </View>
    );
  }

  const showActions = !isStreaming && message.content.length > 0;

  return (
    <View style={styles.assistantRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reply actions"
        accessibilityHint="Long press to copy or regenerate"
        delayLongPress={280}
        onLongPress={openActions}
      >
        {showTyping ? (
          <View style={styles.typing}>
            <TypingIndicator />
            {loadingModel ? (
              <Text style={styles.loading}>Loading model…</Text>
            ) : null}
          </View>
        ) : (
          <>
            {parts.thinking != null ? (
              <ThinkingBlock text={parts.thinking} done={parts.thinkingDone} />
            ) : null}
            <ToolCallList calls={toolCalls} />
            {parts.answer ? (
              <MarkdownBody
                content={parts.answer}
                onOpenCode={
                  onOpenArtifact && !isStreaming
                    ? code => onOpenArtifact(message, code)
                    : undefined
                }
              />
            ) : isStreaming && parts.thinkingDone ? (
              <TypingIndicator />
            ) : null}
          </>
        )}
      </Pressable>
      {showActions ? (
        <View style={styles.actions}>
          {branch && onSwitchBranch ? (
            <BranchSwitcher
              branch={branch}
              disabled={actionsDisabled}
              onSwitch={onSwitchBranch}
            />
          ) : null}
          <IconButton
            icon={copied ? 'check' : 'copy'}
            size={32}
            iconSize={16}
            color={colors.textMuted}
            accessibilityLabel={copied ? 'Copied' : 'Copy reply'}
            disabled={actionsDisabled}
            onPress={copy}
          />
          {onRegenerate ? (
            <IconButton
              icon="refresh"
              size={32}
              iconSize={17}
              color={colors.textMuted}
              accessibilityLabel="Regenerate reply"
              disabled={actionsDisabled}
              onPress={() => onRegenerate(message)}
            />
          ) : null}
          <IconButton
            icon="share"
            size={32}
            iconSize={16}
            color={colors.textMuted}
            accessibilityLabel="Share reply"
            disabled={actionsDisabled}
            onPress={share}
          />
          {mediaAvailable && parts.answer.trim() ? (
            <IconButton
              icon={speaking ? 'stop' : 'speaker'}
              size={32}
              iconSize={speaking ? 20 : 16}
              color={speaking ? colors.accent : colors.textMuted}
              accessibilityLabel={speaking ? 'Stop reading' : 'Read aloud'}
              onPress={toggleSpeech}
            />
          ) : null}
          {statsLabel ? (
            <Text style={styles.stats} numberOfLines={1}>
              {statsLabel}
            </Text>
          ) : null}
        </View>
      ) : statsLabel && !showTyping ? (
        <Text style={[styles.stats, styles.streamingStats]}>{statsLabel}</Text>
      ) : null}
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

function formatSavedStats(stats: MessageStats | undefined) {
  if (!stats) {
    return '';
  }

  const parts = [formatStats(stats), `${stats.tokens} tokens`];
  parts.push(stats.gpu ? 'GPU' : 'CPU');
  return parts.filter(Boolean).join(' · ');
}

const styles = StyleSheet.create({
  userRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
    paddingLeft: spacing.xl + spacing.md,
  },
  userBubble: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 3,
  },
  userAttachments: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    marginBottom: spacing.xs + 2,
  },
  userBranch: {
    marginTop: spacing.xs,
  },
  userBubblePressed: {
    backgroundColor: colors.surfacePressed,
  },
  userText: {
    ...typography.body,
    lineHeight: 23,
  },
  assistantRow: {
    marginBottom: spacing.lg,
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 24,
  },
  loading: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginLeft: -6,
  },
  stats: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: spacing.xs,
    flexShrink: 1,
  },
  streamingStats: {
    marginLeft: 0,
    marginTop: spacing.sm,
  },
});
