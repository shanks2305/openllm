import { useEffect, useState } from 'react';
import {
  Clipboard,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { previewHtml } from '../../chat/artifacts';
import type { Artifact } from '../../chat/artifacts';
import { highlightCode } from '../../chat/highlight';
import { hapticTap } from '../../haptics';
import { colors, radii, spacing, typography } from '../../theme';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { codeStyles } from './MarkdownBody';

type ArtifactSheetProps = {
  artifacts: Artifact[];
  index: number | null;
  onChangeIndex: (index: number) => void;
  onClose: () => void;
};

type Tab = 'preview' | 'code';

export function ArtifactSheet({
  artifacts,
  index,
  onChangeIndex,
  onClose,
}: ArtifactSheetProps) {
  const insets = useSafeAreaInsets();
  const artifact = index != null ? artifacts[index] ?? null : null;
  const previewable = artifact != null && artifact.kind !== 'code';
  const [tab, setTab] = useState<Tab>('preview');
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setTab(previewable ? 'preview' : 'code');
    setCopied(false);
  }, [artifact?.id, previewable]);

  const copy = () => {
    if (!artifact) {
      return;
    }

    hapticTap();
    Clipboard.setString(artifact.code);
    setCopied(true);
  };

  const step = (delta: number) => {
    if (index == null) {
      return;
    }

    const next = index + delta;

    if (next >= 0 && next < artifacts.length) {
      hapticTap();
      onChangeIndex(next);
    }
  };

  return (
    <Modal
      visible={artifact != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {artifact ? (
        <View style={styles.sheet}>
          <View style={styles.header}>
            <IconButton
              icon="close"
              size={36}
              iconSize={16}
              accessibilityLabel="Close"
              onPress={onClose}
            />
            <View style={styles.titleWrap}>
              <Text style={styles.title} numberOfLines={1}>
                {artifact.title}
              </Text>
              {artifacts.length > 1 ? (
                <View style={styles.pager}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Previous artifact"
                    disabled={index === 0}
                    hitSlop={8}
                    onPress={() => step(-1)}
                    style={index === 0 && styles.dim}
                  >
                    <Text style={styles.pagerArrow}>‹</Text>
                  </Pressable>
                  <Text style={styles.pagerLabel}>
                    {(index ?? 0) + 1} of {artifacts.length}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Next artifact"
                    disabled={index === artifacts.length - 1}
                    hitSlop={8}
                    onPress={() => step(1)}
                    style={index === artifacts.length - 1 && styles.dim}
                  >
                    <Text style={styles.pagerArrow}>›</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
            <IconButton
              icon={copied ? 'check' : 'copy'}
              size={36}
              iconSize={16}
              accessibilityLabel={copied ? 'Copied' : 'Copy code'}
              onPress={copy}
            />
            <IconButton
              icon="share"
              size={36}
              iconSize={16}
              accessibilityLabel="Share code"
              onPress={() => {
                Share.share({ message: artifact.code }).catch(() => undefined);
              }}
            />
          </View>

          {previewable ? (
            <View style={styles.tabs}>
              {(['preview', 'code'] as const).map(item => (
                <Pressable
                  key={item}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === item }}
                  onPress={() => setTab(item)}
                  style={[styles.tab, tab === item && styles.tabActive]}
                >
                  <Text
                    style={[styles.tabLabel, tab === item && styles.tabLabelActive]}
                  >
                    {item === 'preview' ? 'Preview' : 'Code'}
                  </Text>
                </Pressable>
              ))}
              {tab === 'preview' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Reload preview"
                  onPress={() => setReloadKey(key => key + 1)}
                  style={styles.reload}
                  hitSlop={8}
                >
                  <Icon name="refresh" size={16} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {tab === 'preview' && previewable ? (
            <View style={[styles.preview, { marginBottom: insets.bottom }]}>
              <WebView
                key={`${artifact.id}-${reloadKey}`}
                originWhitelist={['about:*', 'data:*']}
                source={{ html: previewHtml(artifact), baseUrl: 'about:blank' }}
                onShouldStartLoadWithRequest={request =>
                  request.url.startsWith('about:') ||
                  request.url.startsWith('data:')
                }
                javaScriptCanOpenWindowsAutomatically={false}
                setSupportMultipleWindows={false}
                allowFileAccess={false}
                incognito
                dataDetectorTypes="none"
                style={styles.webview}
              />
              <Text style={styles.sandboxNote}>
                Runs offline in a sandbox. The page can't reach the internet.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.codeWrap}
              contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text selectable style={styles.code}>
                  {highlightCode(artifact.code, artifact.language).map(
                    (token, tokenIndex) => (
                      <Text key={tokenIndex} style={codeStyles[token.type]}>
                        {token.text}
                      </Text>
                    ),
                  )}
                </Text>
              </ScrollView>
            </ScrollView>
          )}
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...typography.body,
    fontWeight: '600',
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  pagerArrow: {
    ...typography.body,
    fontSize: 20,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  pagerLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  dim: {
    opacity: 0.3,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  tabActive: {
    backgroundColor: colors.surfaceElevated,
  },
  tabLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.text,
  },
  reload: {
    marginLeft: 'auto',
    padding: spacing.xs,
  },
  preview: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  sandboxNote: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  codeWrap: {
    flex: 1,
    backgroundColor: colors.codeBackground,
  },
  code: {
    fontFamily: 'Menlo',
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
    padding: spacing.md,
  },
});
