// @file-size-justified: GraphQL operations file aggregating fragments + queries + mutations + subscriptions for the Suwayomi schema. Splitting would fragment the API surface and break tooling that relies on a single import point.
/**
 * Suwayomi GraphQL Operations
 *
 * Contains all GraphQL queries, mutations, and subscriptions for
 * interacting with the Suwayomi server's GraphQL API.
 *
 * @module suwayomi/graphql/operations
 */

// =============================================================================
// Fragments - Reusable Field Selections
// =============================================================================

/**
 * Core manga fields fragment
 */
export const MANGA_CORE_FIELDS = /* GraphQL */ `
  fragment MangaCoreFields on MangaType {
    id
    sourceId
    url
    title
    thumbnailUrl
    artist
    author
    description
    genre
    status
    inLibrary
    unreadCount
    downloadCount
  }
`;

/**
 * Full manga fields fragment
 */
export const MANGA_FULL_FIELDS = /* GraphQL */ `
  fragment MangaFullFields on MangaType {
    id
    sourceId
    url
    title
    thumbnailUrl
    thumbnailUrlLastFetched
    initialized
    artist
    author
    description
    genre
    status
    inLibrary
    inLibraryAt
    realUrl
    lastFetchedAt
    chaptersLastFetchedAt
    updateStrategy
    freshData
    unreadCount
    downloadCount
    chapterCount
    age
    source {
      id
      name
      lang
      iconUrl
    }
  }
`;

/**
 * Chapter fields fragment
 */
export const CHAPTER_FIELDS = /* GraphQL */ `
  fragment ChapterFields on ChapterType {
    id
    url
    name
    uploadDate
    chapterNumber
    scanlator
    mangaId
    isRead
    isBookmarked
    pageCount
    lastPageRead
    lastReadAt
    sourceOrder
    realUrl
    fetchedAt
    isDownloaded
  }
`;

/**
 * Source fields fragment
 */
export const SOURCE_FIELDS = /* GraphQL */ `
  fragment SourceFields on SourceType {
    id
    name
    lang
    iconUrl
    supportsLatest
    isConfigurable
    isNsfw
    displayName
  }
`;

/**
 * Extension fields fragment
 */
export const EXTENSION_FIELDS = /* GraphQL */ `
  fragment ExtensionFields on ExtensionType {
    pkgName
    name
    lang
    versionCode
    versionName
    iconUrl
    repo
    isNsfw
    isInstalled
    hasUpdate
    isObsolete
  }
`;

/**
 * Download status fields fragment
 */
export const DOWNLOAD_STATUS_FIELDS = /* GraphQL */ `
  fragment DownloadStatusFields on DownloadStatus {
    state
    queue {
      progress
      state
      tries
      chapter {
        id
        name
        chapterNumber
        mangaId
        manga {
          id
          title
          thumbnailUrl
        }
      }
    }
  }
`;

/**
 * Track record fields fragment
 */
export const TRACK_RECORD_FIELDS = /* GraphQL */ `
  fragment TrackRecordFields on TrackRecordType {
    id
    mangaId
    trackerId
    remoteId
    libraryId
    title
    lastChapterRead
    totalChapters
    score
    status
    startDate
    finishDate
    displayScore
  }
`;

// =============================================================================
// Queries - Data Fetching Operations
// =============================================================================

/**
 * Get single manga by ID
 */
export const GET_MANGA = /* GraphQL */ `
  ${MANGA_FULL_FIELDS}
  query GetManga($id: Int!) {
    manga(id: $id) {
      ...MangaFullFields
    }
  }
`;

/**
 * Get manga list with pagination
 */
export const GET_MANGAS = /* GraphQL */ `
  ${MANGA_CORE_FIELDS}
  query GetMangas(
    $first: Int
    $after: Cursor
    $filter: MangaFilterInput
    $orderBy: MangaOrderBy
  ) {
    mangas(
      first: $first
      after: $after
      filter: $filter
      orderBy: $orderBy
    ) {
      nodes {
        ...MangaCoreFields
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

/**
 * Get chapters for a manga
 */
export const GET_CHAPTERS = /* GraphQL */ `
  ${CHAPTER_FIELDS}
  query GetChapters(
    $mangaId: Int!
    $first: Int
    $after: Cursor
    $orderBy: ChapterOrderBy
  ) {
    chapters(
      condition: { mangaId: $mangaId }
      first: $first
      after: $after
      orderBy: $orderBy
    ) {
      nodes {
        ...ChapterFields
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

/**
 * Get single chapter by ID
 */
export const GET_CHAPTER = /* GraphQL */ `
  ${CHAPTER_FIELDS}
  query GetChapter($id: Int!) {
    chapter(id: $id) {
      ...ChapterFields
    }
  }
`;

/**
 * Get chapter page URLs
 */
export const GET_CHAPTER_PAGES = /* GraphQL */ `
  mutation GetChapterPages($chapterId: Int!) {
    fetchChapterPages(input: { chapterId: $chapterId }) {
      pages
    }
  }
`;

/**
 * Get all sources
 */
export const GET_SOURCES = /* GraphQL */ `
  ${SOURCE_FIELDS}
  query GetSources($filter: SourceFilterInput) {
    sources(filter: $filter) {
      nodes {
        ...SourceFields
        extension {
          pkgName
          isInstalled
          hasUpdate
        }
      }
      totalCount
    }
  }
`;

/**
 * Get all extensions
 */
export const GET_EXTENSIONS = /* GraphQL */ `
  ${EXTENSION_FIELDS}
  query GetExtensions($filter: ExtensionFilterInput) {
    extensions(filter: $filter) {
      nodes {
        ...ExtensionFields
      }
      totalCount
    }
  }
`;

/**
 * Get categories
 */
export const GET_CATEGORIES = /* GraphQL */ `
  query GetCategories {
    categories {
      nodes {
        id
        order
        name
        default
        includeInUpdate
        includeInDownload
      }
    }
  }
`;

/**
 * Get download status
 */
export const GET_DOWNLOAD_STATUS = /* GraphQL */ `
  ${DOWNLOAD_STATUS_FIELDS}
  query GetDownloadStatus {
    downloadStatus {
      ...DownloadStatusFields
    }
  }
`;

/**
 * Search manga in a source
 */
export const SEARCH_SOURCE_MANGA = /* GraphQL */ `
  ${MANGA_CORE_FIELDS}
  mutation SearchSourceManga(
    $sourceId: LongString!
    $query: String!
    $page: Int!
  ) {
    fetchSourceManga(
      input: {
        source: $sourceId
        query: $query
        page: $page
        type: SEARCH
      }
    ) {
      mangas {
        ...MangaCoreFields
        source {
          id
          name
          iconUrl
        }
      }
      hasNextPage
    }
  }
`;

/**
 * Get trackers
 */
export const GET_TRACKERS = /* GraphQL */ `
  query GetTrackers {
    trackers {
      nodes {
        id
        name
        icon
        isLoggedIn
        authUrl
        scores
        statuses {
          value
          name
        }
      }
    }
  }
`;

/**
 * Get manga track records
 */
export const GET_MANGA_TRACK_RECORDS = /* GraphQL */ `
  ${TRACK_RECORD_FIELDS}
  query GetMangaTrackRecords($mangaId: Int!) {
    manga(id: $mangaId) {
      id
      trackRecords {
        nodes {
          ...TrackRecordFields
          tracker {
            id
            name
            icon
          }
        }
      }
    }
  }
`;

/**
 * Server about query (health check)
 */
export const GET_SERVER_ABOUT = /* GraphQL */ `
  query GetServerAbout {
    aboutServer {
      name
      version
      revision
      buildType
      buildTime
      github
      discord
    }
  }
`;

// =============================================================================
// Mutations - Data Modification Operations
// =============================================================================

/**
 * Enqueue chapter downloads
 */
export const ENQUEUE_CHAPTER_DOWNLOADS = /* GraphQL */ `
  ${DOWNLOAD_STATUS_FIELDS}
  mutation EnqueueChapterDownloads($ids: [Int!]!) {
    enqueueChapterDownloads(input: { ids: $ids }) {
      downloadStatus {
        ...DownloadStatusFields
      }
    }
  }
`;

/**
 * Dequeue chapter downloads
 */
export const DEQUEUE_CHAPTER_DOWNLOADS = /* GraphQL */ `
  ${DOWNLOAD_STATUS_FIELDS}
  mutation DequeueChapterDownloads($ids: [Int!]!) {
    dequeueChapterDownloads(input: { ids: $ids }) {
      downloadStatus {
        ...DownloadStatusFields
      }
    }
  }
`;

/**
 * Start the downloader
 */
export const START_DOWNLOADER = /* GraphQL */ `
  ${DOWNLOAD_STATUS_FIELDS}
  mutation StartDownloader {
    startDownloader {
      downloadStatus {
        ...DownloadStatusFields
      }
    }
  }
`;

/**
 * Stop the downloader
 */
export const STOP_DOWNLOADER = /* GraphQL */ `
  ${DOWNLOAD_STATUS_FIELDS}
  mutation StopDownloader {
    stopDownloader {
      downloadStatus {
        ...DownloadStatusFields
      }
    }
  }
`;

/**
 * Clear the download queue
 */
export const CLEAR_DOWNLOADER = /* GraphQL */ `
  ${DOWNLOAD_STATUS_FIELDS}
  mutation ClearDownloader {
    clearDownloader {
      downloadStatus {
        ...DownloadStatusFields
      }
    }
  }
`;

/**
 * Delete downloaded chapter
 */
export const DELETE_DOWNLOADED_CHAPTER = /* GraphQL */ `
  mutation DeleteDownloadedChapter($id: Int!) {
    deleteDownloadedChapter(input: { id: $id }) {
      chapters {
        id
        isDownloaded
      }
    }
  }
`;

/**
 * Delete downloaded chapters
 */
export const DELETE_DOWNLOADED_CHAPTERS = /* GraphQL */ `
  mutation DeleteDownloadedChapters($ids: [Int!]!) {
    deleteDownloadedChapters(input: { ids: $ids }) {
      chapters {
        id
        isDownloaded
      }
    }
  }
`;

/**
 * Update chapter
 */
export const UPDATE_CHAPTER = /* GraphQL */ `
  ${CHAPTER_FIELDS}
  mutation UpdateChapter(
    $id: Int!
    $isRead: Boolean
    $isBookmarked: Boolean
    $lastPageRead: Int
  ) {
    updateChapter(
      input: {
        id: $id
        patch: {
          isRead: $isRead
          isBookmarked: $isBookmarked
          lastPageRead: $lastPageRead
        }
      }
    ) {
      chapter {
        ...ChapterFields
      }
    }
  }
`;

/**
 * Update chapters (batch)
 */
export const UPDATE_CHAPTERS = /* GraphQL */ `
  ${CHAPTER_FIELDS}
  mutation UpdateChapters(
    $ids: [Int!]!
    $isRead: Boolean
    $isBookmarked: Boolean
    $lastPageRead: Int
  ) {
    updateChapters(
      input: {
        ids: $ids
        patch: {
          isRead: $isRead
          isBookmarked: $isBookmarked
          lastPageRead: $lastPageRead
        }
      }
    ) {
      chapters {
        ...ChapterFields
      }
    }
  }
`;

/**
 * Fetch chapters from source
 */
export const FETCH_CHAPTERS = /* GraphQL */ `
  ${CHAPTER_FIELDS}
  mutation FetchChapters($mangaId: Int!) {
    fetchChapters(input: { mangaId: $mangaId }) {
      chapters {
        ...ChapterFields
      }
    }
  }
`;

/**
 * Fetch manga info from source
 */
export const FETCH_MANGA = /* GraphQL */ `
  ${MANGA_FULL_FIELDS}
  mutation FetchManga($id: Int!) {
    fetchManga(input: { id: $id }) {
      manga {
        ...MangaFullFields
      }
    }
  }
`;

/**
 * Install extension
 */
export const INSTALL_EXTENSION = /* GraphQL */ `
  ${EXTENSION_FIELDS}
  mutation InstallExtension($pkgName: String!) {
    updateExtension(input: { id: $pkgName, patch: { install: true } }) {
      extension {
        ...ExtensionFields
      }
    }
  }
`;

/**
 * Update extension
 */
export const UPDATE_EXTENSION = /* GraphQL */ `
  ${EXTENSION_FIELDS}
  mutation UpdateExtension($pkgName: String!) {
    updateExtension(input: { id: $pkgName }) {
      extension {
        ...ExtensionFields
      }
    }
  }
`;

/**
 * Uninstall extension
 */
export const UNINSTALL_EXTENSION = /* GraphQL */ `
  ${EXTENSION_FIELDS}
  mutation UninstallExtension($pkgName: String!) {
    updateExtension(input: { id: $pkgName, patch: { uninstall: true } }) {
      extension {
        ...ExtensionFields
      }
    }
  }
`;

/**
 * Fetch extension list (refresh)
 */
export const FETCH_EXTENSIONS = /* GraphQL */ `
  mutation FetchExtensions {
    fetchExtensions(input: {}) {
      extensions {
        pkgName
        name
        isInstalled
        hasUpdate
      }
    }
  }
`;

/**
 * Add manga to library
 */
export const ADD_MANGA_TO_LIBRARY = /* GraphQL */ `
  mutation AddMangaToLibrary($id: Int!) {
    updateManga(input: { id: $id, patch: { inLibrary: true } }) {
      manga {
        id
        inLibrary
      }
    }
  }
`;

/**
 * Remove manga from library
 */
export const REMOVE_MANGA_FROM_LIBRARY = /* GraphQL */ `
  mutation RemoveMangaFromLibrary($id: Int!) {
    updateManga(input: { id: $id, patch: { inLibrary: false } }) {
      manga {
        id
        inLibrary
      }
    }
  }
`;

/**
 * Bind tracker to manga
 */
export const BIND_TRACK = /* GraphQL */ `
  ${TRACK_RECORD_FIELDS}
  mutation BindTrack($mangaId: Int!, $trackerId: Int!, $remoteId: Long!) {
    bindTrack(
      input: {
        mangaId: $mangaId
        trackerId: $trackerId
        remoteId: $remoteId
      }
    ) {
      trackRecord {
        ...TrackRecordFields
      }
    }
  }
`;

/**
 * Update track record
 */
export const UPDATE_TRACK = /* GraphQL */ `
  ${TRACK_RECORD_FIELDS}
  mutation UpdateTrack(
    $recordId: Int!
    $status: Int
    $score: Float
    $lastChapterRead: Float
    $startDate: String
    $finishDate: String
  ) {
    updateTrack(
      input: {
        recordId: $recordId
        status: $status
        scoreString: $score
        lastChapterRead: $lastChapterRead
        startDate: $startDate
        finishDate: $finishDate
      }
    ) {
      trackRecord {
        ...TrackRecordFields
      }
    }
  }
`;

/**
 * Unbind tracker from manga
 */
export const UNBIND_TRACK = /* GraphQL */ `
  mutation UnbindTrack($recordId: Int!) {
    unbindTrack(input: { recordId: $recordId }) {
      trackRecord {
        id
      }
    }
  }
`;

/**
 * Start library update
 */
export const UPDATE_LIBRARY_MANGA = /* GraphQL */ `
  mutation UpdateLibraryManga($ids: [Int!]) {
    updateLibraryManga(input: { ids: $ids }) {
      updateStatus {
        isRunning
      }
    }
  }
`;

/**
 * Stop library update
 */
export const STOP_LIBRARY_UPDATE = /* GraphQL */ `
  mutation StopLibraryUpdate {
    stopUpdater {
      downloadStatus {
        state
      }
    }
  }
`;

// =============================================================================
// Subscriptions - Real-time Updates
// =============================================================================

/**
 * Subscribe to download status changes
 */
export const DOWNLOAD_STATUS_CHANGED = /* GraphQL */ `
  ${DOWNLOAD_STATUS_FIELDS}
  subscription DownloadStatusChanged {
    downloadChanged {
      ...DownloadStatusFields
    }
  }
`;

/**
 * Subscribe to library update status changes
 */
export const LIBRARY_UPDATE_STATUS_CHANGED = /* GraphQL */ `
  subscription LibraryUpdateStatusChanged {
    updateStatusChanged {
      isRunning
      completeJobs {
        mangaId
        status
      }
      failedJobs {
        mangaId
        status
      }
      pendingJobs {
        mangaId
        status
      }
      runningJobs {
        mangaId
        status
      }
      skippedJobs {
        mangaId
        status
      }
    }
  }
`;

/**
 * Subscribe to manga metadata updates
 */
export const MANGA_METADATA_CHANGED = /* GraphQL */ `
  subscription MangaMetadataChanged {
    updateMangaMetadata {
      manga {
        id
        title
        thumbnailUrl
        lastFetchedAt
      }
    }
  }
`;

// =============================================================================
// Operation Names Map (for logging and debugging)
// =============================================================================

export const OPERATION_NAMES = {
  // Queries
  GET_MANGA: 'GetManga',
  GET_MANGAS: 'GetMangas',
  GET_CHAPTERS: 'GetChapters',
  GET_CHAPTER: 'GetChapter',
  GET_CHAPTER_PAGES: 'GetChapterPages',
  GET_SOURCES: 'GetSources',
  GET_EXTENSIONS: 'GetExtensions',
  GET_CATEGORIES: 'GetCategories',
  GET_DOWNLOAD_STATUS: 'GetDownloadStatus',
  SEARCH_SOURCE_MANGA: 'SearchSourceManga',
  GET_TRACKERS: 'GetTrackers',
  GET_MANGA_TRACK_RECORDS: 'GetMangaTrackRecords',
  GET_SERVER_ABOUT: 'GetServerAbout',

  // Mutations
  ENQUEUE_CHAPTER_DOWNLOADS: 'EnqueueChapterDownloads',
  DEQUEUE_CHAPTER_DOWNLOADS: 'DequeueChapterDownloads',
  START_DOWNLOADER: 'StartDownloader',
  STOP_DOWNLOADER: 'StopDownloader',
  CLEAR_DOWNLOADER: 'ClearDownloader',
  DELETE_DOWNLOADED_CHAPTER: 'DeleteDownloadedChapter',
  DELETE_DOWNLOADED_CHAPTERS: 'DeleteDownloadedChapters',
  UPDATE_CHAPTER: 'UpdateChapter',
  UPDATE_CHAPTERS: 'UpdateChapters',
  FETCH_CHAPTERS: 'FetchChapters',
  FETCH_MANGA: 'FetchManga',
  INSTALL_EXTENSION: 'InstallExtension',
  UPDATE_EXTENSION: 'UpdateExtension',
  UNINSTALL_EXTENSION: 'UninstallExtension',
  FETCH_EXTENSIONS: 'FetchExtensions',
  ADD_MANGA_TO_LIBRARY: 'AddMangaToLibrary',
  REMOVE_MANGA_FROM_LIBRARY: 'RemoveMangaFromLibrary',
  BIND_TRACK: 'BindTrack',
  UPDATE_TRACK: 'UpdateTrack',
  UNBIND_TRACK: 'UnbindTrack',
  UPDATE_LIBRARY_MANGA: 'UpdateLibraryManga',
  STOP_LIBRARY_UPDATE: 'StopLibraryUpdate',

  // Subscriptions
  DOWNLOAD_STATUS_CHANGED: 'DownloadStatusChanged',
  LIBRARY_UPDATE_STATUS_CHANGED: 'LibraryUpdateStatusChanged',
  MANGA_METADATA_CHANGED: 'MangaMetadataChanged',
} as const;

export type OperationName = typeof OPERATION_NAMES[keyof typeof OPERATION_NAMES];
