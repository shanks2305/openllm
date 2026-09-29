import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
} from '@react-native-documents/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../theme';
import { IconButton } from '../components/ui/IconButton';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useModels } from '../hooks/useModels';
import { getCatalogModel } from '../model/catalog';
import { formatBytes } from '../model/modelStorage';
import type { InstalledModel, ModelSource } from '../model/types';

type AddStep = 'chooser' | 'catalog' | 'url' | 'import';

function sourceLabel(source: ModelSource) {
  if (source === 'catalog') {
    return 'Recommended';
  }

  if (source === 'url') {
    return 'Download link';
  }

  return 'Imported';
}

function progressLabel(bytesWritten: number, contentLength: number) {
  if (!contentLength) {
    return formatBytes(bytesWritten);
  }

  const percent = Math.min(
    100,
    Math.round((bytesWritten / contentLength) * 100),
  );
  return `${percent}% · ${formatBytes(bytesWritten)}`;
}

const ModelsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [addStep, setAddStep] = useState<AddStep | null>(null);
  const [url, setUrl] = useState('');
  const {
    catalog,
    installed,
    selectedId,
    downloads,
    importing,
    busy,
    error,
    downloadCatalog,
    downloadFromUrl,
    importFromLocalPath,
    select,
    remove,
    cancelDownload,
  } = useModels();

  const closeAdd = () => {
    setAddStep(null);
    setUrl('');
  };

  const confirmRemove = (model: InstalledModel) => {
    Alert.alert(
      'Delete model?',
      `${model.name} will be removed from this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void remove(model.id);
          },
        },
      ],
    );
  };

  const importModel = async () => {
    try {
      const [file] = await pick({
        allowMultiSelection: false,
        type: ['public.item', '*/*'],
      });

      if (!file) {
        return;
      }

      const fileName = file.name ?? 'model.gguf';

      if (!fileName.toLowerCase().endsWith('.gguf')) {
        Alert.alert('Unsupported file', 'Please choose a .gguf model file.');
        return;
      }

      const [copy] = await keepLocalCopy({
        files: [
          {
            uri: file.uri,
            fileName,
          },
        ],
        destination: 'documentDirectory',
      });

      if (copy.status !== 'success') {
        throw new Error(copy.copyError || 'Could not copy that file');
      }

      const ok = await importFromLocalPath(copy.localUri, fileName);

      if (ok) {
        closeAdd();
      }
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }

      Alert.alert(
        'Import failed',
        err instanceof Error ? err.message : 'Could not import that model',
      );
    }
  };

  const startCatalogDownload = (id: string) => {
    void downloadCatalog(id);
    closeAdd();
  };

  const startUrlDownload = () => {
    const trimmed = url.trim();

    if (!trimmed) {
      return;
    }

    void downloadFromUrl(trimmed);
    closeAdd();
  };

  const pendingDownloads = Object.entries(downloads).filter(
    ([id]) => !installed.some(model => model.id === id),
  );

  return (
    <View style={styles.flex}>
      <ScreenHeader
        title="Models"
        onBack={() => navigation.goBack()}
        right={
          <IconButton
            label="+"
            accessibilityLabel="Add a model"
            onPress={() => setAddStep('chooser')}
          />
        }
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 88 },
        ]}>
        <Text style={styles.section}>Downloaded</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {installed.length === 0 && pendingDownloads.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No models yet</Text>
            <Text style={styles.hint}>
              Add a recommended model, paste a download link, or import a .gguf
              file from this device.
            </Text>
          </View>
        ) : null}

        {pendingDownloads.map(([id, download]) => (
          <View key={id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {getCatalogModel(id)?.name ?? id}
            </Text>
            <Text style={styles.progress}>
              Downloading ·{' '}
              {progressLabel(download.bytesWritten, download.contentLength)}
            </Text>
            <Pressable
              onPress={() => cancelDownload(id)}
              style={styles.actionButton}>
              <Text style={styles.dangerLabel}>Cancel</Text>
            </Pressable>
          </View>
        ))}

        {installed.map(model => {
          const download = downloads[model.id];

          return (
            <View key={model.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{model.name}</Text>
                {selectedId === model.id ? (
                  <Text style={styles.badge}>Selected</Text>
                ) : null}
              </View>
              <Text style={styles.meta}>
                {sourceLabel(model.source)} · {formatBytes(model.bytes)}
              </Text>
              {download ? (
                <>
                  <Text style={styles.progress}>
                    {progressLabel(
                      download.bytesWritten,
                      download.contentLength,
                    )}
                  </Text>
                  <Pressable
                    onPress={() => cancelDownload(model.id)}
                    style={styles.actionButton}>
                    <Text style={styles.dangerLabel}>Cancel</Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.actions}>
                  {selectedId === model.id ? null : (
                    <Pressable
                      onPress={() => {
                        void select(model.id);
                      }}
                      style={styles.actionButton}>
                      <Text style={styles.actionLabel}>Select</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => confirmRemove(model)}
                    style={styles.actionButton}>
                    <Text style={styles.dangerLabel}>Delete</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a model"
          onPress={() => setAddStep('chooser')}
          style={({ pressed }) => [
            styles.addButton,
            { opacity: pressed ? 0.8 : 1 },
          ]}>
          <Text style={styles.addButtonLabel}>Add model</Text>
        </Pressable>
      </View>

      <Modal
        visible={addStep !== null}
        animationType="slide"
        transparent
        onRequestClose={closeAdd}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalDismiss} onPress={closeAdd} />
          <View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + spacing.md },
            ]}>
            <View style={styles.sheetHandle} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}>
              {addStep === 'chooser' ? (
              <>
                <Text style={styles.sheetTitle}>Add a model</Text>
                <Text style={styles.hint}>
                  Choose how you want to add a GGUF model. It will show up in
                  Downloaded on this page.
                </Text>
                <AddMethodButton
                  title="Recommended"
                  subtitle="Download a model we suggest for this app"
                  onPress={() => setAddStep('catalog')}
                />
                <AddMethodButton
                  title="Download from URL"
                  subtitle="Paste a direct HTTPS link to a .gguf file"
                  onPress={() => setAddStep('url')}
                />
                <AddMethodButton
                  title="Import file"
                  subtitle="Pick a .gguf already saved on this device"
                  onPress={() => setAddStep('import')}
                />
              </>
            ) : null}

            {addStep === 'catalog' ? (
              <>
                <SheetBack
                  title="Recommended"
                  onBack={() => setAddStep('chooser')}
                />
                <Text style={styles.hint}>
                  These are smaller instruction models that run on-device. Tap
                  Download and return here — progress and the finished file
                  appear in Downloaded.
                </Text>
                {catalog.map(model => {
                  const installedModel = installed.find(
                    item => item.id === model.id,
                  );
                  const download = downloads[model.id];

                  return (
                    <View key={model.id} style={styles.card}>
                      <Text style={styles.cardTitle}>{model.name}</Text>
                      <Text style={styles.meta}>
                        {model.quant} · {formatBytes(model.sizeBytes)}
                      </Text>
                      <Text style={styles.hint}>{model.description}</Text>
                      {download ? (
                        <Text style={styles.progress}>
                          {progressLabel(
                            download.bytesWritten,
                            download.contentLength,
                          )}
                        </Text>
                      ) : installedModel ? (
                        <Text style={styles.badge}>Already downloaded</Text>
                      ) : (
                        <Pressable
                          onPress={() => startCatalogDownload(model.id)}
                          style={styles.primaryButton}>
                          <Text style={styles.primaryLabel}>Download</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </>
            ) : null}

            {addStep === 'url' ? (
              <>
                <SheetBack
                  title="Download from URL"
                  onBack={() => setAddStep('chooser')}
                />
                <Text style={styles.hint}>
                  Use a direct HTTPS link that ends in .gguf, for example a
                  Hugging Face resolve URL. HTTP links are not supported. After
                  you start the download, watch progress in Downloaded.
                </Text>
                <TextInput
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://example.com/model.gguf"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={startUrlDownload}
                  disabled={busy || url.trim().length === 0}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (busy || url.trim().length === 0) && styles.buttonDisabled,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}>
                  <Text style={styles.primaryLabel}>Download</Text>
                </Pressable>
              </>
            ) : null}

            {addStep === 'import' ? (
              <>
                <SheetBack
                  title="Import file"
                  onBack={() => setAddStep('chooser')}
                />
                <Text style={styles.hint}>
                  Choose a .gguf file from Files or another app. It is copied
                  into llmOS so chat can load it even if the original is moved.
                  Only GGUF weights work.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void importModel();
                  }}
                  disabled={importing}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { opacity: pressed || importing ? 0.75 : 1 },
                  ]}>
                  {importing ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <Text style={styles.primaryLabel}>Choose .gguf file</Text>
                  )}
                </Pressable>
              </>
            ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

function AddMethodButton({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.methodRow, { opacity: pressed ? 0.75 : 1 }]}>
      <View style={styles.rowText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.hint}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function SheetBack({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.sheetHeader}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Text style={styles.actionLabel}>Back</Text>
      </Pressable>
      <Text style={styles.sheetTitle}>{title}</Text>
      <View style={styles.sheetHeaderSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  section: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.body,
    flex: 1,
    fontWeight: '600',
  },
  badge: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  meta: {
    ...typography.caption,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  progress: {
    ...typography.caption,
    color: colors.accent,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  actionLabel: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
  dangerLabel: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '600',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
  },
  addButtonLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: '88%',
  },
  sheetContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    ...typography.body,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  sheetHeaderSpacer: {
    width: 40,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  rowText: {
    flex: 1,
    marginRight: spacing.sm,
    gap: 4,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 22,
    lineHeight: 24,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  primaryLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});

export default ModelsScreen;
