import React from 'react';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import ChatScreen from '../screens/ChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ModelsScreen from '../screens/ModelsScreen';
import MemoryScreen from '../screens/MemoryScreen';
import { colors } from '../theme';

export type RootStackParamList = {
  Chat: undefined;
  Settings: undefined;
  Models: undefined;
  Memory: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions: NativeStackNavigationOptions = {
  contentStyle: {
    backgroundColor: colors.background,
  },
  headerShown: false,
};

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Chat" screenOptions={screenOptions}>
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Local LLM' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Models" component={ModelsScreen} options={{ title: 'Models' }} />
      <Stack.Screen name="Memory" component={MemoryScreen} options={{ title: 'Memory' }} />
    </Stack.Navigator>
  );
}
