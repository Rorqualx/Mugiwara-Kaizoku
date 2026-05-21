/**
 * Mobile Components Showcase
 *
 * Demo page for all mobile components
 */
import React, { useState } from 'react';

import { Container, Title, Text, Stack, Group, Button, Card, Badge } from '@mantine/core';
import { IconMenu2, IconShare, IconTrash, IconEdit, IconDownload, IconBell, IconHome, IconBook } from '@tabler/icons-react';

import { ActionSheet } from '@/components/mobile/ActionSheet';
import { AppUpdatePrompt } from '@/components/mobile/AppUpdatePrompt';
import { BottomSheet, useBottomSheet } from '@/components/mobile/BottomSheet';
import { FloatingActionButton } from '@/components/mobile/FloatingActionButton';
import { MobileModal } from '@/components/mobile/MobileModal';
import { MobileOptimizationChecklist } from '@/components/mobile/MobileOptimizationChecklist';
import { ToastContainer, toast } from '@/components/mobile/MobileToast';
import { PlatformSwitch, PlatformCheckbox, PlatformSegmentedControl, PlatformListItem, PlatformNavBar, PlatformTabBar } from '@/components/mobile/PlatformUI';
import { PullToSearch, usePullToSearch } from '@/components/mobile/PullToSearch';
import { PWAInstallPrompt } from '@/components/mobile/PWAInstallPrompt';
import { SwipeNavigation, defaultNavigationItems } from '@/components/mobile/SwipeNavigation';
import { logger } from '@/utils/logger';
export default function MobileShowcase(): React.ReactElement {
    // State management
    const bottomSheet = useBottomSheet();
    const [modalOpen, setModalOpen] = useState(false);
    const [actionSheetOpen, setActionSheetOpen] = useState(false);
    const [switchValue, setSwitchValue] = useState(false);
    const [checkboxValue, setCheckboxValue] = useState(false);
    const [segmentValue, setSegmentValue] = useState('all');
    const [activeTab, setActiveTab] = useState('home');
    const { recentSearches, addRecentSearch } = usePullToSearch();
    // Action sheet actions
    const actionSheetItems = [
        {
            id: 'share',
            label: 'Share',
            icon: <IconShare size={20}/>,
            onClick: () => toast.info('Share clicked')
        },
        {
            id: 'edit',
            label: 'Edit',
            icon: <IconEdit size={20}/>,
            onClick: () => toast.info('Edit clicked')
        },
        {
            id: 'delete',
            label: 'Delete',
            icon: <IconTrash size={20}/>,
            destructive: true,
            onClick: () => toast.error('Delete clicked')
        }
    ];
    // FAB actions
    const fabActions = [
        {
            id: 'add',
            label: 'Add Manga',
            icon: <IconBook size={20}/>,
            onClick: () => toast.success('Add manga clicked')
        },
        {
            id: 'download',
            label: 'Download',
            icon: <IconDownload size={20}/>,
            onClick: () => toast.info('Download clicked')
        }
    ];
    // Tab bar items
    const tabItems = [
        { id: 'home', label: 'Home', icon: <IconHome size={24}/> },
        { id: 'library', label: 'Library', icon: <IconBook size={24}/>, badge: 3 },
        { id: 'notifications', label: 'Alerts', icon: <IconBell size={24}/>, badge: '!' }
    ];
    return (<>
      <ToastContainer position="bottom"/>
      
      <PlatformNavBar title="Mobile Components" leftSection={<Button variant="subtle" size="sm">
            <IconMenu2 size={20}/>
          </Button>}/>

      
      <Container py="xl">
        <Stack gap="xl">
          <div>
            <Title order={2} mb="md">Mobile UI Components Showcase</Title>
            <Text c="dimmed">
              Interactive demo of all mobile-optimized components
            </Text>
          </div>
          
          {/* Bottom Sheet Demo */}
          <Card>
            <Title order={3} size="h4" mb="md">Bottom Sheet</Title>
            <Text size="sm" c="dimmed" mb="md">
              Swipeable bottom sheet with multiple snap points
            </Text>
            <Button onClick={bottomSheet.open}>Open Bottom Sheet</Button>
            
            <BottomSheet {...bottomSheet} onClose={bottomSheet.close}>
              <Stack p="md">
                <Title order={4}>Bottom Sheet Content</Title>
                <Text>Swipe down to dismiss or drag to different snap points.</Text>
                <Button onClick={bottomSheet.close}>Close</Button>
              </Stack>
            </BottomSheet>
          </Card>
          
          {/* Modal Demo */}
          <Card>
            <Title order={3} size="h4" mb="md">Mobile Modal</Title>
            <Text size="sm" c="dimmed" mb="md">
              Full-screen modal on mobile devices
            </Text>
            <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
            
            <MobileModal opened={modalOpen} onClose={() => setModalOpen(false)} headerTitle="Mobile Modal" showBackButton>

              <Stack p="md">
                <Text>This modal goes full-screen on mobile devices.</Text>
                <Text>Swipe right to go back on mobile.</Text>
              </Stack>
            </MobileModal>
          </Card>
          
          {/* Action Sheet Demo */}
          <Card>
            <Title order={3} size="h4" mb="md">Action Sheet</Title>
            <Text size="sm" c="dimmed" mb="md">
              iOS/Android style action sheet
            </Text>
            <Button onClick={() => setActionSheetOpen(true)}>Show Actions</Button>
            
            <ActionSheet opened={actionSheetOpen} onClose={() => setActionSheetOpen(false)} title="Choose an action" message="What would you like to do with this item?" actions={actionSheetItems}/>

          </Card>
          
          {/* Toast Demo */}
          <Card>
            <Title order={3} size="h4" mb="md">Mobile Toast</Title>
            <Text size="sm" c="dimmed" mb="md">
              Swipeable toast notifications
            </Text>
            <Group>
              <Button color="green" onClick={() => toast.success('Success message!')}>

                Success
              </Button>
              <Button color="red" onClick={() => toast.error('Error message!')}>

                Error
              </Button>
              <Button color="blue" onClick={() => toast.info('Info message with a longer text to show wrapping', {
            action: {
                label: 'Undo',
                onClick: () => logger.info('Undo clicked')
            }
        })}>

                With Action
              </Button>
            </Group>
          </Card>
          
          {/* Platform UI Components */}
          <Card>
            <Title order={3} size="h4" mb="md">Platform-Specific UI</Title>
            <Text size="sm" c="dimmed" mb="md">
              Components that adapt to iOS/Android conventions
            </Text>
            
            <Stack gap="md">
              <PlatformSwitch label="Platform Switch" checked={switchValue} onChange={setSwitchValue}/>

              
              <PlatformCheckbox label="Platform Checkbox" checked={checkboxValue} onChange={setCheckboxValue}/>

              
              <PlatformSegmentedControl value={segmentValue} onChange={setSegmentValue} data={[
            { label: 'All', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Completed', value: 'completed' }
        ]}/>

              
              <Stack gap={0}>
                <PlatformListItem leftSection={<Badge>1</Badge>} rightSection={<IconEdit size={20}/>} description="With description text" onClick={() => toast.info('List item clicked')}>

                  Platform List Item
                </PlatformListItem>
                <PlatformListItem leftSection={<Badge>2</Badge>} disabled>

                  Disabled Item
                </PlatformListItem>
              </Stack>
            </Stack>
          </Card>
          
          {/* Mobile Optimization Checklist */}
          <Card>
            <MobileOptimizationChecklist />
          </Card>
        </Stack>
      </Container>
      
      {/* Fixed elements */}
      <PullToSearch onSearch={(query) => {
            addRecentSearch(query);
            toast.info(`Searching for: ${query}`);
        }} recentSearches={recentSearches} trendingSearches={[
            { id: '1', text: 'One Piece', type: 'trending', count: 1000 },
            { id: '2', text: 'Naruto', type: 'trending', count: 800 }
        ]}/>

      
      <SwipeNavigation items={defaultNavigationItems} user={{
            name: 'Monkey D. Luffy',
            email: 'luffy@strawhat.com'
        }}/>

      
      <FloatingActionButton actions={fabActions} position="bottom-right" hideOnScroll/>

      
      <PlatformTabBar items={tabItems} activeId={activeTab} onChange={setActiveTab}/>

      
      {/* PWA Prompts (only show in production) */}
      {process.env.NODE_ENV === 'production' &&
            <>
          <PWAInstallPrompt />
          <AppUpdatePrompt changelog={[
                    'New mobile UI components',
                    'Improved performance',
                    'Bug fixes'
                ]}/>

        </>}
    </>);
}
