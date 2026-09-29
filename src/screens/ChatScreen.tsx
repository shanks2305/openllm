import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { useChat } from '../hooks/useChat';
import { useModels } from '../hooks/useModels';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { ChatHeader } from '../components/chat/ChatHeader';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { Composer } from '../components/chat/Composer';
import { EmptyState } from '../components/chat/EmptyState';
import { MessageList } from '../components/chat/MessageList';
import { ModelPicker } from '../components/chat/ModelPicker';

type ChatNav = NativeStackNavigationProp<RootStackParamList, 'Chat'>;

const ChatScreen = () => {
  const navigation = useNavigation<ChatNav>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    messages,
    conversations,
    activeId,
    generating,
    phase,
    sendMessage,
    stopGeneration,
    newChat,
    openChat,
    deleteChat,
  } = useChat();
  const { installed, selectedId, selectedModel, select } = useModels();
  const savedChats = conversations.filter(chat =>
    chat.messages.some(
      message => message.role === 'user' && message.content.trim(),
    ),
  );
  const activeTitle =
    savedChats.find(chat => chat.id === activeId)?.title ?? 'llmOS';

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.flex}>
        <ChatHeader
          title={activeTitle}
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenSettings={() => navigation.navigate('Settings')}
        />
        {messages.length === 0 ? (
          <EmptyState onManageModels={() => navigation.navigate('Models')} />
        ) : (
          <MessageList
            messages={messages}
            generating={generating}
            loadingModel={phase === 'loading'}
          />
        )}
        <ModelPicker
          models={installed}
          selectedId={selectedId}
          disabled={generating}
          onSelect={id => {
            select(id);
          }}
          onManageModels={() => navigation.navigate('Models')}
        />
        <Composer
          generating={generating}
          hasModel={Boolean(selectedModel)}
          onSend={sendMessage}
          onStop={stopGeneration}
        />
        <ChatSidebar
          visible={sidebarOpen}
          chats={savedChats}
          activeId={activeId}
          modelName={selectedModel?.name}
          onClose={closeSidebar}
          onNewChat={() => {
            newChat().catch(() => undefined);
            closeSidebar();
          }}
          onOpenChat={id => {
            openChat(id).catch(() => undefined);
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
                    deleteChat(id).catch(() => undefined);
                  },
                },
              ],
            );
          }}
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
