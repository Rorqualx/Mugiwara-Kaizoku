/**
 * Performance Dashboard Component
 *
 * Displays real-time performance metrics:
 * - Core Web Vitals
 * - Network status
 * - Device capabilities
 * - Performance recommendations
 */
import React, { useState } from 'react';

import { Box, Card, Text, Group, Stack, Badge, Progress, Tabs, SimpleGrid, Tooltip, Button, Alert } from '@mantine/core';
import { IconActivity, IconNetwork, IconDeviceMobile, IconInfoCircle, IconRefresh, IconAlertTriangle, IconCheck, IconX } from '@tabler/icons-react';

import { usePerformanceMonitor } from '@/hooks/performance/usePerformanceMonitor';
import { isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { AnimatedValue } from './ReducedMotion';
interface MetricCardProps {
    label: string;
    value: number | undefined;
    unit: string;
    status: 'good' | 'warning' | 'poor';
    target?: number;
    description?: string;
}
function MetricCard({ label, value, unit, status, target, description }: MetricCardProps): JSX.Element {
    const statusColors = {
        good: 'green',
        warning: 'yellow',
        poor: 'red'
    };
    const statusIcons = {
        good: <IconCheck size={16}/>,
        warning: <IconAlertTriangle size={16}/>,
        poor: <IconX size={16}/>
    };
    return (<Card p="md" withBorder>
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start">
          <Text size="sm" c="dimmed" fw={500}>
            {label}
          </Text>
          <Tooltip label={`Status: ${status}`}>
            <Badge color={statusColors[status]} size="sm" leftSection={statusIcons[status]}>

              {status}
            </Badge>
          </Tooltip>
        </Group>
        
        <Group align="baseline" gap="xs">
          <Text size="xl" fw={700}>
            {value !== undefined ?
            <AnimatedValue from={0} to={value} duration={500} format={(val) => val.toFixed(unit === 'ms' ? 0 : 2)}/> :
            '-'}
          </Text>
          <Text size="sm" c="dimmed">
            {unit}
          </Text>
        </Group>
        
        {target !== undefined && value !== undefined &&
            <Progress value={value / target * 100} color={statusColors[status]} size="xs" radius="xl"/>}
        
        {description &&
            <Text size="xs" c="dimmed">
            {description}
          </Text>}
      </Stack>
    </Card>);
}
export function PerformanceDashboard(): JSX.Element | null {
    const { data, isMonitoring, startMonitoring, stopMonitoring, measureNow, getRecommendations } = usePerformanceMonitor({
        interval: 5000,
        onBudgetExceeded: (metric, value, budget) => {
            logger.warn(`Performance budget exceeded: ${metric} (${value} > ${budget})`);
        }
    });
    const [activeTab, setActiveTab] = useState<string | null>('metrics');
    if (data["status"] === 'loading') {
        return (<Card p="xl" withBorder>
        <Stack align="center" gap="md">
          <Text>Loading performance data...</Text>
        </Stack>
      </Card>);
    }
    if (isError(data)) {
        return (<Alert icon={<IconAlertTriangle />} title="Performance Monitoring Error" color="red">

        {data.error instanceof Error ? data.error.message : String(data.error)}
      </Alert>);
    }
    if (data["status"] !== 'success') {
        return null;
    }
    const { metrics, network, device, isLowEnd } = data.data;
    const recommendations = getRecommendations();
    // Determine metric status
    const getMetricStatus = (metric: string, value: number | undefined): 'good' | 'warning' | 'poor' => {
        if (value === undefined)
            return 'good';
        const thresholds: Record<string, {
            good: number;
            poor: number;
        }> = {
            fcp: { good: 1800, poor: 3000 },
            lcp: { good: 2500, poor: 4000 },
            fid: { good: 100, poor: 300 },
            cls: { good: 0.1, poor: 0.25 },
            tti: { good: 3800, poor: 7300 }
        };
        const threshold = thresholds[metric];
        if (!threshold)
            return 'good';
        if (value <= threshold.good)
            return 'good';
        if (value >= threshold.poor)
            return 'poor';
        return 'warning';
    };
    return (<Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Group>
          <IconActivity size={24}/>
          <Text size="lg" fw={600}>
            Performance Monitor
          </Text>
          {isLowEnd &&
            <Badge color="orange" variant="light">
              Low-end device detected
            </Badge>}
        </Group>
        
        <Group>
          <Button size="xs" variant="light" leftSection={<IconRefresh size={14}/>} onClick={() => { void measureNow(); }}>

            Refresh
          </Button>
          <Button size="xs" variant={isMonitoring ? 'filled' : 'light'} color={isMonitoring ? 'red' : 'blue'} onClick={isMonitoring ? stopMonitoring : startMonitoring}>

            {isMonitoring ? 'Stop' : 'Start'} Monitoring
          </Button>
        </Group>
      </Group>
      
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="metrics" leftSection={<IconActivity size={16}/>}>
            Metrics
          </Tabs.Tab>
          <Tabs.Tab value="network" leftSection={<IconNetwork size={16}/>}>
            Network
          </Tabs.Tab>
          <Tabs.Tab value="device" leftSection={<IconDeviceMobile size={16}/>}>
            Device
          </Tabs.Tab>
          <Tabs.Tab value="recommendations" leftSection={<IconInfoCircle size={16}/>} rightSection={recommendations.length > 0 &&
            <Badge size="xs" color="blue" variant="filled">
                  {recommendations.length}
                </Badge>}>

            Recommendations
          </Tabs.Tab>
        </Tabs.List>
        
        <Tabs.Panel value="metrics" pt="md">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            <MetricCard label="First Contentful Paint" value={metrics.fcp} unit="ms" status={getMetricStatus('fcp', metrics.fcp)} target={3000} description="Time to first content render"/>

            
            <MetricCard label="Largest Contentful Paint" value={metrics.lcp} unit="ms" status={getMetricStatus('lcp', metrics.lcp)} target={4000} description="Time to largest content render"/>

            
            <MetricCard label="First Input Delay" value={metrics.fid} unit="ms" status={getMetricStatus('fid', metrics.fid)} target={300} description="Time to first interaction"/>

            
            <MetricCard label="Cumulative Layout Shift" value={metrics.cls} unit="" status={getMetricStatus('cls', metrics.cls)} target={0.25} description="Visual stability score"/>

            
            <MetricCard label="Time to Interactive" value={metrics.tti} unit="ms" status={getMetricStatus('tti', metrics.tti)} target={7300} description="Time until fully interactive"/>

            
            <MetricCard label="Total Blocking Time" value={metrics.tbt} unit="ms" status={getMetricStatus('tbt', metrics.tbt)} target={300} description="Sum of blocking time"/>

          </SimpleGrid>
        </Tabs.Panel>
        
        <Tabs.Panel value="network" pt="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Card p="md" withBorder>
              <Stack gap="sm">
                <Text fw={500}>Connection Type</Text>
                <Group>
                  <Badge size="lg" variant="filled">
                    {network.effectiveType ?? 'Unknown'}
                  </Badge>
                  {network.saveData &&
            <Badge color="orange" variant="light">
                      Data Saver On
                    </Badge>}
                </Group>
              </Stack>
            </Card>
            
            <Card p="md" withBorder>
              <Stack gap="sm">
                <Text fw={500}>Network Speed</Text>
                <Group>
                  <Box>
                    <Text size="xs" c="dimmed">Downlink</Text>
                    <Text fw={600}>
                      {network.downlink ? `${network.downlink} Mbps` : 'Unknown'}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">RTT</Text>
                    <Text fw={600}>
                      {network.rtt ? `${network.rtt}ms` : 'Unknown'}
                    </Text>
                  </Box>
                </Group>
              </Stack>
            </Card>
          </SimpleGrid>
        </Tabs.Panel>
        
        <Tabs.Panel value="device" pt="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Card p="md" withBorder>
              <Stack gap="xs">
                <Text fw={500}>Hardware</Text>
                <Text size="sm">
                  CPU Cores: {device.hardwareConcurrency}
                </Text>
                <Text size="sm">
                  Memory: {device.deviceMemory ? `${device.deviceMemory}GB` : 'Unknown'}
                </Text>
                <Text size="sm">
                  Touch Points: {device.maxTouchPoints}
                </Text>
              </Stack>
            </Card>
            
            <Card p="md" withBorder>
              <Stack gap="xs">
                <Text fw={500}>Preferences</Text>
                <Group gap="xs">
                  <Text size="sm">Reduced Motion:</Text>
                  <Badge color={device.prefersReducedMotion ? 'orange' : 'green'} size="sm">

                    {device.prefersReducedMotion ? 'Enabled' : 'Disabled'}
                  </Badge>
                </Group>
                <Group gap="xs">
                  <Text size="sm">Color Scheme:</Text>
                  <Badge size="sm">
                    {device.prefersColorScheme}
                  </Badge>
                </Group>
              </Stack>
            </Card>
          </SimpleGrid>
        </Tabs.Panel>
        
        <Tabs.Panel value="recommendations" pt="md">
          {recommendations.length > 0 ?
            <Stack gap="xs">
              {recommendations.map((recommendation, index) => <Alert key={index} icon={<IconInfoCircle />} color="blue" variant="light">

                  {recommendation}
                </Alert>)}
            </Stack> :
            <Alert icon={<IconCheck />} color="green" variant="light">

              Great! Your performance metrics are within acceptable ranges.
            </Alert>}
        </Tabs.Panel>
      </Tabs>
    </Stack>);
}
