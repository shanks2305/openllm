import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useModels } from '../hooks/useModels';
import { useSettings } from '../hooks/useSettings';
import { MAX_TOKEN_OPTIONS } from '../settings/settingsStore';

type SettingsNav = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

const SettingsScreen = () => {
  const navigation = useNavigation<SettingsNav>();
  const insets = useSafeAreaInsets();
  const { selectedModel } = useModels();
  const {
    temperature,
    maxTokens,
    systemPrompt,
    setTemperature,
    setMaxTokens,
    setSystemPrompt,
  } = useSettings();

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Settings" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + spacing.lg },
          ]}>
          <Text style={styles.section}>General</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open models"
            onPress={() => navigation.navigate('Models')}
            style={({ pressed }) => [
              styles.row,
              { opacity: pressed ? 0.75 : 1 },
            ]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Models</Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {selectedModel?.name ?? 'Download, import, or select a model'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <Text style={styles.section}>Generation</Text>
          <View style={styles.card}>
            <Text style={styles.rowTitle}>Temperature</Text>
            <Text style={styles.rowSubtitle}>
              Lower answers stay closer to the prompt. Higher answers vary more.
            </Text>
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease temperature"
                onPress={() => setTemperature(temperature - 0.1)}
                style={styles.stepButton}>
                <Text style={styles.stepLabel}>−</Text>
              </Pressable>
              <Text style={styles.stepValue}>{temperature.toFixed(1)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase temperature"
                onPress={() => setTemperature(temperature + 0.1)}
                style={styles.stepButton}>
                <Text style={styles.stepLabel}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.rowTitle}>Response length</Text>
            <Text style={styles.rowSubtitle}>
              Maximum new tokens for each reply.
            </Text>
            <View style={styles.chips}>
              {MAX_TOKEN_OPTIONS.map(option => {
                const selected = option === maxTokens;

                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setMaxTokens(option)}
                    style={[styles.chip, selected && styles.chipSelected]}>
                    <Text
                      style={[
                        styles.chipLabel,
                        selected && styles.chipLabelSelected,
                      ]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.rowTitle}>System prompt</Text>
            <Text style={styles.rowSubtitle}>
              Optional instructions included with every reply.
            </Text>
            <TextInput
              value={systemPrompt}
              onChangeText={setSystemPrompt}
              placeholder="You are a helpful assistant."
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.input}
            />
          </View>
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
  section: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  rowSubtitle: {
    ...typography.caption,
    marginTop: 4,
    lineHeight: 18,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 22,
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  stepLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  stepValue: {
    ...typography.body,
    minWidth: 36,
    textAlign: 'center',
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipLabel: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: colors.text,
  },
  input: {
    ...typography.body,
    minHeight: 88,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});

export default SettingsScreen;
