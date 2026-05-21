/**
 * Kaizoku API Playground
 *
 * Interactive API explorer for testing and documentation
 */
import React, { useState, useEffect, useRef } from 'react';

import { AppShell, Container, Title, Group, Select, TextInput, Button, Paper, Stack, Badge, Code, Tabs, JsonInput, Alert, CopyButton, ActionIcon, Tooltip, ScrollArea, Text, Divider, LoadingOverlay, Table, Switch } from '@mantine/core';
import { IconApi, IconSend, IconCopy, IconCheck, IconAlertCircle, IconCode, IconFile, IconKey, IconClock, IconRefresh } from '@tabler/icons-react';

import { notify } from '@/utils/notify';

import { logger } from '../utils/logger';

// Helper function for type guards
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface ApiEndpoint {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string;
    description: string;
    parameters?: {
        name: string;
        type: 'path' | 'query' | 'body';
        required: boolean;
        description: string;
        schema?: unknown;
    }[];
    requestBody?: {
        description: string;
        example: unknown;
    };
    responses: {
        [statusCode: string]: {
            description: string;
            example: unknown;
        };
    };
}
const API_ENDPOINTS: Record<string, ApiEndpoint[]> = {
    'System': [
        {
            method: 'GET',
            path: '/api/v1/health',
            description: 'Check API health status',
            responses: {
                '200': {
                    description: 'API is healthy',
                    example: {
                        status: 'ok',
                        timestamp: '2025-01-07T12:00:00Z',
                        version: '1.0.0',
                        checks: {
                            database: { status: 'ok' },
                            cache: { status: 'ok' }
                        }
                    }
                }
            }
        }
    ],
    'Manga': [
        {
            method: 'GET',
            path: '/api/v1/manga',
            description: 'List all manga with pagination',
            parameters: [
                { name: 'page', type: 'query', required: false, description: 'Page number (default: 1)' },
                { name: 'limit', type: 'query', required: false, description: 'Items per page (default: 20)' },
                { name: 'status', type: 'query', required: false, description: 'Filter by status' },
                { name: 'search', type: 'query', required: false, description: 'Search by title' },
                { name: 'libraryId', type: 'query', required: false, description: 'Filter by library' }
            ],
            responses: {
                '200': {
                    description: 'List of manga',
                    example: {
                        status: 'success',
                        data: [
                            {
                                id: 1,
                                title: 'One Piece',
                                sourceId: 'one-piece-id',
                                source: 'anilist',
                                status: 'ACTIVE',
                                coverUrl: 'https://example.com/cover.jpg',
                                libraryId: 1
                            }
                        ],
                        meta: {
                            page: 1,
                            limit: 20,
                            total: 100,
                            hasMore: true
                        }
                    }
                }
            }
        },
        {
            method: 'POST',
            path: '/api/v1/manga',
            description: 'Create a new manga',
            requestBody: {
                description: 'Manga creation data',
                example: {
                    title: 'One Piece',
                    sourceId: 'one-piece-id',
                    source: 'anilist',
                    libraryId: 1,
                    metadata: {
                        description: 'The legendary pirate adventure',
                        authors: ['Eiichiro Oda'],
                        genres: ['Adventure', 'Comedy']
                    }
                }
            },
            responses: {
                '201': {
                    description: 'Manga created successfully',
                    example: {
                        status: 'success',
                        data: {
                            id: 123,
                            title: 'One Piece',
                            sourceId: 'one-piece-id',
                            source: 'anilist',
                            status: 'PENDING',
                            libraryId: 1,
                            createdAt: '2025-01-07T12:00:00Z',
                            updatedAt: '2025-01-07T12:00:00Z'
                        }
                    }
                }
            }
        },
        {
            method: 'GET',
            path: '/api/v1/manga/{id}',
            description: 'Get manga details by ID',
            parameters: [
                { name: 'id', type: 'path', required: true, description: 'Manga ID' },
                { name: 'include', type: 'query', required: false, description: 'Include related data (chapters,metadata)' }
            ],
            responses: {
                '200': {
                    description: 'Manga details',
                    example: {
                        status: 'success',
                        data: {
                            id: 1,
                            title: 'One Piece',
                            sourceId: 'one-piece-id',
                            source: 'anilist',
                            status: 'ACTIVE',
                            coverUrl: 'https://example.com/cover.jpg',
                            libraryId: 1,
                            metadata: {
                                description: 'The legendary pirate adventure',
                                authors: ['Eiichiro Oda'],
                                genres: ['Adventure', 'Comedy', 'Drama']
                            },
                            _links: {
                                self: '/api/v1/manga/1',
                                chapters: '/api/v1/manga/1/chapters',
                                library: '/api/v1/libraries/1'
                            }
                        }
                    }
                },
                '404': {
                    description: 'Manga not found',
                    example: {
                        status: 'error',
                        error: {
                            code: 'NOT_FOUND',
                            message: 'Manga not found',
                            timestamp: '2025-01-07T12:00:00Z',
                            requestId: 'req_123'
                        }
                    }
                }
            }
        }
    ],
    'Search': [
        {
            method: 'POST',
            path: '/api/v1/search',
            description: 'Advanced search with filters and facets',
            requestBody: {
                description: 'Search parameters',
                example: {
                    query: 'pirate',
                    filters: {
                        status: ['ACTIVE', 'COMPLETED'],
                        source: ['anilist'],
                        genres: ['Adventure']
                    },
                    sort: {
                        field: 'updatedAt',
                        order: 'desc'
                    },
                    facets: ['status', 'source', 'genres'],
                    page: 1,
                    limit: 20
                }
            },
            responses: {
                '200': {
                    description: 'Search results with facets',
                    example: {
                        status: 'success',
                        data: {
                            results: [
                                {
                                    id: 1,
                                    title: 'One Piece',
                                    source: 'anilist',
                                    status: 'ACTIVE'
                                }
                            ],
                            facets: {
                                status: [
                                    { value: 'ACTIVE', count: 50 },
                                    { value: 'COMPLETED', count: 30 }
                                ],
                                source: [
                                    { value: 'anilist', count: 70 },
                                    { value: 'comicvine', count: 10 }
                                ]
                            },
                            meta: {
                                page: 1,
                                limit: 20,
                                total: 80,
                                hasMore: true
                            }
                        }
                    }
                }
            }
        }
    ],
    'Batch': [
        {
            method: 'POST',
            path: '/api/v1/batch',
            description: 'Execute multiple operations in a single request',
            requestBody: {
                description: 'Batch operations',
                example: {
                    operations: [
                        {
                            id: 'op1',
                            method: 'GET',
                            resource: 'manga/1'
                        },
                        {
                            id: 'op2',
                            method: 'POST',
                            resource: 'chapters/123/download'
                        }
                    ],
                    options: {
                        parallel: true,
                        continueOnError: true
                    }
                }
            },
            responses: {
                '200': {
                    description: 'Batch results',
                    example: {
                        status: 'success',
                        data: {
                            results: [
                                {
                                    id: 'op1',
                                    status: 'success',
                                    statusCode: 200,
                                    data: { id: 1, title: 'One Piece' }
                                },
                                {
                                    id: 'op2',
                                    status: 'success',
                                    statusCode: 201,
                                    data: { downloadId: 'dl_123' }
                                }
                            ],
                            summary: {
                                total: 2,
                                successful: 2,
                                failed: 0,
                                duration: 145
                            }
                        }
                    }
                }
            }
        }
    ],
    'Webhooks': [
        {
            method: 'POST',
            path: '/api/v1/webhooks',
            description: 'Create a new webhook',
            requestBody: {
                description: 'Webhook configuration',
                example: {
                    url: 'https://your-server.com/webhook',
                    events: ['manga.created', 'chapter.downloaded'],
                    secret: 'optional-secret-for-hmac'
                }
            },
            responses: {
                '201': {
                    description: 'Webhook created',
                    example: {
                        status: 'success',
                        data: {
                            id: 'wh_123',
                            url: 'https://your-server.com/webhook',
                            events: ['manga.created', 'chapter.downloaded'],
                            enabled: true,
                            secret: 'generated-secret-only-shown-once',
                            createdAt: '2025-01-07T12:00:00Z'
                        }
                    }
                }
            }
        }
    ]
};
export default function ApiPlayground(): React.ReactElement {
    const [selectedCategory, setSelectedCategory] = useState<string>('System');
    const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
    const [apiKey, setApiKey] = useState<string>('');
    const [baseUrl, setBaseUrl] = useState<string>('http://localhost:3000');
    const [pathParams, setPathParams] = useState<Record<string, string>>({});
    const [queryParams, setQueryParams] = useState<Record<string, string>>({});
    const [requestBody, setRequestBody] = useState<string>('');
    const [response, setResponse] = useState<unknown>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<string | null>('response');
    const [autoFormat, setAutoFormat] = useState(true);
    const eventSourceRef = useRef<EventSource | null>(null);
    useEffect(() => {
        // Load saved API key
        const savedApiKey = localStorage.getItem('kaizoku_api_key');
        if (savedApiKey) {
            setApiKey(savedApiKey);
        }
        // Load saved base URL
        const savedBaseUrl = localStorage.getItem('kaizoku_base_url');
        if (savedBaseUrl) {
            setBaseUrl(savedBaseUrl);
        }
        return () => {
            // Clean up SSE connection
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);
    const selectEndpoint = (endpoint: ApiEndpoint): void => {
        setSelectedEndpoint(endpoint);
        setPathParams({});
        setQueryParams({});
        if (endpoint.requestBody?.example) {
            setRequestBody(JSON.stringify(endpoint.requestBody.example, null, 2));
        }
        else {
            setRequestBody('');
        }
        setResponse(null);
    };
    const buildUrl = (): string => {
        if (!selectedEndpoint)
            return '';
        let path = selectedEndpoint.path;
        // Replace path parameters
        Object.entries(pathParams).forEach(([key, value]) => {
            path = path.replace(`{${key}}`, value);
        });
        // Add query parameters
        const queryString = Object.entries(queryParams).
            filter(([, value]) => value).
            map(([key, value]) => `${key}=${encodeURIComponent(value)}`).
            join('&');
        return `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`;
    };
    const executeRequest = async (): Promise<void> => {
        if (!selectedEndpoint || !apiKey) {
            notify({ severity: 'ERROR', title: 'Error', message: 'Please select an endpoint and provide an API key' });
            return;
        }
        setIsLoading(true);
        const startTime = Date.now();
        try {
            const url = buildUrl();
            const headers: HeadersInit = {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json'
            };
            const options: RequestInit = {
                method: selectedEndpoint.method,
                headers
            };
            if (requestBody && ['POST', 'PATCH'].includes(selectedEndpoint.method)) {
                try {
                    options.body = autoFormat ? JSON.stringify(JSON.parse(requestBody)) : requestBody;
                }
                catch {
                    options.body = requestBody;
                }
            }
            const response = await fetch(url, options);
            const responseTime = Date.now() - startTime;
            const responseData: unknown = await response.json();
            setResponse({
                status: response["status"],
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                data: responseData,
                time: responseTime
            });
            if (response.ok) {
                notify({ severity: 'SUCCESS', title: 'Success', message: `Request completed in ${responseTime}ms` });
            }
            else {
                notify({ severity: 'ERROR', title: 'Error', message: `Request failed with status ${response["status"]}` });
            }
        }
        catch (error: unknown) {
            setResponse({
                error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error',
                time: Date.now() - startTime
            });
            notify({ severity: 'ERROR', title: 'Request Failed', message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error' });
        }
        finally {
            setIsLoading(false);
        }
    };
    const connectToSSE = (): void => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }
        const url = `${baseUrl}/api/v1/events/stream?apiKey=${encodeURIComponent(apiKey)}`;
        eventSourceRef.current = new EventSource(url);
        eventSourceRef.current.onopen = () => {
            notify({ severity: 'SUCCESS', title: 'Connected', message: 'Connected to Server-Sent Events stream' });
        };
        eventSourceRef.current.onerror = () => {
            notify({ severity: 'ERROR', title: 'Connection Error', message: 'Failed to connect to SSE stream' });
        };
        eventSourceRef.current.onmessage = (event) => {
            logger.info('SSE Event:', event.data);
        };
    };
    const generateCode = (language: 'curl' | 'javascript' | 'python'): string => {
        if (!selectedEndpoint)
            return '';
        const url = buildUrl();
        switch (language) {
            case 'curl': {
                let curl = `curl -X ${selectedEndpoint.method} '${url}' \\\n`;
                curl += `  -H 'X-API-Key: ${apiKey}' \\\n`;
                curl += `  -H 'Content-Type: application/json'`;
                if (requestBody && ['POST', 'PATCH'].includes(selectedEndpoint.method)) {
                    curl += ` \\\n  -d '${requestBody.replace(/\n/g, '')}'`;
                }
                return curl;
            }
            case 'javascript': {
                let js = `const response = await fetch('${url}', {\n`;
                js += `  method: '${selectedEndpoint.method}',\n`;
                js += `  headers: {\n`;
                js += `    'X-API-Key': '${apiKey}',\n`;
                js += `    'Content-Type': 'application/json',\n`;
                js += `  },\n`;
                if (requestBody && ['POST', 'PATCH'].includes(selectedEndpoint.method)) {
                    js += `  body: JSON.stringify(${requestBody}),\n`;
                }
                js += `});\n\n`;
                js += `const data = await response.json();\n`;
                js += `logger.info(data);`;
                return js;
            }
            case 'python': {
                let py = `import requests\n\n`;
                py += `url = '${url}'\n`;
                py += `headers = {\n`;
                py += `    'X-API-Key': '${apiKey}',\n`;
                py += `    'Content-Type': 'application/json',\n`;
                py += `}\n\n`;
                const method = selectedEndpoint.method.toLowerCase();
                if (requestBody && ['POST', 'PATCH'].includes(selectedEndpoint.method)) {
                    py += `data = ${requestBody}\n\n`;
                    py += `response = requests.${method}(url, headers=headers, json=data)\n`;
                }
                else {
                    py += `response = requests.${method}(url, headers=headers)\n`;
                }
                py += `print(response.json())`;
                return py;
            }
            default:
                return '';
        }
    };
    return (<AppShell padding="md">
      <Container size="xl">
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between">
            <Group>
              <IconApi size={32}/>
              <Title order={2}>API Playground</Title>
            </Group>
            <Group>
              <TextInput placeholder="API Key" value={apiKey} onChange={(e) => {
            setApiKey(e.target.value);
            localStorage.setItem('kaizoku_api_key', e.target.value);
        }} leftSection={<IconKey size={16}/>} type="password" style={{ width: 300 }}/>

              <TextInput placeholder="Base URL" value={baseUrl} onChange={(e) => {
            setBaseUrl(e.target.value);
            localStorage.setItem('kaizoku_base_url', e.target.value);
        }} style={{ width: 250 }}/>

            </Group>
          </Group>

          {/* Main Content */}
          <Group align="flex-start" gap="md">
            {/* Endpoint Selector */}
            <Paper shadow="xs" p="md" style={{ flex: 1, maxWidth: 350 }}>
              <Stack gap="md">
                <Title order={4}>Endpoints</Title>
                
                <Select label="Category" value={selectedCategory} onChange={(value) => value && setSelectedCategory(value)} data={Object.keys(API_ENDPOINTS)}/>


                <ScrollArea h={500}>
                  <Stack gap="xs">
                    {API_ENDPOINTS[selectedCategory]?.map((endpoint, index) => <Paper key={index} p="sm" withBorder style={{
                cursor: 'pointer',
                backgroundColor: selectedEndpoint === endpoint ? '#f0f0f0' : undefined
            }} onClick={() => selectEndpoint(endpoint)}>

                        <Group gap="xs">
                          <Badge color={endpoint.method === 'GET' ? 'blue' :
                endpoint.method === 'POST' ? 'green' :
                    endpoint.method === 'PATCH' ? 'orange' :
                        'red'} size="sm">

                            {endpoint.method}
                          </Badge>
                          <Text size="sm" style={{ flex: 1 }}>
                            {endpoint.path}
                          </Text>
                        </Group>
                        <Text size="xs" c="dimmed" mt={4}>
                          {endpoint["description"]}
                        </Text>
                      </Paper>)}
                  </Stack>
                </ScrollArea>
              </Stack>
            </Paper>

            {/* Request Builder */}
            <Paper shadow="xs" p="md" style={{ flex: 2 }}>
              <LoadingOverlay visible={isLoading}/>
              
              {selectedEndpoint ?
            <Stack gap="md">
                  <Group justify="space-between">
                    <Group>
                      <Badge color={selectedEndpoint.method === 'GET' ? 'blue' :
                    selectedEndpoint.method === 'POST' ? 'green' :
                        selectedEndpoint.method === 'PATCH' ? 'orange' :
                            'red'}>

                        {selectedEndpoint.method}
                      </Badge>
                      <Code>{buildUrl()}</Code>
                    </Group>
                    <Button leftSection={<IconSend size={16}/>} onClick={() => { void executeRequest(); }} loading={isLoading}>

                      Send Request
                    </Button>
                  </Group>

                  <Divider />

                  {/* Parameters */}
                  {selectedEndpoint.parameters &&
                    <div>
                      <Title order={5} mb="sm">Parameters</Title>
                      <Stack gap="xs">
                        {selectedEndpoint.parameters.map((param) => <TextInput key={param["name"]} label={param["name"]} description={param["description"]} required={param.required} value={param.type === 'path' ?
                                pathParams[param["name"]] ?? '' :
                                queryParams[param["name"]] ?? ''} onChange={(e) => {
                                if (param.type === 'path') {
                                    setPathParams({ ...pathParams, [param["name"]]: e.target.value });
                                }
                                else {
                                    setQueryParams({ ...queryParams, [param["name"]]: e.target.value });
                                }
                            }}/>)}
                      </Stack>
                    </div>}

                  {/* Request Body */}
                  {selectedEndpoint.requestBody &&
                    <div>
                      <Group justify="space-between" mb="sm">
                        <Title order={5}>Request Body</Title>
                        <Switch label="Auto-format JSON" checked={autoFormat} onChange={(e) => setAutoFormat(e.currentTarget.checked)}/>

                      </Group>
                      <JsonInput value={requestBody} onChange={setRequestBody} minRows={10} formatOnBlur={autoFormat} validationError="Invalid JSON"/>

                    </div>}

                  <Divider />

                  {/* Response */}
                  <div>
                    <Title order={5} mb="sm">Response</Title>
                    
                    {response && isRecord(response) ? (
                    <Stack gap="md">
                        <Group justify="space-between">
                          <Group>
                            <Badge color={typeof response['status'] === 'number' && response['status'] >= 200 && response['status'] < 300 ? 'green' :
                            typeof response['status'] === 'number' && response['status'] >= 400 && response['status'] < 300 ? 'orange' :
                                typeof response['status'] === 'number' && response['status'] >= 500 ? 'red' : 'gray'}>

                              {String(response['status'] ?? 'Error')} {String(response['statusText'] ?? '')}
                            </Badge>
                            <Text size="sm" c="dimmed">
                              <IconClock size={14} style={{ verticalAlign: 'middle' }}/> {String(response['time'] || '0')}ms
                            </Text>
                          </Group>
                          <CopyButton value={JSON.stringify(response['data'] || response['error'], null, 2)}>
                            {({ copied, copy }) => <Tooltip label={copied ? 'Copied' : 'Copy response'}>
                                <ActionIcon onClick={() => { void copy(); }}>
                                  {copied ? <IconCheck size={16}/> : <IconCopy size={16}/>}
                                </ActionIcon>
                              </Tooltip>}
                          </CopyButton>
                        </Group>

                        <Tabs value={activeTab} onChange={setActiveTab}>
                          <Tabs.List>
                            <Tabs.Tab value="response" leftSection={<IconFile size={14}/>}>
                              Response
                            </Tabs.Tab>
                            <Tabs.Tab value="headers" leftSection={<IconCode size={14}/>}>
                              Headers
                            </Tabs.Tab>
                            <Tabs.Tab value="code" leftSection={<IconCode size={14}/>}>
                              Code
                            </Tabs.Tab>
                          </Tabs.List>

                          <Tabs.Panel value="response" pt="xs">
                            <Code block>
                              {JSON.stringify(response['data'] || response['error'], null, 2)}
                            </Code>
                          </Tabs.Panel>

                          <Tabs.Panel value="headers" pt="xs">
                            {response['headers'] && isRecord(response['headers']) ? (
                            <Table>
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>Header</Table.Th>
                                    <Table.Th>Value</Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {Object.entries(response['headers']).map(([key, value]) => <Table.Tr key={key}>
                                      <Table.Td>{key}</Table.Td>
                                      <Table.Td>{String(value)}</Table.Td>
                                    </Table.Tr>)}
                                </Table.Tbody>
                              </Table>
                            ) : null}
                          </Tabs.Panel>

                          <Tabs.Panel value="code" pt="xs">
                            <Tabs defaultValue="curl">
                              <Tabs.List>
                                <Tabs.Tab value="curl">cURL</Tabs.Tab>
                                <Tabs.Tab value="javascript">JavaScript</Tabs.Tab>
                                <Tabs.Tab value="python">Python</Tabs.Tab>
                              </Tabs.List>

                              <Tabs.Panel value="curl" pt="xs">
                                <Code block>
                                  {generateCode('curl')}
                                </Code>
                              </Tabs.Panel>

                              <Tabs.Panel value="javascript" pt="xs">
                                <Code block>
                                  {generateCode('javascript')}
                                </Code>
                              </Tabs.Panel>

                              <Tabs.Panel value="python" pt="xs">
                                <Code block>
                                  {generateCode('python')}
                                </Code>
                              </Tabs.Panel>
                            </Tabs>
                          </Tabs.Panel>
                        </Tabs>
                      </Stack>
                    ) : null}
                  </div>
                </Stack> :
            <Alert icon={<IconAlertCircle size={16}/>} color="blue">
                  Select an endpoint from the list to start testing
                </Alert>}
            </Paper>
          </Group>

          {/* SSE Section */}
          <Paper shadow="xs" p="md">
            <Group justify="space-between" mb="md">
              <Title order={4}>Server-Sent Events</Title>
              <Button onClick={() => { void connectToSSE(); }} leftSection={<IconRefresh size={16}/>} disabled={!apiKey}>

                Connect to SSE
              </Button>
            </Group>
            <Alert icon={<IconAlertCircle size={16}/>} color="blue">
              Connect to the SSE stream to receive real-time events. Check the browser console for incoming events.
            </Alert>
          </Paper>
        </Stack>
      </Container>
    </AppShell>);
}
