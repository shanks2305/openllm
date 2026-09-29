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
import type { Project } from '../../chat/types';
import { colors, radii, spacing, typography } from '../../theme';
import { Icon } from '../ui/Icon';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PANEL_WIDTH = Math.min(320, Math.round(SCREEN_WIDTH * 0.82));

export type SidebarChat = {
  id: string;
  title: string;
  modelName?: string;
  messages: { content: string }[];
  pinned?: boolean;
  archived?: boolean;
  projectId?: string;
};

type ChatSidebarProps = {
  visible: boolean;
  chats: SidebarChat[];
  projects: Project[];
  activeId: string | null;
  modelName?: string;
  onClose: () => void;
  onNewChat: (projectId?: string) => void;
  onOpenChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
  onShareChat: (id: string) => void;
  onPinChat: (id: string, pinned: boolean) => void;
  onArchiveChat: (id: string, archived: boolean) => void;
  onMoveChat: (id: string, projectId: string | null) => void;
  onCreateProject: (name: string) => Project | null;
  onRenameProject: (id: string, name: string) => void;
  onProjectInstructions: (id: string, instructions: string) => void;
  onDeleteProject: (id: string) => void;
  onOpenModels: () => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
};

type Row = SidebarChat & { snippet?: string | null };

export function ChatSidebar({
  visible,
  chats,
  projects,
  activeId,
  modelName,
  onClose,
  onNewChat,
  onOpenChat,
  onDeleteChat,
  onRenameChat,
  onShareChat,
  onPinChat,
  onArchiveChat,
  onMoveChat,
  onCreateProject,
  onRenameProject,
  onProjectInstructions,
  onDeleteProject,
  onOpenModels,
  onOpenMemory,
  onOpenSettings,
}: ChatSidebarProps) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const overlay = useRef(new Animated.Value(0)).current;
  const [query, setQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const searching = query.trim().length > 0;

  const results = useMemo(
    () =>
      chats.flatMap(chat => {
        const match = matchChat(chat, query);
        return match ? [{ ...chat, snippet: match.snippet }] : [];
      }),
    [chats, query],
  );
  const pinned = chats.filter(chat => chat.pinned && !chat.archived);
  const archived = chats.filter(chat => chat.archived);
  const loose = chats.filter(
    chat => !chat.pinned && !chat.archived && !chat.projectId,
  );
  const inProject = (id: string) =>
    chats.filter(
      chat => chat.projectId === id && !chat.pinned && !chat.archived,
    );

  useEffect(() => {
    if (!visible) {
      translateX.setValue(-PANEL_WIDTH);
      overlay.setValue(0);
      setQuery('');
      setRenamingId(null);
      setShowArchived(false);
      return;
    }

    const active = chats.find(chat => chat.id === activeId);

    if (active?.projectId) {
      setOpenProjects(current => new Set(current).add(active.projectId!));
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
    // Only re-run when the panel opens or closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const toggleProject = (id: string) => {
    setOpenProjects(current => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const promptNewProject = (then?: (project: Project) => void) => {
    Alert.prompt('New project', 'Group related chats and give them shared instructions.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Create',
        onPress: (name?: string) => {
          const project = onCreateProject(name ?? '');

          if (project) {
            setOpenProjects(current => new Set(current).add(project.id));
            then?.(project);
          }
        },
      },
    ]);
  };

  const moveChat = (chat: Row) => {
    Alert.alert('Move to project', chat.title, [
      ...projects
        .filter(project => project.id !== chat.projectId)
        .map(project => ({
          text: project.name,
          onPress: () => onMoveChat(chat.id, project.id),
        })),
      ...(chat.projectId
        ? [{ text: 'Remove from project', onPress: () => onMoveChat(chat.id, null) }]
        : []),
      {
        text: 'New project…',
        onPress: () => promptNewProject(project => onMoveChat(chat.id, project.id)),
      },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const chatActions = (chat: Row) => {
    Alert.alert(chat.title, undefined, [
      chat.archived
        ? { text: 'Unarchive', onPress: () => onArchiveChat(chat.id, false) }
        : {
            text: chat.pinned ? 'Unpin' : 'Pin',
            onPress: () => onPinChat(chat.id, !chat.pinned),
          },
      { text: 'Move to project', onPress: () => moveChat(chat) },
      ...(chat.archived
        ? []
        : [{ text: 'Archive', onPress: () => onArchiveChat(chat.id, true) }]),
      {
        text: 'Rename',
        onPress: () => {
          setRenamingId(chat.id);
          setRenameValue(chat.title);
        },
      },
      { text: 'Share', onPress: () => onShareChat(chat.id) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDeleteChat(chat.id),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const projectActions = (project: Project) => {
    Alert.alert(project.name, project.instructions, [
      {
        text: 'New chat in project',
        onPress: () => {
          onNewChat(project.id);
          dismiss();
        },
      },
      {
        text: 'Rename',
        onPress: () =>
          Alert.prompt(
            'Rename project',
            undefined,
            name => onRenameProject(project.id, name),
            'plain-text',
            project.name,
          ),
      },
      {
        text: 'Instructions',
        onPress: () =>
          Alert.prompt(
            'Project instructions',
            'Used by every chat in this project that has no instructions of its own.',
            text => onProjectInstructions(project.id, text),
            'plain-text',
            project.instructions ?? '',
          ),
      },
      {
        text: 'Delete project',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Delete project?',
            'Its chats stay in your chat list.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => onDeleteProject(project.id),
              },
            ],
          ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderChat = (chat: Row, indent = false) => {
    const isActive = chat.id === activeId;

    if (renamingId === chat.id) {
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

    const project = searching
      ? projects.find(item => item.id === chat.projectId)
      : undefined;

    return (
      <Pressable
        key={chat.id}
        accessibilityRole="button"
        accessibilityLabel={chat.title}
        accessibilityHint="Long press to pin, move, archive, rename, share, or delete"
        onPress={() => {
          onOpenChat(chat.id);
          dismiss();
        }}
        onLongPress={() => chatActions(chat)}
        style={({ pressed }) => [
          styles.chatRow,
          indent && styles.chatRowIndented,
          isActive && styles.chatRowActive,
          pressed && styles.rowPressed,
        ]}
      >
        <Text
          style={[styles.chatTitle, chat.archived && styles.archivedTitle]}
          numberOfLines={1}
        >
          {chat.title}
        </Text>
        {chat.snippet ? (
          <Text style={styles.chatSnippet} numberOfLines={2}>
            {chat.snippet}
          </Text>
        ) : null}
        {chat.modelName || project || chat.archived ? (
          <Text style={styles.chatModel} numberOfLines={1}>
            {[project?.name, chat.archived ? 'Archived' : null, chat.modelName]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismiss}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.overlay, { opacity: overlay }]}>
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
          <View style={styles.searchBox}>
            <Icon name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              selectionColor={colors.accent}
              style={styles.search}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a new chat"
            onPress={() => onNewChat()}
            style={({ pressed }) => [
              styles.navRow,
              pressed && styles.rowPressed,
            ]}
          >
            <Icon name="compose" size={20} color={colors.text} />
            <Text style={styles.navTitle}>New chat</Text>
          </Pressable>

          <ScrollView
            style={styles.chatList}
            contentContainerStyle={styles.chatListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {searching ? (
              <>
                <Text style={styles.section}>Results</Text>
                {results.length === 0 ? (
                  <Text style={styles.empty}>No matching chats</Text>
                ) : (
                  results.map(chat => renderChat(chat))
                )}
              </>
            ) : (
              <>
                <View style={styles.sectionRow}>
                  <Text style={[styles.section, styles.sectionLabel]}>
                    Projects
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="New project"
                    hitSlop={10}
                    onPress={() => promptNewProject()}
                    style={styles.sectionAction}
                  >
                    <Icon name="plus" size={14} color={colors.textMuted} />
                  </Pressable>
                </View>
                {projects.length === 0 ? (
                  <Text style={styles.empty}>
                    Tap + to group chats with shared instructions.
                  </Text>
                ) : (
                  projects.map(project => {
                    const open = openProjects.has(project.id);
                    const members = inProject(project.id);

                    return (
                      <View key={project.id}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={project.name}
                          accessibilityState={{ expanded: open }}
                          accessibilityHint="Long press for project options"
                          onPress={() => toggleProject(project.id)}
                          onLongPress={() => projectActions(project)}
                          style={({ pressed }) => [
                            styles.projectRow,
                            pressed && styles.rowPressed,
                          ]}
                        >
                          <Icon
                            name="folder"
                            size={18}
                            color={colors.textSecondary}
                          />
                          <Text style={styles.projectTitle} numberOfLines={1}>
                            {project.name}
                          </Text>
                          <Text style={styles.projectCount}>
                            {members.length}
                          </Text>
                          <Icon
                            name={open ? 'chevronDown' : 'chevronRight'}
                            size={12}
                            color={colors.textMuted}
                          />
                        </Pressable>
                        {open ? (
                          members.length === 0 ? (
                            <Text style={[styles.empty, styles.chatRowIndented]}>
                              Long-press the project to start a chat in it.
                            </Text>
                          ) : (
                            members.map(chat => renderChat(chat, true))
                          )
                        ) : null}
                      </View>
                    );
                  })
                )}

                {pinned.length > 0 ? (
                  <>
                    <Text style={styles.section}>Pinned</Text>
                    {pinned.map(chat => renderChat(chat))}
                  </>
                ) : null}

                <Text style={styles.section}>Chats</Text>
                {loose.length === 0 ? (
                  <Text style={styles.empty}>
                    {chats.length === 0
                      ? 'No conversations yet'
                      : 'Everything is pinned or in a project'}
                  </Text>
                ) : (
                  loose.map(chat => renderChat(chat))
                )}

                {archived.length > 0 ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showArchived }}
                      onPress={() => setShowArchived(value => !value)}
                      style={({ pressed }) => [
                        styles.projectRow,
                        styles.archivedToggle,
                        pressed && styles.rowPressed,
                      ]}
                    >
                      <Text style={[styles.projectTitle, styles.archivedLabel]}>
                        Archived
                      </Text>
                      <Text style={styles.projectCount}>{archived.length}</Text>
                      <Icon
                        name={showArchived ? 'chevronDown' : 'chevronRight'}
                        size={12}
                        color={colors.textMuted}
                      />
                    </Pressable>
                    {showArchived
                      ? archived.map(chat => renderChat(chat, true))
                      : null}
                  </>
                ) : null}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open models"
              onPress={onOpenModels}
              style={({ pressed }) => [
                styles.navRow,
                pressed && styles.rowPressed,
              ]}
            >
              <Icon name="models" size={20} color={colors.textSecondary} />
              <View style={styles.navText}>
                <Text style={styles.navTitle}>Models</Text>
                <Text style={styles.navSubtitle} numberOfLines={1}>
                  {modelName ?? 'None selected'}
                </Text>
              </View>
              <Icon name="chevronRight" size={14} color={colors.textMuted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open memory"
              onPress={onOpenMemory}
              style={({ pressed }) => [
                styles.navRow,
                pressed && styles.rowPressed,
              ]}
            >
              <Icon name="memory" size={20} color={colors.textSecondary} />
              <Text style={[styles.navTitle, styles.navText]}>Memory</Text>
              <Icon name="chevronRight" size={14} color={colors.textMuted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={onOpenSettings}
              style={({ pressed }) => [
                styles.navRow,
                pressed && styles.rowPressed,
              ]}
            >
              <Icon name="settings" size={20} color={colors.textSecondary} />
              <Text style={[styles.navTitle, styles.navText]}>Settings</Text>
              <Icon name="chevronRight" size={14} color={colors.textMuted} />
            </Pressable>
          </View>
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
    backgroundColor: colors.sidebar,
    paddingHorizontal: spacing.sm + 4,
    borderTopRightRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm + 4,
    height: 40,
    marginBottom: spacing.sm,
  },
  search: {
    ...typography.body,
    fontSize: 15,
    flex: 1,
    paddingVertical: 0,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  section: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionLabel: {
    flex: 1,
  },
  sectionAction: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.sm + 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  projectTitle: {
    ...typography.body,
    fontSize: 15,
    flex: 1,
  },
  projectCount: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  archivedToggle: {
    marginTop: spacing.md,
  },
  archivedLabel: {
    color: colors.textSecondary,
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
    borderRadius: radii.sm + 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  chatRowIndented: {
    marginLeft: spacing.md + 2,
  },
  chatRowActive: {
    backgroundColor: colors.surfaceElevated,
  },
  chatTitle: {
    ...typography.body,
    fontSize: 15,
  },
  archivedTitle: {
    color: colors.textSecondary,
  },
  chatModel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.sm,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm + 2,
  },
  navText: {
    flex: 1,
  },
  navTitle: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '500',
  },
  navSubtitle: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
