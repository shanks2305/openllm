import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { instructionLabel } from '../chat/instructions';
import { colors, spacing, typography } from '../theme';
import { useChat } from '../hooks/useChat';
import { useModels } from '../hooks/useModels';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { ChatHeader } from '../components/chat/ChatHeader';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { Composer } from '../components/chat/Composer';
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
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const reportedStorageError = useRef<string | null>(null);
  const reportedModelError = useRef<string | null>(null);
  const {
    messages,
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
    stopGeneration,
    newChat,
    openChat,
    deleteChat,
    renameChat,
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
  const activeTitle =
    savedChats.find(chat => chat.id === activeId)?.title ?? 'llmOS';

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

  const closeSidebar = () => setSidebarOpen(false);

  const submit = (text: string) => {
    const task = editingId ? editAndResend(editingId, text) : sendMessage(text);
    setEditingId(null);
    setDraft('');
    task.catch(alertError);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.flex}>
        <ChatHeader
          title={activeTitle}
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenSettings={() => navigation.navigate('Settings')}
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
          />
        )}
        <ModelPicker
          models={installed}
          selectedId={selectedId}
          disabled={generating}
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chat instructions"
          disabled={generating}
          onPress={() => setInstructionsOpen(true)}
          style={({ pressed }) => [
            styles.instructions,
            { opacity: generating ? 0.5 : pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={styles.instructionsLabel}>
            {instructionLabel(instructionPrompt)} instructions
          </Text>
        </Pressable>
        <Composer
          value={draft}
          onChangeText={setDraft}
          generating={generating}
          hasModel={Boolean(selectedModel)}
          editing={editingId != null}
          onCancelEdit={() => {
            setEditingId(null);
            setDraft('');
          }}
          onSend={submit}
          onStop={() => {
            stopGeneration().catch(alertError);
          }}
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
          }))}
          activeId={activeId}
          modelName={selectedModel?.name}
          onClose={closeSidebar}
          onNewChat={() => {
            setDraft('');
            setEditingId(null);
            newChat().catch(alertError);
            closeSidebar();
          }}
          onOpenChat={id => {
            setDraft('');
            setEditingId(null);
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
  instructions: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  instructionsLabel: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
});

export default ChatScreen;
