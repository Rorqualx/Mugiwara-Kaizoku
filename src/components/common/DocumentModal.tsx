/**
 * Document Modal Component
 *
 * A modal for displaying markdown documentation files from the docs/ directory.
 * Provides a simple, readable interface for viewing documentation without
 * leaving the application.
 *
 * Features:
 * - Fetches and displays markdown files
 * - Code block syntax highlighting
 * - Responsive layout
 * - Copy code button for code blocks
 */

import React, { useState, useEffect } from 'react';

import {
  Modal,
  Stack,
  ScrollArea,
  Text,
  Code,
  Title,
  Alert,
  Loader,
  Box,
  Paper,
  List
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface DocumentModalProps {
  opened: boolean;
  onClose: () => void;
  documentPath: string;
  title?: string;
}

/**
 * Simple markdown parser for basic formatting
 * Handles: headers, code blocks, lists, bold, italic, links, inline code
 */
function parseMarkdown(markdown: string): React.ReactNode {
  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let listItems: string[] = [];
  let inList = false;

  const flushList = (): void => {
    if (listItems.length > 0) {
      elements.push(
        <List key={`list-${elements.length}`} spacing="xs" size="sm" mb="md">
          {listItems.map((item, idx) => (
            <List.Item key={idx}>{parseInline(item)}</List.Item>
          ))}
        </List>
      );
      listItems = [];
      inList = false;
    }
  };

  const parseInline = (text: string): React.ReactNode => {
    // Parse inline code first to avoid conflicts
    const parts: React.ReactNode[] = [];
    const remaining = text;
    let key = 0;

    // Inline code: `code`
    const codeRegex = /`([^`]+)`/g;
    let match;
    let lastIndex = 0;

    while ((match = codeRegex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(remaining.slice(lastIndex, match.index));
      }
      // Add code
      parts.push(<Code key={`code-${key++}`}>{match[1]}</Code>);
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  lines.forEach((line, index) => {
    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <Paper key={`code-${index}`} p="md" mb="md" withBorder style={{ backgroundColor: '#1e1e1e' }}>
            <Code block style={{ backgroundColor: 'transparent', color: '#d4d4d4' }}>
              {codeBlockContent.join('\n')}
            </Code>
          </Paper>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        // Start code block
        flushList();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    // Handle headers
    if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <Title key={`h1-${index}`} order={1} mb="md" mt="xl">
          {line.slice(2)}
        </Title>
      );
      return;
    }
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <Title key={`h2-${index}`} order={2} mb="md" mt="lg">
          {line.slice(3)}
        </Title>
      );
      return;
    }
    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <Title key={`h3-${index}`} order={3} mb="sm" mt="md">
          {line.slice(4)}
        </Title>
      );
      return;
    }
    if (line.startsWith('#### ')) {
      flushList();
      elements.push(
        <Title key={`h4-${index}`} order={4} mb="sm" mt="md">
          {line.slice(5)}
        </Title>
      );
      return;
    }

    // Handle lists
    if (line.match(/^[-*]\s+/) ?? line.match(/^\d+\.\s+/)) {
      const itemText = line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
      listItems.push(itemText);
      inList = true;
      return;
    } else if (inList && line.trim() !== '') {
      // Continuation of list item
      listItems[listItems.length - 1] += ' ' + line.trim();
      return;
    } else if (inList && line.trim() === '') {
      flushList();
      return;
    }

    // Handle empty lines
    if (line.trim() === '') {
      flushList();
      return;
    }

    // Handle regular paragraphs
    flushList();
    elements.push(
      <Text key={`p-${index}`} mb="md" size="sm">
        {parseInline(line)}
      </Text>
    );
  });

  // Flush any remaining list
  flushList();

  return elements;
}

/**
 * Document Modal Component
 */
export function DocumentModal({
  opened,
  onClose,
  documentPath,
  title
}: DocumentModalProps): React.ReactElement {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened && documentPath) {
      setLoading(true);
      setError(null);

      // Fetch the document from the public docs endpoint
      fetch(`/docs/${documentPath}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch document: ${response.statusText}`);
          }
          const text = await response.text();
          setContent(text);
          setLoading(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        });
    }
  }, [opened, documentPath]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title ?? 'Documentation'}
      size="xl"
      styles={{
        body: { height: '70vh' }
      }}
    >
      <ScrollArea style={{ height: '100%' }} type="auto">
        <Stack gap="md">
          {loading && (
            <Box style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader size="md" />
            </Box>
          )}

          {error && (
            <Alert icon={<IconAlertCircle />} color="red" variant="light">
              <Text size="sm">Failed to load document: {error}</Text>
            </Alert>
          )}

          {!loading && !error && content && (
            <Box>{parseMarkdown(content)}</Box>
          )}
        </Stack>
      </ScrollArea>
    </Modal>
  );
}
