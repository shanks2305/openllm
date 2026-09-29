import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../theme';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { IconButton } from '../components/ui/IconButton';
import { useMemory } from '../hooks/useMemory';
import { MAX_MEMORY_ITEMS, MAX_MEMORY_LENGTH } from '../memory/memoryStore';

const MemoryScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { enabled, items, saveError, add, update, remove, clear, setEnabled } =
    useMemory();
  const [draft, setDraft] = useState('');
  const full = items.length >= MAX_MEMORY_ITEMS;

  const submit = () => {
    if (!draft.trim()) {
      return;
    }

    if (add(draft)) {
      setDraft('');
    } else if (full) {
      Alert.alert('Memory is full', `Delete something to add more than ${MAX_MEMORY_ITEMS} facts.`);
    } else {
      Alert.alert('Already saved', 'That fact is already in memory.');
    }
  };

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Memory" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <View style={[styles.card, styles.toggleRow]}>
            <View style={styles.flexText}>
              <Text style={styles.title}>Use memory</Text>
              <Text style={styles.subtitle}>
                Saved facts are added to every chat so the model knows them
                without being told again. They never leave this device.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ true: colors.accent, false: colors.surfacePressed }}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Add a fact</Text>
            <Text style={styles.subtitle}>
              For example “I live in Pune” or “Prefer TypeScript examples”. You
              can also long-press your own message and choose Remember, or turn
              on Tools and ask the model to remember something.
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Something the model should know about you"
              placeholderTextColor={colors.textMuted}
              maxLength={MAX_MEMORY_LENGTH}
              multiline
              editable={!full}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!draft.trim()}
              onPress={submit}
              style={({ pressed }) => [
                styles.button,
                !draft.trim() && styles.buttonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.buttonLabel}>Save to memory</Text>
            </Pressable>
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.section}>
              Saved · {items.length}/{MAX_MEMORY_ITEMS}
            </Text>
            {items.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() =>
                  Alert.alert('Clear memory?', 'Every saved fact is deleted.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear', style: 'destructive', onPress: clear },
                  ])
                }
              >
                <Text style={styles.clear}>Clear all</Text>
              </Pressable>
            ) : null}
          </View>
          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          {items.length === 0 ? (
            <Text style={styles.empty}>Nothing saved yet.</Text>
          ) : (
            items.map(item => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityHint="Tap to edit"
                onPress={() =>
                  Alert.prompt(
                    'Edit memory',
                    undefined,
                    text => update(item.id, text),
                    'plain-text',
                    item.text,
                  )
                }
                style={({ pressed }) => [
                  styles.card,
                  styles.item,
                  !enabled && styles.itemOff,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.itemText, styles.flexText]}>
                  {item.text}
                </Text>
                <IconButton
                  icon="close"
                  size={30}
                  iconSize={14}
                  color={colors.textMuted}
                  accessibilityLabel={`Forget ${item.text}`}
                  onPress={() => remove(item.id)}
                />
              </Pressable>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flexText: {
    flex: 1,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.caption,
    marginTop: 4,
    lineHeight: 18,
  },
  input: {
    ...typography.body,
    minHeight: 64,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.text,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonDisabled: {
    backgroundColor: colors.surfacePressed,
  },
  buttonLabel: {
    ...typography.caption,
    color: colors.onPrimary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  section: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  clear: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  empty: {
    ...typography.caption,
    color: colors.textMuted,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingRight: spacing.xs,
  },
  itemOff: {
    opacity: 0.5,
  },
  itemText: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 21,
  },
});

export default MemoryScreen;
