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
import { artifactKind, canOpenArtifact } from '../../chat/artifacts';
import { highlightCode } from '../../chat/highlight';
import {
  parseMarkdown,
  type MarkdownBlock,
  type MarkdownSpan,
} from '../../chat/markdown';

type MarkdownBodyProps = {
  content: string;
  onOpenCode?: (code: string) => void;
};

type TableBlock = Extract<MarkdownBlock, { type: 'table' }>;

function spanLength(spans: MarkdownSpan[]) {
  return spans.reduce((total, span) => total + span.text.length, 0);
}

function columnWidths(block: TableBlock) {
  return block.header.map((cell, column) => {
    const longest = Math.max(
      spanLength(cell),
      ...block.rows.map(row => spanLength(row[column] ?? [])),
    );
    return Math.min(240, Math.max(72, longest * 8 + spacing.md));
  });
}

function Table({ block }: { block: TableBlock }) {
  const widths = columnWidths(block);
  const align = (column: number) =>
    block.align[column] === 'right'
      ? styles.alignRight
      : block.align[column] === 'center'
      ? styles.alignCenter
      : null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tableScroll}
    >
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          {block.header.map((cell, column) => (
            <View key={column} style={[styles.cell, { width: widths[column] }]}>
              <Text selectable style={[styles.cellText, styles.bold, align(column)]}>
                {renderSpans(cell)}
              </Text>
            </View>
          ))}
        </View>
        {block.rows.map((row, rowIndex) => (
          <View
            key={rowIndex}
            style={[
              styles.tableRow,
              rowIndex === block.rows.length - 1 && styles.tableRowLast,
            ]}
          >
            {row.map((cell, column) => (
              <View key={column} style={[styles.cell, { width: widths[column] }]}>
                <Text selectable style={[styles.cellText, align(column)]}>
                  {renderSpans(cell)}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function MarkdownBody({ content, onOpenCode }: MarkdownBodyProps) {
  const blocks = parseMarkdown(content);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <View style={styles.stack}>
      {blocks.map((block, index) => {
        if (block.type === 'table') {
          return <Table key={`t-${index}`} block={block} />;
        }

        if (block.type === 'math') {
          return (
            <ScrollView
              key={`m-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mathBlock}
            >
              <Text selectable style={styles.mathBlockText}>
                {block.value}
              </Text>
            </ScrollView>
          );
        }

        if (block.type === 'code') {
          return (
            <View key={`code-${index}`} style={styles.codeBlock}>
              <View style={styles.codeHeader}>
                <Text style={styles.codeLanguage}>
                  {block.language || 'code'}
                </Text>
                <View style={styles.codeActions}>
                  {onOpenCode && canOpenArtifact(block.language, block.value) ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        artifactKind(block.language, block.value) === 'code'
                          ? 'Open code in panel'
                          : 'Preview'
                      }
                      hitSlop={6}
                      onPress={() => onOpenCode(block.value)}
                    >
                      <Text style={styles.copy}>
                        {artifactKind(block.language, block.value) === 'code'
                          ? 'Open'
                          : 'Preview'}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Copy code"
                    hitSlop={6}
                    onPress={() => {
                      Clipboard.setString(block.value);
                    }}
                  >
                    <Text style={styles.copy}>Copy</Text>
                  </Pressable>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.codeScroll}
              >
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
                <View
                  key={itemIndex}
                  style={[
                    styles.listRow,
                    {
                      marginLeft: (block.depths?.[itemIndex] ?? 0) * spacing.md,
                    },
                  ]}
                >
                  <Text style={styles.marker}>
                    {block.markers?.[itemIndex] ??
                      (block.ordered ? `${itemIndex + 1}.` : '•')}
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

    if (span.type === 'strike') {
      return (
        <Text key={index} style={styles.strike}>
          {span.text}
        </Text>
      );
    }

    if (span.type === 'math') {
      return (
        <Text key={index} style={styles.math}>
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
    gap: spacing.sm + 4,
  },
  body: {
    ...typography.body,
    flex: 1,
    lineHeight: 25,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  strike: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  math: {
    fontFamily: Platform.select({ ios: 'Times New Roman', default: 'serif' }),
    fontStyle: 'italic',
    fontSize: 17,
  },
  mathBlock: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  mathBlockText: {
    fontFamily: Platform.select({ ios: 'Times New Roman', default: 'serif' }),
    fontStyle: 'italic',
    fontSize: 19,
    lineHeight: 28,
    color: colors.text,
    textAlign: 'center',
  },
  tableScroll: {
    flexGrow: 0,
  },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: colors.surface,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  cell: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  cellText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  alignRight: {
    textAlign: 'right',
  },
  alignCenter: {
    textAlign: 'center',
  },
  inlineCode: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 14,
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
    lineHeight: 25,
    color: colors.textSecondary,
    minWidth: 18,
  },
  codeBlock: {
    backgroundColor: colors.codeBackground,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md - 4,
    paddingVertical: spacing.xs + 2,
  },
  codeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  codeLanguage: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
  },
  copy: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  codeScroll: {
    padding: spacing.md - 4,
  },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm + 4,
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

export const codeStyles = StyleSheet.create({
  plain: {},
  keyword: { color: '#C4A7FF' },
  string: { color: '#9FD89A' },
  comment: { color: colors.textMuted, fontStyle: 'italic' },
  number: { color: '#F5B97A' },
});
