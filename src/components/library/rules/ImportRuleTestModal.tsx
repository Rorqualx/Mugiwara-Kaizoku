import React, { useState } from 'react';

import { Modal, Stack, TextInput, Button, Group, Card, Text, Badge, Alert, Code, JsonInput, Divider, Box, ScrollArea, ActionIcon } from '@mantine/core';
import { IconCheck, IconX, IconAlertCircle, IconDownload } from '@tabler/icons-react';

import { ImportRuleEngine } from '@/server/services/library/importRuleEngine';
import type { ImportRule, ImportContext, ParsedFileInfo, RuleTestResult } from '@/types/import-rules';
import { MangaFileParser } from '@/utils/parsers/mangaFileParser';
interface ImportRuleTestModalProps {
    opened: boolean;
    onClose: () => void;
    rule: ImportRule;
}
export function ImportRuleTestModal({ opened, onClose, rule }: ImportRuleTestModalProps): React.ReactElement {
    const [testFilenames, setTestFilenames] = useState<string[]>([
        '[HorribleSubs] One Piece - Chapter 1100 [1080p].cbz',
        'Naruto_v01_c001.zip',
        'Bleach Chapter 686.pdf',
        '/manga/shounen/My Hero Academia/Chapter 380.cbr'
    ]);
    const [customFilename, setCustomFilename] = useState('');
    const [testContext, setTestContext] = useState<ImportContext>({
        availableLibraries: [
            { id: 1, name: 'Main Library', path: '/manga' },
            { id: 2, name: 'Shounen', path: '/manga/shounen' }
        ],
        existingManga: [
            { id: 1, title: 'One Piece', path: '/manga/One Piece' },
            { id: 2, title: 'Naruto', path: '/manga/Naruto' }
        ],
        metadataProviders: ['anilist', 'mangadex', 'comicvine', 'fandom'],
        defaultLibraryId: 1
    });
    const [testResults, setTestResults] = useState<Array<{
        filename: string;
        result: RuleTestResult;
        fileInfo: ParsedFileInfo;
    }>>([]);
    const handleAddCustomFile = (): void => {
        if (customFilename && !testFilenames.includes(customFilename)) {
            setTestFilenames([...testFilenames, customFilename]);
            setCustomFilename('');
        }
    };
    const handleRemoveFile = (filename: string): void => {
        setTestFilenames(testFilenames.filter((f) => f !== filename));
    };
    const handleRunTests = (): void => {
        const engine = new ImportRuleEngine([rule]);
        const results: typeof testResults = [];
        for (const filename of testFilenames) {
            const parsed = MangaFileParser.parse(filename);
            const fileInfo: ParsedFileInfo = {
                path: filename,
                filename: filename.split('/').pop() ?? filename,
                size: Math.floor(Math.random() * 100000000), // Mock file size
                title: parsed.cleanTitle,
                chapters: [],
                // Only set optional fields if they have values
                ...(parsed.volume !== undefined && { volume: parsed.volume }),
                ...(parsed.chapter !== undefined && { chapter: parsed.chapter }),
                ...(parsed.year !== undefined && { year: parsed.year }),
                ...(parsed.group !== undefined && { group: parsed.group }),
                ...(parsed.publisher !== undefined && { publisher: parsed.publisher }),
            };
            const result = engine.testRule(rule, fileInfo, testContext);
            results.push({ filename, result, fileInfo });
        }
        setTestResults(results);
    };
    const getConditionIcon = (result: boolean): React.ReactElement => {
        return result ?
            <IconCheck size={16} color="green"/> :
            <IconX size={16} color="red"/>;
    };
    const renderTestResult = (test: typeof testResults[0]): React.ReactElement => {
        const { filename, result, fileInfo } = test;
        return (<Card key={filename} withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={500} size="sm">{filename}</Text>
            <Badge color={result.matched ? 'green' : 'gray'} variant="light" leftSection={result.matched ? <IconCheck size={14}/> : <IconX size={14}/>}>

              {result.matched ? 'Matched' : 'Not Matched'}
            </Badge>
          </Group>

          <Box>
            <Text size="xs" fw={500} mb={5}>Parsed Info:</Text>
            <Group gap="xs">
              <Badge size="xs" variant="light">Title: {fileInfo["title"]}</Badge>
              {fileInfo.volume !== undefined && <Badge size="xs" variant="light">Vol: {fileInfo.volume}</Badge>}
              {fileInfo.chapter !== undefined && <Badge size="xs" variant="light">Ch: {fileInfo.chapter}</Badge>}
              {fileInfo.year !== undefined && <Badge size="xs" variant="light">Year: {fileInfo.year}</Badge>}
              {fileInfo.group && <Badge size="xs" variant="light">Group: {fileInfo.group}</Badge>}
              {fileInfo.publisher && <Badge size="xs" variant="light">Publisher: {fileInfo.publisher}</Badge>}
              {fileInfo.language && <Badge size="xs" variant="light">Lang: {fileInfo.language}</Badge>}
            </Group>
          </Box>

          <Box>
            <Text size="xs" fw={500} mb={5}>Condition Results:</Text>
            <Stack gap={4}>
              {result.conditions.map((cond, index) => <Group key={index} gap="xs">
                  {getConditionIcon(cond.result)}
                  <Text size="xs" c={cond.result ? 'green' : 'red'}>
                    {cond.condition.type} {cond.condition.operator} {String(cond.condition.value)}
                    {cond.reason && ` - ${cond.reason}`}
                  </Text>
                </Group>)}
            </Stack>
          </Box>

          {result.matched && Object.keys(result.actions).length > 0 &&
                <Box>
              <Text size="xs" fw={500} mb={5}>Applied Actions:</Text>
              <Code block>
                {JSON.stringify(result.actions, null, 2)}
              </Code>
            </Box>}
        </Stack>
      </Card>);
    };
    return (<Modal opened={opened} onClose={onClose} size="xl" title={`Test Rule: ${rule["name"]}`}>

      <Stack>
        <Alert icon={<IconAlertCircle />} color="blue">
          <Text size="sm">
            Test how this rule matches against sample filenames and see what actions would be applied.
          </Text>
        </Alert>

        <Box>
          <Text size="sm" fw={500} mb="xs">Test Files</Text>
          <Stack gap="xs">
            {testFilenames.map((filename) => <Group key={filename} gap="xs">
                <Text size="sm" style={{ flex: 1 }}>{filename}</Text>
                <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleRemoveFile(filename)}>

                  <IconX size={16}/>
                </ActionIcon>
              </Group>)}
          </Stack>
          
          <Group mt="sm">
            <TextInput placeholder="Add custom filename to test..." value={customFilename} onChange={(e) => setCustomFilename(e.currentTarget.value)} style={{ flex: 1 }} onKeyDown={(e) => {
            if (e.key === 'Enter') {
                handleAddCustomFile();
            }
        }}/>

            <Button onClick={handleAddCustomFile} disabled={!customFilename}>
              Add
            </Button>
          </Group>
        </Box>

        <Box>
          <Text size="sm" fw={500} mb="xs">Test Context</Text>
          <JsonInput value={JSON.stringify(testContext, null, 2)} onChange={(value) => {
            try {
                const parsed = JSON.parse(value) as unknown;
                if (isValidImportContext(parsed)) {
                    setTestContext(parsed);
                }
            }
            catch (_e: unknown) { /* empty */ }
        }} autosize minRows={4} maxRows={8}/>

        </Box>

        <Button leftSection={<IconDownload size={18}/>} onClick={handleRunTests} disabled={testFilenames.length === 0}>

          Run Tests
        </Button>

        {testResults.length > 0 &&
            <>
            <Divider label="Test Results"/>
            
            <Group gap="xs">
              <Badge color="green" variant="light">
                Matched: {testResults.filter((r) => r.result.matched).length}
              </Badge>
              <Badge color="gray" variant="light">
                Not Matched: {testResults.filter((r) => !r.result.matched).length}
              </Badge>
            </Group>

            <ScrollArea h={300}>
              <Stack gap="sm">
                {testResults.map((result) => renderTestResult(result))}
              </Stack>
            </ScrollArea>
          </>}

        <Divider />

        <Group justify="right">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>);
}

/**
 * Type guard to validate if an unknown value matches ImportContext
 */
function isValidImportContext(value: unknown): value is ImportContext {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const context = value as Record<string, unknown>;

  return (
    isValidLibrariesArray(context['availableLibraries']) &&
    isValidMangaArray(context['existingManga']) &&
    isValidProvidersArray(context['metadataProviders']) &&
    isValidDefaultLibraryId(context['defaultLibraryId'])
  );
}

function isValidLibrariesArray(libraries: unknown): libraries is Array<{ id: number; name: string; path: string }> {
  if (!Array.isArray(libraries)) {
    return false;
  }

  return libraries.every(lib =>
    typeof lib === 'object' &&
    lib !== null &&
    typeof (lib as Record<string, unknown>)['id'] === 'number' &&
    typeof (lib as Record<string, unknown>)['name'] === 'string' &&
    typeof (lib as Record<string, unknown>)['path'] === 'string'
  );
}

function isValidMangaArray(mangaArray: unknown): mangaArray is Array<{ id: number; title: string; path: string }> {
  if (!Array.isArray(mangaArray)) {
    return false;
  }

  return mangaArray.every(manga =>
    typeof manga === 'object' &&
    manga !== null &&
    typeof (manga as Record<string, unknown>)['id'] === 'number' &&
    typeof (manga as Record<string, unknown>)['title'] === 'string' &&
    typeof (manga as Record<string, unknown>)['path'] === 'string'
  );
}

function isValidProvidersArray(providers: unknown): providers is string[] {
  return Array.isArray(providers) && providers.every(provider => typeof provider === 'string');
}

function isValidDefaultLibraryId(defaultLibraryId: unknown): boolean {
  return defaultLibraryId === undefined || typeof defaultLibraryId === 'number';
}
