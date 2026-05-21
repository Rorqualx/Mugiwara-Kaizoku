/**
 * Sample code demonstrating the core API structure for the Suwayomi headless backend
 */

package com.suwayomi.headless;

import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Main entry point for the Suwayomi headless backend
 */
public class SuwayomiBackend implements AutoCloseable {
    private final BackendConfig config;
    private final MangaManager mangaManager;
    private final ExtensionManager extensionManager;
    private final DownloadManager downloadManager;
    private final TrackingManager trackingManager;
    private final GraphQLServer graphQLServer;
    
    private boolean isRunning = false;
    
    private SuwayomiBackend(BackendConfig config) {
        this.config = config;
        this.mangaManager = new MangaManager(config);
        this.extensionManager = new ExtensionManager(config);
        this.downloadManager = new DownloadManager(config, mangaManager);
        this.trackingManager = new TrackingManager(config);
        this.graphQLServer = config.isGraphQLEnabled() ? 
            new GraphQLServer(config, this) : null;
    }
    
    /**
     * Creates a new Suwayomi backend instance
     * @param config Configuration for the backend
     * @return A new backend instance (not started)
     */
    public static SuwayomiBackend create(BackendConfig config) {
        return new SuwayomiBackend(config);
    }
    
    /**
     * Starts the backend and all associated services
     * @return This instance for method chaining
     */
    public synchronized SuwayomiBackend start() {
        if (isRunning) {
            return this;
        }
        
        // Initialize all services in proper order
        extensionManager.start();
        mangaManager.start();
        downloadManager.start();
        trackingManager.start();
        
        // Start GraphQL server if enabled
        if (graphQLServer != null) {
            graphQLServer.start();
        }
        
        isRunning = true;
        return this;
    }
    
    /**
     * Stops the backend and all associated services
     */
    public synchronized void stop() {
        if (!isRunning) {
            return;
        }
        
        // Stop services in reverse order
        if (graphQLServer != null) {
            graphQLServer.stop();
        }
        
        trackingManager.stop();
        downloadManager.stop();
        mangaManager.stop();
        extensionManager.stop();
        
        isRunning = false;
    }
    
    @Override
    public void close() {
        stop();
    }
    
    /**
     * @return The manga manager for direct API access
     */
    public MangaManager getMangaManager() {
        return mangaManager;
    }
    
    /**
     * @return The extension manager for direct API access
     */
    public ExtensionManager getExtensionManager() {
        return extensionManager;
    }
    
    /**
     * @return The download manager for direct API access
     */
    public DownloadManager getDownloadManager() {
        return downloadManager;
    }
    
    /**
     * @return The tracking manager for direct API access
     */
    public TrackingManager getTrackingManager() {
        return trackingManager;
    }
    
    /**
     * Builder for backend configuration
     */
    public static class BackendConfig {
        private Path dataDirectory;
        private Path downloadDirectory;
        private boolean graphQLEnabled = false;
        private int graphQLPort = 4567;
        private boolean extensionsEnabled = true;
        private boolean trackingEnabled = true;
        
        private BackendConfig() {}
        
        public static Builder builder() {
            return new Builder();
        }
        
        public Path getDataDirectory() {
            return dataDirectory;
        }
        
        public Path getDownloadDirectory() {
            return downloadDirectory;
        }
        
        public boolean isGraphQLEnabled() {
            return graphQLEnabled;
        }
        
        public int getGraphQLPort() {
            return graphQLPort;
        }
        
        public boolean isExtensionsEnabled() {
            return extensionsEnabled;
        }
        
        public boolean isTrackingEnabled() {
            return trackingEnabled;
        }
        
        /**
         * Builder for BackendConfig
         */
        public static class Builder {
            private final BackendConfig config = new BackendConfig();
            
            /**
             * Sets the data directory for the backend
             * @param path Directory to store data
             * @return This builder
             */
            public Builder withDataDirectory(Path path) {
                config.dataDirectory = path;
                return this;
            }
            
            /**
             * Sets the download directory for manga
             * @param path Directory to store downloads
             * @return This builder
             */
            public Builder withDownloadDirectory(Path path) {
                config.downloadDirectory = path;
                return this;
            }
            
            /**
             * Enables or disables the GraphQL API server
             * @param enabled Whether to enable GraphQL
             * @return This builder
             */
            public Builder withGraphQLEnabled(boolean enabled) {
                config.graphQLEnabled = enabled;
                return this;
            }
            
            /**
             * Sets the port for the GraphQL API server
             * @param port Port number
             * @return This builder
             */
            public Builder withGraphQLPort(int port) {
                config.graphQLPort = port;
                return this;
            }
            
            /**
             * Enables or disables extension loading
             * @param enabled Whether to enable extensions
             * @return This builder
             */
            public Builder withExtensionsEnabled(boolean enabled) {
                config.extensionsEnabled = enabled;
                return this;
            }
            
            /**
             * Enables or disables tracking services
             * @param enabled Whether to enable tracking
             * @return This builder
             */
            public Builder withTrackingEnabled(boolean enabled) {
                config.trackingEnabled = enabled;
                return this;
            }
            
            /**
             * Builds the configuration
             * @return The built configuration
             */
            public BackendConfig build() {
                // Validate configuration
                if (config.dataDirectory == null) {
                    throw new IllegalStateException("Data directory must be specified");
                }
                
                if (config.downloadDirectory == null) {
                    // Default to a downloads folder in the data directory
                    config.downloadDirectory = config.dataDirectory.resolve("downloads");
                }
                
                return config;
            }
        }
    }
}/**
 * Manages manga sources and library
 */
public class MangaManager {
    private final MangaService mangaService;
    private final ChapterService chapterService;
    
    MangaManager(BackendConfig config) {
        this.mangaService = new MangaServiceImpl(config);
        this.chapterService = new ChapterServiceImpl(config, this);
    }
    
    void start() {
        // Initialize services
    }
    
    void stop() {
        // Shutdown services
    }
    
    /**
     * @return Service for manga operations
     */
    public MangaService getMangaService() {
        return mangaService;
    }
    
    /**
     * @return Service for chapter operations
     */
    public ChapterService getChapterService() {
        return chapterService;
    }
}

/**
 * Manages extensions
 */
public class ExtensionManager {
    private final ExtensionService extensionService;
    
    ExtensionManager(BackendConfig config) {
        this.extensionService = new ExtensionServiceImpl(config);
    }
    
    void start() {
        // Initialize service
    }
    
    void stop() {
        // Shutdown service
    }
    
    /**
     * @return Service for extension operations
     */
    public ExtensionService getExtensionService() {
        return extensionService;
    }
}

/**
 * Manages downloading of manga chapters
 */
public class DownloadManager {
    private final DownloadService downloadService;
    
    DownloadManager(BackendConfig config, MangaManager mangaManager) {
        this.downloadService = new DownloadServiceImpl(config, mangaManager);
    }
    
    void start() {
        // Initialize service
    }
    
    void stop() {
        // Shutdown service
    }
    
    /**
     * @return Service for download operations
     */
    public DownloadService getDownloadService() {
        return downloadService;
    }
}

/**
 * Manages tracking services
 */
public class TrackingManager {
    private final TrackingService trackingService;
    
    TrackingManager(BackendConfig config) {
        this.trackingService = new TrackingServiceImpl(config);
    }
    
    void start() {
        // Initialize service
    }
    
    void stop() {
        // Shutdown service
    }
    
    /**
     * @return Service for tracking operations
     */
    public TrackingService getTrackingService() {
        return trackingService;
    }
}/**
 * Manga service interface
 */
public interface MangaService {
    /**
     * Gets manga by ID
     * @param id Manga ID
     * @return Manga if found, null otherwise
     */
    Manga getMangaById(String id);
    
    /**
     * Gets all manga in the library
     * @return List of library manga
     */
    List<Manga> getLibraryManga();
    
    /**
     * Gets manga from a source
     * @param sourceId Source ID
     * @param page Page number
     * @return List of manga
     */
    List<Manga> getMangaFromSource(String sourceId, int page);
    
    /**
     * Updates manga information from source
     * @param mangaId Manga ID
     * @return Updated manga
     */
    CompletableFuture<Manga> updateMangaInfo(String mangaId);
    
    /**
     * Adds manga to library
     * @param mangaId Manga ID
     * @return True if added successfully
     */
    boolean addMangaToLibrary(String mangaId);
    
    /**
     * Removes manga from library
     * @param mangaId Manga ID
     * @return True if removed successfully
     */
    boolean removeMangaFromLibrary(String mangaId);
}

/**
 * Chapter service interface
 */
public interface ChapterService {
    /**
     * Gets chapters for manga
     * @param mangaId Manga ID
     * @return List of chapters
     */
    List<Chapter> getChapters(String mangaId);
    
    /**
     * Marks a chapter as read or unread
     * @param chapterId Chapter ID
     * @param read Read status
     * @return True if updated successfully
     */
    boolean markChapterRead(String chapterId, boolean read);
    
    /**
     * Downloads a chapter
     * @param chapterId Chapter ID
     * @return Future completing when download finishes
     */
    CompletableFuture<Boolean> downloadChapter(String chapterId);
    
    /**
     * Gets pages for a chapter
     * @param chapterId Chapter ID
     * @return List of pages
     */
    List<Page> getChapterPages(String chapterId);
}

/**
 * Extension service interface
 */
public interface ExtensionService {
    /**
     * Gets installed extensions
     * @return List of installed extensions
     */
    List<Extension> getInstalledExtensions();
    
    /**
     * Gets available extensions
     * @return List of available extensions
     */
    List<Extension> getAvailableExtensions();
    
    /**
     * Installs an extension
     * @param pkgName Package name
     * @return Future completing when installation finishes
     */
    CompletableFuture<Boolean> installExtension(String pkgName);
    
    /**
     * Uninstalls an extension
     * @param pkgName Package name
     * @return True if uninstalled successfully
     */
    boolean uninstallExtension(String pkgName);
}/**
 * Download service interface
 */
public interface DownloadService {
    /**
     * Gets download queue
     * @return List of queued downloads
     */
    List<Download> getDownloadQueue();
    
    /**
     * Starts the download queue
     */
    void startDownloads();
    
    /**
     * Pauses the download queue
     */
    void pauseDownloads();
    
    /**
     * Cancels a download
     * @param downloadId Download ID
     * @return True if cancelled successfully
     */
    boolean cancelDownload(String downloadId);
}

/**
 * Tracking service interface
 */
public interface TrackingService {
    /**
     * Gets tracking services
     * @return List of tracking services
     */
    List<TrackingService> getTrackingServices();
    
    /**
     * Logs in to a tracking service
     * @param serviceId Service ID
     * @param username Username
     * @param password Password
     * @return True if logged in successfully
     */
    CompletableFuture<Boolean> login(String serviceId, String username, String password);
    
    /**
     * Binds manga to a tracking service
     * @param mangaId Manga ID
     * @param serviceId Service ID
     * @param trackingId Tracking ID
     * @return True if bound successfully
     */
    boolean bindManga(String mangaId, String serviceId, String trackingId);
    
    /**
     * Updates tracking status
     * @param mangaId Manga ID
     * @param serviceId Service ID
     * @param progress Reading progress
     * @return True if updated successfully
     */
    CompletableFuture<Boolean> updateTracking(String mangaId, String serviceId, int progress);
}

/**
 * Example of using the API to integrate with another application
 */
public class SuwayomiIntegrationExample {
    public static void main(String[] args) {
        // Configure the backend
        BackendConfig config = BackendConfig.builder()
            .withDataDirectory(Path.of("./data"))
            .withDownloadDirectory(Path.of("./downloads"))
            .withGraphQLEnabled(true)
            .withGraphQLPort(4567)
            .build();
        
        // Create and start the backend
        try (SuwayomiBackend backend = SuwayomiBackend.create(config).start()) {
            // Access manga service
            MangaService mangaService = backend.getMangaManager().getMangaService();
            
            // Get library manga
            List<Manga> library = mangaService.getLibraryManga();
            System.out.println("Library contains " + library.size() + " manga");
            
            // Access extension service
            ExtensionService extensionService = backend.getExtensionManager().getExtensionService();
            
            // Get installed extensions
            List<Extension> extensions = extensionService.getInstalledExtensions();
            System.out.println("Installed extensions: " + extensions.size());
            
            // Keep running until terminated
            System.out.println("Press Enter to stop");
            System.in.read();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}