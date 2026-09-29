import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { matchChat } from '../../chat/search';
import { colors, radii, spacing, typography } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PANEL_WIDTH = Math.min(320, Math.round(SCREEN_WIDTH * 0.82));

export type SidebarChat = {
  id: string;
  title: string;
  modelName?: string;
  messages: { content: string }[];
};

type ChatSidebarProps = {
  visible: boolean;
  chats: SidebarChat[];
  activeId: string | null;
  modelName?: string;
  onClose: () => void;
  onNewChat: () => void;
  onOpenChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
  onShareChat: (id: string) => void;
  onOpenModels: () => void;
  onOpenSettings: () => void;
};

export function ChatSidebar({
  visible,
  chats,
  activeId,
  modelName,
  onClose,
  onNewChat,
  onOpenChat,
  onDeleteChat,
  onRenameChat,
  onShareChat,
  onOpenModels,
  onOpenSettings,
}: ChatSidebarProps) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const overlay = useRef(new Animated.Value(0)).current;
  const [query, setQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const visibleChats = useMemo(
    () =>
      chats.flatMap(chat => {
        const match = matchChat(chat, query);
        return match ? [{ ...chat, snippet: match.snippet }] : [];
      }),
    [chats, query],
  );

  useEffect(() => {
    if (!visible) {
      translateX.setValue(-PANEL_WIDTH);
      overlay.setValue(0);
      setQuery('');
      setRenamingId(null);
      return;
    }

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(overlay, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [overlay, translateX, visible]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -PANEL_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(overlay, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
      }
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismiss}
    >
      <View style={styles.root}>
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: overlay,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close sidebar"
            style={StyleSheet.absoluteFill}
            onPress={dismiss}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.panel,
            {
              width: PANEL_WIDTH,
              height: '100%',
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + spacing.md,
              transform: [{ translateX }],
            },
          ]}
        >
          <Text style={styles.brand}>llmOS</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a new chat"
            onPress={onNewChat}
            style={({ pressed }) => [
              styles.newChat,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.newChatLabel}>+ New chat</Text>
          </Pressable>

          <Text style={styles.section}>Chats</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats and messages"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            style={styles.search}
          />
          <ScrollView
            style={styles.chatList}
            contentContainerStyle={styles.chatListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {chats.length === 0 ? (
              <Text style={styles.empty}>No conversations yet</Text>
            ) : visibleChats.length === 0 ? (
              <Text style={styles.empty}>No matching chats</Text>
            ) : (
              visibleChats.map(chat => {
                const isActive = chat.id === activeId;
                const renaming = renamingId === chat.id;

                if (renaming) {
                  return (
                    <View key={chat.id} style={styles.renameBox}>
                      <TextInput
                        value={renameValue}
                        onChangeText={setRenameValue}
                        autoFocus
                        style={styles.renameInput}
                      />
                      <View style={styles.renameActions}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setRenamingId(null)}
                        >
                          <Text style={styles.renameCancel}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            onRenameChat(chat.id, renameValue);
                            setRenamingId(null);
                          }}
                        >
                          <Text style={styles.renameSave}>Save</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                }

                return (
                  <Pressable
                    key={chat.id}
                    accessibilityRole="button"
                    accessibilityLabel={chat.title}
                    accessibilityHint="Long press to rename, share, or delete"
                    onPress={() => {
                      onOpenChat(chat.id);
                      dismiss();
                    }}
                    onLongPress={() => {
                      Alert.alert(chat.title, undefined, [
                        {
                          text: 'Rename',
                          onPress: () => {
                            setRenamingId(chat.id);
                            setRenameValue(chat.title);
                          },
                        },
                        {
                          text: 'Share',
                          onPress: () => onShareChat(chat.id),
                        },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => onDeleteChat(chat.id),
                        },
                        { text: 'Cancel', style: 'cancel' },
                      ]);
                    }}
                    style={({ pressed }) => [
                      styles.chatRow,
                      isActive && styles.chatRowActive,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Text style={styles.chatTitle} numberOfLines={1}>
                      {chat.title}
                    </Text>
                    {chat.snippet ? (
                      <Text style={styles.chatSnippet} numberOfLines={2}>
                        {chat.snippet}
                      </Text>
                    ) : null}
                    {chat.modelName ? (
                      <Text style={styles.chatModel} numberOfLines={1}>
                        {chat.modelName}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open models"
            onPress={onOpenModels}
            style={({ pressed }) => [
              styles.navRow,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <View style={styles.navText}>
              <Text style={styles.navTitle}>Models</Text>
              <Text style={styles.navSubtitle} numberOfLines={1}>
                {modelName ?? 'None selected'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={onOpenSettings}
            style={({ pressed }) => [
              styles.navRow,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={styles.navTitle}>Settings</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  panel: {
    backgroundColor: colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  brand: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  newChat: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    marginBottom: spacing.lg,
  },
  newChatLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  section: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  search: {
    ...typography.body,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  renameBox: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  renameInput: {
    ...typography.body,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  renameCancel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  renameSave: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  chatRow: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  chatRowActive: {
    backgroundColor: colors.surfaceElevated,
  },
  chatTitle: {
    ...typography.body,
    fontSize: 15,
  },
  chatModel: {
    ...typography.caption,
    marginTop: 2,
  },
  chatSnippet: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    paddingBottom: spacing.md,
  },
  empty: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  navText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  navTitle: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  navSubtitle: {
    ...typography.caption,
    marginTop: 4,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 22,
    lineHeight: 24,
  },
});
