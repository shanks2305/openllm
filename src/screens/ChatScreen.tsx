import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  discardAttachments,
  MAX_ATTACHMENTS,
  pickFiles,
  pickImages,
} from '../chat/attachments';
import { extractArtifacts } from '../chat/artifacts';
import { conversationToMarkdown } from '../chat/export';
import { instructionLabel } from '../chat/instructions';
import type { Attachment } from '../chat/types';
import { MAX_MEMORY_LENGTH, memoryStore } from '../memory/memoryStore';
import { hasVision, reasoningStyle } from '../model/capabilities';
import { colors } from '../theme';
import { useChat } from '../hooks/useChat';
import { useModels } from '../hooks/useModels';
import { useSettings } from '../hooks/useSettings';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { ArtifactSheet } from '../components/chat/ArtifactSheet';
import { ChatHeader } from '../components/chat/ChatHeader';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { Composer } from '../components/chat/Composer';
import type { AttachSource } from '../components/chat/Composer';
import { EmptyState } from '../components/chat/EmptyState';
import { InstructionSheet } from '../components/chat/InstructionSheet';
import { MessageList } from '../components/chat/MessageList';
import { ModelPicker } from '../components/chat/ModelPicker';

type ChatNav = NativeStackNavigationProp<RootStackParamList, 'Chat'>;

function alertError(error: unknown) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : 'Something went wrong';
  Alert.alert('Something went wrong', message);
}

const ChatScreen = () => {
  const navigation = useNavigation<ChatNav>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [artifactIndex, setArtifactIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const settings = useSettings();
  const reportedStorageError = useRef<string | null>(null);
  const reportedModelError = useRef<string | null>(null);
  const {
    messages,
    branches,
    conversations,
    activeId,
    instructionPrompt,
    storageError,
    generating,
    phase,
    stats,
    sendMessage,
    editAndResend,
    regenerate,
    switchBranch,
    stopGeneration,
    newChat,
    openChat,
    deleteChat,
    renameChat,
    archiveChat,
    pinChat,
    moveChat,
    createProject,
    renameProject,
    setProjectInstructions,
    deleteProject,
    projects,
    activeProject,
    assignModel,
    setInstruction,
  } = useChat();
  const {
    installed,
    selectedId,
    selectedModel,
    select,
    error: modelError,
  } = useModels();
  const savedChats = conversations.filter(chat =>
    chat.messages.some(
      message => message.role === 'user' && message.content.trim(),
    ),
  );
  useEffect(() => {
    if (!storageError || storageError === reportedStorageError.current) {
      return;
    }

    reportedStorageError.current = storageError;
    Alert.alert('Could not save', storageError);
  }, [storageError]);

  useEffect(() => {
    if (!modelError) {
      reportedModelError.current = null;
      return;
    }

    if (modelError === reportedModelError.current) {
      return;
    }

    reportedModelError.current = modelError;
    Alert.alert('Could not switch model', modelError);
  }, [modelError]);

  const artifacts = useMemo(() => extractArtifacts(messages), [messages]);

  useEffect(() => {
    setArtifactIndex(null);
  }, [activeId]);

  const closeSidebar = () => setSidebarOpen(false);
  const reasoning = reasoningStyle(selectedModel);
  const vision = hasVision(selectedModel);

  const clearDraft = () => {
    setDraft('');
    setEditingId(null);
    setAttachments(current => {
      discardAttachments(current);
      return [];
    });
  };

  const startNewChat = (projectId?: string) => {
    clearDraft();
    newChat(projectId).catch(alertError);
  };

  const attach = async (source: AttachSource) => {
    const room = MAX_ATTACHMENTS - attachments.length;

    if (room <= 0) {
      return;
    }

    setAttaching(true);

    try {
      const picked =
        source === 'photos' ? await pickImages(room) : await pickFiles(room);

      if (!picked?.length) {
        return;
      }

      setAttachments(current => [...current, ...picked]);

      if (!vision && picked.some(item => item.kind === 'image')) {
        Alert.alert(
          "This model can't see images",
          'Switch to a vision model such as SmolVLM2 or Qwen2.5-VL in Models. The image stays attached either way.',
        );
      }
    } catch (error) {
      alertError(error);
    } finally {
      setAttaching(false);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(current => {
      discardAttachments(current.filter(item => item.id === id));
      return current.filter(item => item.id !== id);
    });
  };

  const remember = (text: string) => {
    Alert.prompt(
      'Remember',
      'The model will know this in every chat. Edit it before saving.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (value?: string) => {
            if (!memoryStore.add(value ?? '')) {
              Alert.alert('Not saved', 'That is empty, already saved, or memory is full.');
            }
          },
        },
      ],
      'plain-text',
      text.trim().slice(0, MAX_MEMORY_LENGTH),
    );
  };

  const shareChat = (id: string) => {
    const chat = conversations.find(item => item.id === id);

    if (!chat) {
      return;
    }

    const modelName = installed.find(model => model.id === chat.modelId)?.name;
    Share.share({
      title: chat.title,
      message: conversationToMarkdown(chat, modelName),
    }).catch(alertError);
  };

  const submit = (text: string) => {
    const task = editingId
      ? editAndResend(editingId, text)
      : sendMessage(text, attachments);
    setEditingId(null);
    setDraft('');

    if (!editingId) {
      setAttachments([]);
    }

    task.catch(alertError);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.flex}>
        <ChatHeader
          modelName={selectedModel?.name}
          modelDisabled={generating}
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenModelPicker={() => setModelPickerOpen(true)}
          onNewChat={() => startNewChat()}
          onShare={
            activeId && messages.length > 0 && !generating
              ? () => shareChat(activeId)
              : undefined
          }
        />
        {messages.length === 0 ? (
          <EmptyState
            hasModel={Boolean(selectedModel)}
            onPrompt={text => {
              sendMessage(text).catch(alertError);
            }}
            onManageModels={() => navigation.navigate('Models')}
          />
        ) : (
          <MessageList
            messages={messages}
            branches={branches}
            generating={generating}
            loadingModel={phase === 'loading'}
            stats={stats}
            onEdit={message => {
              setEditingId(message.id);
              setDraft(message.content);
            }}
            onRegenerate={message => {
              regenerate(message.id).catch(alertError);
            }}
            onSwitchBranch={switchBranch}
            onRemember={message => remember(message.content)}
            onOpenArtifact={(message, code) => {
              const found = artifacts.findIndex(
                item => item.messageId === message.id && item.code === code,
              );

              if (found >= 0) {
                setArtifactIndex(found);
              }
            }}
          />
        )}
        <Composer
          value={draft}
          onChangeText={setDraft}
          generating={generating}
          hasModel={Boolean(selectedModel)}
          editing={editingId != null}
          instructionLabel={
            !instructionPrompt.trim() && activeProject?.instructions
              ? activeProject.name
              : instructionLabel(instructionPrompt)
          }
          attachments={attachments}
          attaching={attaching}
          canAttachMore={attachments.length < MAX_ATTACHMENTS}
          onAttach={source => {
            attach(source).catch(alertError);
          }}
          onRemoveAttachment={removeAttachment}
          tools={{
            on: settings.tools,
            onToggle: () => settings.setTools(!settings.tools),
          }}
          thinking={
            reasoning === 'toggle'
              ? {
                  on: settings.thinking,
                  onToggle: () => settings.setThinking(!settings.thinking),
                }
              : undefined
          }
          onOpenInstructions={() => setInstructionsOpen(true)}
          onCancelEdit={() => {
            setEditingId(null);
            setDraft('');
          }}
          onSend={submit}
          onStop={() => {
            stopGeneration().catch(alertError);
          }}
        />
        <ModelPicker
          visible={modelPickerOpen}
          models={installed}
          selectedId={selectedId}
          onClose={() => setModelPickerOpen(false)}
          onSelect={id => {
            select(id)
              .then(ok => {
                if (ok) {
                  assignModel(id);
                }
              })
              .catch(() => undefined);
          }}
          onManageModels={() => navigation.navigate('Models')}
        />
        <ArtifactSheet
          artifacts={artifacts}
          index={artifactIndex}
          onChangeIndex={setArtifactIndex}
          onClose={() => setArtifactIndex(null)}
        />
        <InstructionSheet
          visible={instructionsOpen}
          value={instructionPrompt}
          onClose={() => setInstructionsOpen(false)}
          onSave={setInstruction}
        />
        <ChatSidebar
          visible={sidebarOpen}
          chats={savedChats.map(chat => ({
            id: chat.id,
            title: chat.title,
            modelName: installed.find(model => model.id === chat.modelId)?.name,
            messages: chat.messages,
            pinned: chat.pinned,
            archived: chat.archived,
            projectId: chat.projectId,
          }))}
          projects={projects}
          activeId={activeId}
          modelName={selectedModel?.name}
          onClose={closeSidebar}
          onNewChat={projectId => {
            startNewChat(projectId);
            closeSidebar();
          }}
          onPinChat={pinChat}
          onArchiveChat={(id, archived) => {
            archiveChat(id, archived).catch(alertError);
          }}
          onMoveChat={moveChat}
          onCreateProject={createProject}
          onRenameProject={renameProject}
          onProjectInstructions={setProjectInstructions}
          onDeleteProject={deleteProject}
          onOpenMemory={() => {
            closeSidebar();
            navigation.navigate('Memory');
          }}
          onOpenChat={id => {
            clearDraft();
            openChat(id).catch(alertError);
          }}
          onDeleteChat={id => {
            const chat = savedChats.find(item => item.id === id);
            Alert.alert(
              'Delete chat?',
              chat?.title ?? 'This conversation will be removed.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    deleteChat(id).catch(alertError);
                  },
                },
              ],
            );
          }}
          onRenameChat={renameChat}
          onShareChat={shareChat}
          onOpenModels={() => {
            closeSidebar();
            navigation.navigate('Models');
          }}
          onOpenSettings={() => {
            closeSidebar();
            navigation.navigate('Settings');
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export default ChatScreen;
