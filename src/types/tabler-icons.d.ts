/**
 * TypeScript type definitions for @tabler/icons-react
 * 
 * This file provides type definitions for all Tabler Icons
 * to ensure proper typing in the project.
 */

declare module '@tabler/icons-react' {
  import type { SVGAttributes, FC } from 'react';

  export interface TablerIconsProps extends SVGAttributes<SVGElement> {
    color?: string;
    size?: string | number;
    stroke?: string | number;
  }

  export type TablerIcon = FC<TablerIconsProps>;

  // Export all icon components
  export const IconPlus: TablerIcon;
  export const IconCheck: TablerIcon;
  export const IconX: TablerIcon;
  export const IconAlertCircle: TablerIcon;
  export const IconAlertTriangle: TablerIcon;
  export const IconRefresh: TablerIcon;
  export const IconSearch: TablerIcon;
  export const IconSettings: TablerIcon;
  export const IconDownload: TablerIcon;
  export const IconTrash: TablerIcon;
  export const IconEdit: TablerIcon;
  export const IconEye: TablerIcon;
  export const IconEyeOff: TablerIcon;
  export const IconChevronDown: TablerIcon;
  export const IconChevronUp: TablerIcon;
  export const IconChevronLeft: TablerIcon;
  export const IconChevronRight: TablerIcon;
  export const IconDots: TablerIcon;
  export const IconMenu2: TablerIcon;
  export const IconStar: TablerIcon;
  export const IconStarFilled: TablerIcon;
  export const IconBook: TablerIcon;
  export const IconBookmark: TablerIcon;
  export const IconCalendar: TablerIcon;
  export const IconFilter: TablerIcon;
  export const IconList: TablerIcon;
  export const IconTags: TablerIcon;
  export const IconUsers: TablerIcon;
  export const IconExternalLink: TablerIcon;
  export const IconHome: TablerIcon;
  export const IconArrowRight: TablerIcon;
  export const IconArrowLeft: TablerIcon;
  export const IconArrowUp: TablerIcon;
  export const IconArrowDown: TablerIcon;
  export const IconArrowBackUp: TablerIcon;
  export const IconArrowForwardUp: TablerIcon;
  export const IconInfoCircle: TablerIcon;
  export const IconClock: TablerIcon;
  export const IconClockHour4: TablerIcon;
  export const IconShare: TablerIcon;
  export const IconPhoto: TablerIcon;
  export const IconBrandGithub: TablerIcon;
  export const IconLogout: TablerIcon;
  export const IconLogin: TablerIcon;
  export const IconUser: TablerIcon;
  export const IconMail: TablerIcon;
  export const IconLock: TablerIcon;
  export const IconKey: TablerIcon;
  export const IconBrandGoogle: TablerIcon;
  export const IconDeviceDesktop: TablerIcon;
  export const IconDeviceMobile: TablerIcon;
  export const IconSun: TablerIcon;
  export const IconMoon: TablerIcon;
  export const IconZoomIn: TablerIcon;
  export const IconZoomOut: TablerIcon;
  export const IconBoxMultiple: TablerIcon;
  export const IconDatabase: TablerIcon;
  export const IconCloud: TablerIcon;
  export const IconCloudUpload: TablerIcon;
  export const IconCloudDownload: TablerIcon;
  export const IconFile: TablerIcon;
  export const IconFileUpload: TablerIcon;
  export const IconFileDownload: TablerIcon;
  export const IconFiles: TablerIcon;
  export const IconFolder: TablerIcon;
  export const IconFolderPlus: TablerIcon;
  export const IconFolderOff: TablerIcon;
  export const IconFolderSearch: TablerIcon;
  export const IconHeart: TablerIcon;
  export const IconHeartFilled: TablerIcon;
  export const IconThumbUp: TablerIcon;
  export const IconThumbDown: TablerIcon;
  export const IconCirclePlus: TablerIcon;
  export const IconCircleMinus: TablerIcon;
  export const IconCircleCheck: TablerIcon;
  export const IconCircleX: TablerIcon;
  export const IconMessages: TablerIcon;
  export const IconMessage: TablerIcon;
  export const IconMessagePlus: TablerIcon;
  export const IconMessageCircle: TablerIcon;
  export const IconSend: TablerIcon;
  export const IconDeviceFloppy: TablerIcon;
  export const IconCopy: TablerIcon;
  export const IconCut: TablerIcon;
  export const IconPaste: TablerIcon;
  export const IconPrinter: TablerIcon;
  export const IconAdjustments: TablerIcon;
  export const IconBell: TablerIcon;
  export const IconBellRinging: TablerIcon;
  export const IconAd2: TablerIcon;
  export const IconUserCircle: TablerIcon;
  export const IconUserPlus: TablerIcon;
  export const IconUserMinus: TablerIcon;
  export const IconLayoutGrid: TablerIcon;
  export const IconLayoutList: TablerIcon;
  export const IconLayoutCards: TablerIcon;
  export const IconBuildingStore: TablerIcon;
  export const IconScript: TablerIcon;
  export const IconShield: TablerIcon;
  export const IconShieldCheck: TablerIcon;
  export const IconShieldX: TablerIcon;
  export const IconServer: TablerIcon;
  export const IconDevices: TablerIcon;
  export const IconWifi: TablerIcon;
  export const IconWifiOff: TablerIcon;
  export const IconLockOpen: TablerIcon;
  export const IconLockOff: TablerIcon;
  export const IconMapPin: TablerIcon;
  export const IconWorld: TablerIcon;
  export const IconWorldUpload: TablerIcon;
  export const IconWorldDownload: TablerIcon;
  export const IconBug: TablerIcon;
  export const IconCode: TablerIcon;
  export const IconContainer: TablerIcon;
  export const IconRocket: TablerIcon;
  export const IconPower: TablerIcon;
  
  // Brand icons
  export const IconBrandTwitter: TablerIcon;
  export const IconBrandFacebook: TablerIcon;
  export const IconBrandInstagram: TablerIcon;
  export const IconBrandLinkedin: TablerIcon;
  export const IconBrandDiscord: TablerIcon;
  export const IconBrandReddit: TablerIcon;
  export const IconBrandSlack: TablerIcon;
  export const IconBrandTelegram: TablerIcon;
  export const IconBrandWhatsapp: TablerIcon;
  export const IconBrandYoutube: TablerIcon;
  export const IconBrandNetflix: TablerIcon;
  export const IconBrandSpotify: TablerIcon;
  export const IconBrandTinder: TablerIcon;
  export const IconBrandApple: TablerIcon;
  export const IconBrandAndroid: TablerIcon;
  export const IconBrandCash: TablerIcon;
  
  // Money and finance icons
  export const IconCreditCard: TablerIcon;
  export const IconCurrency: TablerIcon;
  export const IconCurrencyDollar: TablerIcon;
  export const IconCurrencyEuro: TablerIcon;
  export const IconCurrencyBitcoin: TablerIcon;
  
  // Chart icons
  export const IconChartBar: TablerIcon;
  export const IconChartLine: TablerIcon;
  export const IconChartPie: TablerIcon;
  export const IconPercentage: TablerIcon;
  
  // Mood icons
  export const IconMoodSmile: TablerIcon;
  export const IconMoodHappy: TablerIcon;
  export const IconMoodSad: TablerIcon;
  export const IconMoodCry: TablerIcon;
  export const IconMoodAngry: TablerIcon;
  export const IconMoodConfuzed: TablerIcon;
  
  // Additional icons (add any other icons you might need)
  export const IconLoad: TablerIcon;
  export const IconLoader: TablerIcon;
  export const IconLoader2: TablerIcon;
  export const IconLoader3: TablerIcon;
  export const IconReload: TablerIcon;
  export const IconHistory: TablerIcon;
  export const Icon24Hours: TablerIcon;
  export const IconPlug: TablerIcon;
  export const IconCloudStorm: TablerIcon;
  export const IconCloudRain: TablerIcon;
  export const IconCloudSnow: TablerIcon;
  export const IconCloudFog: TablerIcon;
  export const IconVideoPlus: TablerIcon;
  export const IconVideo: TablerIcon;
  export const IconMusicOff: TablerIcon;
  export const IconMusic: TablerIcon;
  export const IconVolume: TablerIcon;
  export const IconVolumeOff: TablerIcon;
  export const IconCamera: TablerIcon;
  export const IconCameraOff: TablerIcon;
  export const IconPlayerPause: TablerIcon;
  export const IconPlayerPlay: TablerIcon;
  export const IconPlayerRecord: TablerIcon;
  export const IconPlayerSkipBack: TablerIcon;
  export const IconPlayerSkipForward: TablerIcon;
  export const IconPlayerStop: TablerIcon;
  export const IconPlayerTrackNext: TablerIcon;
  export const IconPlayerTrackPrev: TablerIcon;
  export const IconRewindBackward5: TablerIcon;
  export const IconRewindBackward10: TablerIcon;
  export const IconRewindBackward15: TablerIcon;
  export const IconRewindBackward20: TablerIcon;
  export const IconRewindBackward30: TablerIcon;
  export const IconRewindForward5: TablerIcon;
  export const IconRewindForward10: TablerIcon;
  export const IconRewindForward15: TablerIcon;
  export const IconRewindForward20: TablerIcon;
  export const IconRewindForward30: TablerIcon;
  export const IconLanguage: TablerIcon;
  export const IconPuzzle: TablerIcon;
  export const IconId: TablerIcon;
  export const IconLicense: TablerIcon;
  
  // First batch of alias icons
  export const IconBooks: TablerIcon;
  export const IconBook2: TablerIcon;
  export const IconClockPlay: TablerIcon;
  export const IconActivity: TablerIcon;
  export const IconExclamationCircle: TablerIcon;
  export const IconApi: TablerIcon;
  export const IconHammer: TablerIcon;
  export const IconFileText: TablerIcon;
  export const IconRuler: TablerIcon;
  export const IconCalendarOff: TablerIcon;
  export const IconAspectRatio: TablerIcon;
  export const IconBookmarkOff: TablerIcon;
  export const IconTrophy: TablerIcon;
  export const IconLink: TablerIcon;
  export const IconTools: TablerIcon;
  export const IconPalette: TablerIcon;
  export const IconTerminal: TablerIcon;
  export const IconTerminal2: TablerIcon;
  export const IconBrandDocker: TablerIcon;
  export const IconChevronsDown: TablerIcon;
  export const IconChevronsUp: TablerIcon;
  export const IconArrowsExchange: TablerIcon;
  export const IconNetwork: TablerIcon;
  export const IconCpu: TablerIcon;
  export const IconSourceCode: TablerIcon;
  
  // Library view/sort/filter icons
  export const IconCircle: TablerIcon;
  export const IconProgress: TablerIcon;
  export const IconSortAscendingLetters: TablerIcon;
  export const IconSortDescendingLetters: TablerIcon;
  export const IconCalendarPlus: TablerIcon;
  export const IconArrowNarrowUp: TablerIcon;
  export const IconArrowNarrowDown: TablerIcon;
  export const IconSelector: TablerIcon;

  // Second batch of alias icons
  export const IconArrowsSort: TablerIcon;
  export const IconTable: TablerIcon;
  export const IconEyeCheck: TablerIcon;
  export const IconFileCheck: TablerIcon;
  export const IconAdjustmentsAlt: TablerIcon;
  export const IconFlag: TablerIcon;
  export const IconStarHalf: TablerIcon;
  export const IconCalendarStats: TablerIcon;
  export const IconUpload: TablerIcon;
  export const IconExclamationMark: TablerIcon;
  export const IconCrown: TablerIcon;
  export const IconPlugConnected: TablerIcon;
  export const IconPlugConnectedX: TablerIcon;
  export const IconColorPicker: TablerIcon;
  export const IconWorldWww: TablerIcon;
  export const IconDotsVertical: TablerIcon;
  export const IconTestPipe: TablerIcon;
  export const IconBrandAnime: TablerIcon;
  export const IconBuildingStore: TablerIcon;
  export const IconWrench: TablerIcon;
  export const IconBell: TablerIcon;
  export const IconBellOff: TablerIcon;
}
