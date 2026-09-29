import {
  Clipboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import { highlightCode } from '../../chat/highlight';
import { parseMarkdown, type MarkdownSpan } from '../../chat/markdown';

type MarkdownBodyProps = {
  content: string;
};

export function MarkdownBody({ content }: MarkdownBodyProps) {
  const blocks = parseMarkdown(content);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <View style={styles.stack}>
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return (
            <View key={`code-${index}`} style={styles.codeBlock}>
              <View style={styles.codeHeader}>
                <Text style={styles.codeLanguage}>
                  {block.language || 'code'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Copy code"
                  onPress={() => {
                    Clipboard.setString(block.value);
                  }}
                >
                  <Text style={styles.copy}>Copy</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text selectable style={styles.code}>
                  {highlightCode(block.value, block.language).map(
                    (token, tokenIndex) => (
                      <Text key={tokenIndex} style={codeStyles[token.type]}>
                        {token.text}
                      </Text>
                    ),
                  )}
                </Text>
              </ScrollView>
            </View>
          );
        }

        if (block.type === 'heading') {
          return (
            <Text
              key={`h-${index}`}
              selectable
              accessibilityRole="header"
              style={[styles.body, headingStyles[block.level]]}
            >
              {renderSpans(block.spans)}
            </Text>
          );
        }

        if (block.type === 'quote') {
          return (
            <View key={`q-${index}`} style={styles.quote}>
              <Text selectable style={[styles.body, styles.quoteText]}>
                {renderSpans(block.spans)}
              </Text>
            </View>
          );
        }

        if (block.type === 'rule') {
          return <View key={`hr-${index}`} style={styles.rule} />;
        }

        if (block.type === 'list') {
          return (
            <View key={`list-${index}`} style={styles.list}>
              {block.items.map((item, itemIndex) => (
                <View key={itemIndex} style={styles.listRow}>
                  <Text style={styles.marker}>
                    {block.ordered ? `${itemIndex + 1}.` : '•'}
                  </Text>
                  <Text selectable style={styles.body}>
                    {renderSpans(item)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }

        return (
          <Text key={`p-${index}`} selectable style={styles.body}>
            {renderSpans(block.spans)}
          </Text>
        );
      })}
    </View>
  );
}

function renderSpans(spans: MarkdownSpan[]) {
  return spans.map((span, index) => {
    if (span.type === 'bold') {
      return (
        <Text key={index} style={styles.bold}>
          {span.text}
        </Text>
      );
    }

    if (span.type === 'italic') {
      return (
        <Text key={index} style={styles.italic}>
          {span.text}
        </Text>
      );
    }

    if (span.type === 'code') {
      return (
        <Text key={index} style={styles.inlineCode}>
          {span.text}
        </Text>
      );
    }

    if (span.type === 'link') {
      return (
        <Text
          key={index}
          style={styles.link}
          onPress={() => {
            Linking.openURL(span.url).catch(() => undefined);
          }}
        >
          {span.text}
        </Text>
      );
    }

    return <Text key={index}>{span.text}</Text>;
  });
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
  },
  body: {
    ...typography.body,
    flex: 1,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  inlineCode: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
  },
  link: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  list: {
    gap: spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  marker: {
    ...typography.body,
    lineHeight: 22,
    color: colors.textSecondary,
    minWidth: 18,
  },
  codeBlock: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeLanguage: {
    ...typography.caption,
    color: colors.textMuted,
  },
  copy: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accentMuted,
    paddingLeft: spacing.sm,
  },
  quoteText: {
    color: colors.textSecondary,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
});

const headingStyles = StyleSheet.create({
  1: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  2: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
  3: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
});

const codeStyles = StyleSheet.create({
  plain: {},
  keyword: { color: '#C4A7FF' },
  string: { color: '#9FD89A' },
  comment: { color: colors.textMuted, fontStyle: 'italic' },
  number: { color: '#F5B97A' },
});
