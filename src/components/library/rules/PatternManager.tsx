import React, { useState } from 'react';

import { Stack, Card, Text, Group, Button, Badge, ActionIcon, Tooltip, Code, ScrollArea, Alert, TextInput, Textarea, NumberInput, Select, Modal, Box, Divider, Collapse, Table } from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconTestPipe, IconChevronDown, IconChevronRight, IconAlertCircle, IconCheck, IconX } from '@tabler/icons-react';

import type { AdvancedPattern, PatternExtractor } from '@/types/import-rules';
export function PatternManager(): React.ReactElement {
    const [patterns, setPatterns] = useState<AdvancedPattern[]>([]);
    const [selectedPattern, setSelectedPattern] = useState<AdvancedPattern | null>(null);
    const [showEditor, setShowEditor] = useState(false);
    const [showTest, setShowTest] = useState(false);
    const [testPattern, setTestPattern] = useState<AdvancedPattern | null>(null);
    const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(new Set());
    // Initialize with default patterns
    useState(() => {
        // TODO: Implement AdvancedPatternMatcher
        // const matcher = new AdvancedPatternMatcher();
        // setPatterns(matcher.getPatterns());
        setPatterns([]);
    });
    const handleAddPattern = (): void => {
        setSelectedPattern(null);
        setShowEditor(true);
    };
    const handleEditPattern = (pattern: AdvancedPattern): void => {
        setSelectedPattern(pattern);
        setShowEditor(true);
    };
    const handleDeletePattern = (patternId: string): void => {
        setPatterns(patterns.filter((p) => p["id"] !== patternId));
    };
    const handleTestPattern = (pattern: AdvancedPattern): void => {
        setTestPattern(pattern);
        setShowTest(true);
    };
    const handleToggleExpanded = (patternId: string): void => {
        setExpandedPatterns((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(patternId)) {
                newSet.delete(patternId);
            }
            else {
                newSet.add(patternId);
            }
            return newSet;
        });
    };
    const renderPattern = (pattern: AdvancedPattern): JSX.Element => {
        const isExpanded = expandedPatterns.has(pattern["id"]);
        return (<Card key={pattern["id"]} withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <ActionIcon variant="subtle" size="sm" onClick={() => handleToggleExpanded(pattern["id"])}>

                {isExpanded ? <IconChevronDown size={16}/> : <IconChevronRight size={16}/>}
              </ActionIcon>

              <Box>
                <Group gap="xs">
                  <Text fw={500}>{pattern["name"]}</Text>
                  <Badge size="xs" variant="light">
                    Priority: {pattern.priority}
                  </Badge>
                </Group>
                {pattern["description"] &&
                <Text size="sm" c="dimmed">{pattern["description"]}</Text>}
              </Box>
            </Group>

            <Group gap="xs">
              <Tooltip label="Test pattern">
                <ActionIcon variant="subtle" onClick={() => handleTestPattern(pattern)}>

                  <IconTestPipe size={18}/>
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Edit pattern">
                <ActionIcon variant="subtle" onClick={() => handleEditPattern(pattern)}>

                  <IconEdit size={18}/>
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Delete pattern">
                <ActionIcon variant="subtle" color="red" onClick={() => handleDeletePattern(pattern["id"])}>

                  <IconTrash size={18}/>
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          <Collapse in={isExpanded}>
            <Stack gap="md" pt="sm">
              <Box>
                <Text size="sm" fw={500} mb="xs">Pattern</Text>
                <Code block>{pattern.pattern}</Code>
              </Box>

              <Box>
                <Text size="sm" fw={500} mb="xs">Extractors</Text>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Field</Table.Th>
                      <Table.Th>Group</Table.Th>
                      <Table.Th>Transform</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {pattern.extractors.map((extractor, index) => <Table.Tr key={index}>
                        <Table.Td>{extractor.field}</Table.Td>
                        <Table.Td>{extractor.groupIndex}</Table.Td>
                        <Table.Td>{extractor.transform ?? 'none'}</Table.Td>
                      </Table.Tr>)}
                  </Table.Tbody>
                </Table>
              </Box>

              {pattern.examples && pattern.examples.length > 0 &&
                <Box>
                  <Text size="sm" fw={500} mb="xs">Examples</Text>
                  <Stack gap={4}>
                    {pattern.examples.map((example, index) => <Code key={index}>{example}</Code>)}
                  </Stack>
                </Box>}
            </Stack>
          </Collapse>
        </Stack>
      </Card>);
    };
    return (<Stack>
      <Alert icon={<IconAlertCircle />} color="blue">
        <Text size="sm">
          Advanced patterns extract metadata from filenames using regular expressions.
          They are used by the file parser to identify manga titles, chapters, volumes, and other information.
        </Text>
      </Alert>

      <Group justify="space-between">
        <Text fw={500}>Parsing Patterns</Text>
        <Button leftSection={<IconPlus size={18}/>} onClick={handleAddPattern}>

          Add Pattern
        </Button>
      </Group>

      <ScrollArea h={400}>
        <Stack gap="sm">
          {patterns.length === 0 ?
            <Card withBorder p="xl">
              <Stack align="center" gap="md">
                <IconTestPipe size={48} color="gray"/>
                <Text c="dimmed">No custom patterns defined</Text>
                <Text size="sm" c="dimmed">Default patterns are being used</Text>
              </Stack>
            </Card> :
            patterns.
                sort((a, b) => b.priority - a.priority).
                map((pattern) => renderPattern(pattern))}
        </Stack>
      </ScrollArea>

      {showEditor &&
            <PatternEditor opened={showEditor} onClose={() => {
                    setShowEditor(false);
                    setSelectedPattern(null);
                }} pattern={selectedPattern} onSave={(pattern) => {
                    if (selectedPattern) {
                        setPatterns(patterns.map((p) => p["id"] === selectedPattern["id"] ? pattern : p));
                    }
                    else {
                        setPatterns([...patterns, pattern]);
                    }
                    setShowEditor(false);
                    setSelectedPattern(null);
                }}/>}

      {showTest && testPattern &&
            <PatternTestModal opened={showTest} onClose={() => {
                    setShowTest(false);
                    setTestPattern(null);
                }} pattern={testPattern}/>}
    </Stack>);
}
// Pattern Editor Modal
interface PatternEditorProps {
    opened: boolean;
    onClose: () => void;
    pattern: AdvancedPattern | null;
    onSave: (pattern: AdvancedPattern) => void;
}
function PatternEditor({ opened, onClose, pattern, onSave }: PatternEditorProps): JSX.Element {
    const [name, setName] = useState(pattern?.name ?? '');
    const [description, setDescription] = useState(pattern?.description ?? '');
    const [patternRegex, setPatternRegex] = useState(pattern?.pattern ?? '');
    const [priority, setPriority] = useState(pattern?.priority ?? 50);
    const [extractors, setExtractors] = useState<PatternExtractor[]>(pattern?.extractors ?? []);
    const [examples, setExamples] = useState(pattern?.examples?.join('\n') ?? '');
    const [error, setError] = useState('');
    const handleAddExtractor = (): void => {
        setExtractors([...extractors, {
                field: 'title',
                groupIndex: 1
            }]);
    };
    const handleUpdateExtractor = (index: number, updates: Partial<PatternExtractor>): void => {
        const updated = [...extractors];
        const current = updated[index];
        if (current) {
            updated[index] = {
                ...current,
                ...(updates.field !== undefined && { field: updates.field }),
                ...(updates.groupIndex !== undefined && { groupIndex: updates.groupIndex }),
                ...(updates.transform !== undefined && { transform: updates.transform }),
                ...(updates.customTransform !== undefined && { customTransform: updates.customTransform })
            };
            setExtractors(updated);
        }
    };
    const handleRemoveExtractor = (index: number): void => {
        setExtractors(extractors.filter((_, i) => i !== index));
    };
    const handleSave = (): void => {
        // Validate pattern
        try {
            new RegExp(patternRegex);
        }
        catch (_e: unknown) {
  setError('Invalid regular expression');
            return;
        }
        if (!name.trim()) {
            setError('Pattern name is required');
            return;
        }
        const savedPattern: AdvancedPattern = {
            id: pattern?.id ?? globalThis.crypto.randomUUID(),
            name,
            description,
            pattern: patternRegex,
            extractors,
            examples: examples.split('\n').filter((e) => e.trim()),
            priority
        };
        onSave(savedPattern);
    };
    return (<Modal opened={opened} onClose={onClose} size="lg" title={pattern ? 'Edit Pattern' : 'Create Pattern'}>

      <Stack>
        <TextInput label="Pattern Name" value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="e.g., Standard Scanlation Format" required/>

        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} placeholder="What does this pattern match?" rows={2}/>

        <TextInput label="Regular Expression" value={patternRegex} onChange={(e) => setPatternRegex(e.currentTarget.value)} placeholder="^\\[([^\\]]+)\\]\\s*(.+?)\\s*-\\s*Chapter\\s*([\\d.]+)" required error={error.includes('regular expression') ? error : undefined}/>

        <NumberInput label="Priority" value={priority} onChange={(value) => setPriority(typeof value === 'number' ? value : 0)} min={0} max={1000} description="Higher priority patterns are tried first"/>

        <Divider label="Extractors"/>

        <Stack gap="sm">
          {extractors.map((extractor, index) => <Card key={index} withBorder p="sm">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Extractor {index + 1}</Text>
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleRemoveExtractor(index)}>

                    <IconTrash size={16}/>
                  </ActionIcon>
                </Group>

                <Group grow>
                  <Select label="Field" value={extractor.field} onChange={(value) => handleUpdateExtractor(index, {
                field: value as 'title' | 'group' | 'volume' | 'chapter' | 'language' | 'quality' | 'custom'
            })} data={[
                { value: 'title', label: 'Title' },
                { value: 'group', label: 'Group' },
                { value: 'volume', label: 'Volume' },
                { value: 'chapter', label: 'Chapter' },
                { value: 'language', label: 'Language' },
                { value: 'quality', label: 'Quality' },
                { value: 'custom', label: 'Custom' }
            ]}/>

                  <NumberInput label="Capture Group" value={extractor.groupIndex} onChange={(value) => handleUpdateExtractor(index, {
                groupIndex: typeof value === 'number' ? value : 1
            })} min={1}/>

                </Group>

                <Select label="Transform" value={extractor.transform ?? 'none'} onChange={(value) => handleUpdateExtractor(index, {
                ...(value === 'none' ? {} : { transform: value as 'lowercase' | 'uppercase' | 'capitalize' | 'number' | 'custom' })
            })} data={[
                { value: 'none', label: 'None' },
                { value: 'lowercase', label: 'Lowercase' },
                { value: 'uppercase', label: 'Uppercase' },
                { value: 'capitalize', label: 'Capitalize' },
                { value: 'number', label: 'To Number' },
                { value: 'custom', label: 'Custom' }
            ]}/>

                {extractor.transform === 'custom' &&
                <TextInput label="Custom Transform" value={extractor.customTransform ?? ''} onChange={(e) => handleUpdateExtractor(index, {
                        customTransform: e.currentTarget.value
                    })} placeholder="value.replace(/_/g, ' ')"/>}
              </Stack>
            </Card>)}
        </Stack>

        <Button variant="default" leftSection={<IconPlus size={16}/>} onClick={handleAddExtractor} fullWidth>

          Add Extractor
        </Button>

        <Textarea label="Example Filenames" value={examples} onChange={(e) => setExamples(e.currentTarget.value)} placeholder="One filename per line" rows={4}/>

        {error &&
            <Alert icon={<IconAlertCircle />} color="red">
            {error}
          </Alert>}

        <Divider />

        <Group justify="right">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {pattern ? 'Update Pattern' : 'Create Pattern'}
          </Button>
        </Group>
      </Stack>
    </Modal>);
}
// Pattern Test Modal
interface PatternTestModalProps {
    opened: boolean;
    onClose: () => void;
    pattern: AdvancedPattern;
}
function PatternTestModal({ opened, onClose, pattern }: PatternTestModalProps): JSX.Element {
    const [testFilenames, setTestFilenames] = useState(pattern.examples ?? [
        '[HorribleSubs] One Piece - Chapter 1100 [1080p].cbz',
        'Naruto_v01_c001.zip',
        'Bleach Chapter 686.pdf'
    ]);
    const [customFilename, setCustomFilename] = useState('');
    const [testResults, setTestResults] = useState<Array<{
        filename: string;
        matched: boolean;
        extracted?: Record<string, string | number | undefined>;
    }>>([]);
    const handleAddFilename = (): void => {
        if (customFilename && !testFilenames.includes(customFilename)) {
            setTestFilenames([...testFilenames, customFilename]);
            setCustomFilename('');
        }
    };
    const handleRunTests = (): void => {
        // TODO: Implement AdvancedPatternMatcher
        // const matcher = new AdvancedPatternMatcher([pattern]);
        // const results = matcher.testPattern(pattern, testFilenames);
        const results: Array<{
            filename: string;
            matched: boolean;
            extracted?: Record<string, string | number | undefined>;
        }> = []; // Placeholder
        setTestResults(results);
    };
    return (<Modal opened={opened} onClose={onClose} size="lg" title={`Test Pattern: ${pattern["name"]}`}>

      <Stack>
        <Alert icon={<IconAlertCircle />} color="blue">
          <Text size="sm">Test how this pattern matches filenames and extracts data.</Text>
        </Alert>

        <Box>
          <Text size="sm" fw={500} mb="xs">Test Filenames</Text>
          <Stack gap="xs">
            {testFilenames.map((filename, index) => <Group key={index} gap="xs">
                <Text size="sm" style={{ flex: 1 }}>{filename}</Text>
                <ActionIcon variant="subtle" color="red" size="sm" onClick={() => setTestFilenames(testFilenames.filter((_, i) => i !== index))}>

                  <IconX size={16}/>
                </ActionIcon>
              </Group>)}
          </Stack>

          <Group mt="sm">
            <TextInput placeholder="Add test filename..." value={customFilename} onChange={(e) => setCustomFilename(e.currentTarget.value)} style={{ flex: 1 }} onKeyDown={(e) => {
            if (e.key === 'Enter') {
                handleAddFilename();
            }
        }}/>

            <Button onClick={handleAddFilename}>Add</Button>
          </Group>
        </Box>

        <Button onClick={handleRunTests}>Run Tests</Button>

        {testResults.length > 0 &&
            <>
            <Divider label="Results"/>
            <ScrollArea h={300}>
              <Stack gap="sm">
                {testResults.map((result, index) => <Card key={index} withBorder p="sm">
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text size="sm" fw={500}>{result.filename}</Text>
                        {result.matched ?
                        <Badge color="green" leftSection={<IconCheck size={14}/>}>
                            Matched
                          </Badge> :
                        <Badge color="red" leftSection={<IconX size={14}/>}>
                            No Match
                          </Badge>}
                      </Group>
                      
                      {result.matched && result.extracted &&
                        <Box>
                          <Text size="xs" fw={500} mb={5}>Extracted Data:</Text>
                          <Group gap="xs">
                            {Object.entries(result.extracted).map(([key, value]) => <Badge key={key} size="xs" variant="light">
                                {key}: {String(value)}
                              </Badge>)}
                          </Group>
                        </Box>}
                    </Stack>
                  </Card>)}
              </Stack>
            </ScrollArea>
          </>}

        <Group justify="right">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>);
}
