package com.example.mangareader;

import com.suwayomi.headless.SuwayomiBackend;
import com.suwayomi.headless.BackendConfig;
import com.suwayomi.headless.MangaService;
import com.suwayomi.headless.ChapterService;
import com.suwayomi.headless.ExtensionService;
import com.suwayomi.headless.DownloadService;
import com.suwayomi.headless.TrackingService;
import com.suwayomi.headless.model.Manga;
import com.suwayomi.headless.model.Chapter;
import com.suwayomi.headless.model.Page;
import com.suwayomi.headless.model.Extension;
import com.suwayomi.headless.model.Source;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import java.util.logging.Logger;
import java.util.logging.Level;

/**
 * Example of integrating Suwayomi Headless into a custom manga reader application
 */
public class CustomMangaReaderApp {
    private static final Logger LOGGER = Logger.getLogger(CustomMangaReaderApp.class.getName());
    
    private final SuwayomiBackend suwayomiBackend;
    private final MangaService mangaService;
    private final ChapterService chapterService;
    private final ExtensionService extensionService;
    private final DownloadService downloadService;
    private final TrackingService trackingService;
    
    /**
     * Initialize the application
     */
    public CustomMangaReaderApp() {
        // Configure the Suwayomi backend
        BackendConfig config = BackendConfig.builder()
            .withDataDirectory(getAppDataPath())
            .withDownloadDirectory(getDownloadsPath())
            .withExtensionsEnabled(true)
            .withTrackingEnabled(true)
            .withGraphQLEnabled(false) // We'll use the direct API instead of GraphQL
            .build();
        
        // Create and start the backend
        suwayomiBackend = SuwayomiBackend.create(config);
        
        // Get service references
        mangaService = suwayomiBackend.getMangaManager().getMangaService();
        chapterService = suwayomiBackend.getMangaManager().getChapterService();
        extensionService = suwayomiBackend.getExtensionManager().getExtensionService();
        downloadService = suwayomiBackend.getDownloadManager().getDownloadService();
        trackingService = suwayomiBackend.getTrackingManager().getTrackingService();
        
        // Register shutdown hook
        Runtime.getRuntime().addShutdownHook(new Thread(this::shutdown));
    }    /**
     * Start the application
     */
    public void start() {
        LOGGER.info("Starting Custom Manga Reader");
        
        try {
            // Start the Suwayomi backend
            suwayomiBackend.start();
            LOGGER.info("Suwayomi backend started successfully");
            
            // Initialize other application components
            initializeUI();
            loadUserPreferences();
            
            // Load initial data
            loadLibrary();
            
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Failed to start application", e);
            shutdown();
        }
    }
    
    /**
     * Shutdown the application
     */
    public void shutdown() {
        LOGGER.info("Shutting down Custom Manga Reader");
        
        try {
            // Save application state
            saveUserPreferences();
            
            // Stop the Suwayomi backend
            suwayomiBackend.stop();
            LOGGER.info("Suwayomi backend stopped successfully");
            
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Error during shutdown", e);
        }
    }
    
    /**
     * Initialize the application UI
     */
    private void initializeUI() {
        // Implementation depends on your UI framework
        // This could be JavaFX, Swing, Android, etc.
    }
    
    /**
     * Load user preferences
     */
    private void loadUserPreferences() {
        // Load application-specific preferences
    }
    
    /**
     * Save user preferences
     */
    private void saveUserPreferences() {
        // Save application-specific preferences
    }
    
    /**
     * Get the application data directory
     */
    private Path getAppDataPath() {
        String userHome = System.getProperty("user.home");
        return Paths.get(userHome, ".customMangaReader");
    }
    
    /**
     * Get the downloads directory
     */
    private Path getDownloadsPath() {
        String userHome = System.getProperty("user.home");
        return Paths.get(userHome, ".customMangaReader", "downloads");
    }    //-----------------------------------------------------------------------------
    // Library Management
    //-----------------------------------------------------------------------------
    
    /**
     * Load the manga library
     */
    public void loadLibrary() {
        List<Manga> library = mangaService.getLibraryManga();
        LOGGER.info("Loaded " + library.size() + " manga from library");
        
        // Process library data for the application
        // This could involve updating UI, caching data, etc.
    }
    
    /**
     * Add manga to library
     */
    public boolean addToLibrary(String mangaId) {
        boolean success = mangaService.addMangaToLibrary(mangaId);
        if (success) {
            LOGGER.info("Added manga to library: " + mangaId);
        } else {
            LOGGER.warning("Failed to add manga to library: " + mangaId);
        }
        return success;
    }
    
    /**
     * Remove manga from library
     */
    public boolean removeFromLibrary(String mangaId) {
        boolean success = mangaService.removeMangaFromLibrary(mangaId);
        if (success) {
            LOGGER.info("Removed manga from library: " + mangaId);
        } else {
            LOGGER.warning("Failed to remove manga from library: " + mangaId);
        }
        return success;
    }
    
    /**
     * Update manga information
     */
    public CompletableFuture<Manga> updateManga(String mangaId) {
        return mangaService.updateMangaInfo(mangaId)
            .thenApply(manga -> {
                LOGGER.info("Updated manga info: " + manga.getTitle());
                return manga;
            })
            .exceptionally(e -> {
                LOGGER.log(Level.WARNING, "Failed to update manga: " + mangaId, e);
                return null;
            });
    }    //-----------------------------------------------------------------------------
    // Chapter Management
    //-----------------------------------------------------------------------------
    
    /**
     * Get chapters for manga
     */
    public List<Chapter> getChapters(String mangaId) {
        List<Chapter> chapters = chapterService.getChapters(mangaId);
        LOGGER.info("Got " + chapters.size() + " chapters for manga: " + mangaId);
        return chapters;
    }
    
    /**
     * Mark chapter as read
     */
    public boolean markChapterRead(String chapterId, boolean read) {
        boolean success = chapterService.markChapterRead(chapterId, read);
        String status = read ? "read" : "unread";
        if (success) {
            LOGGER.info("Marked chapter as " + status + ": " + chapterId);
        } else {
            LOGGER.warning("Failed to mark chapter as " + status + ": " + chapterId);
        }
        return success;
    }
    
    /**
     * Download chapter
     */
    public CompletableFuture<Boolean> downloadChapter(String chapterId) {
        return chapterService.downloadChapter(chapterId)
            .thenApply(success -> {
                if (success) {
                    LOGGER.info("Downloaded chapter: " + chapterId);
                } else {
                    LOGGER.warning("Failed to download chapter: " + chapterId);
                }
                return success;
            })
            .exceptionally(e -> {
                LOGGER.log(Level.WARNING, "Error downloading chapter: " + chapterId, e);
                return false;
            });
    }
    
    /**
     * Get pages for chapter
     */
    public List<Page> getChapterPages(String chapterId) {
        List<Page> pages = chapterService.getChapterPages(chapterId);
        LOGGER.info("Got " + pages.size() + " pages for chapter: " + chapterId);
        return pages;
    }    //-----------------------------------------------------------------------------
    // Extension Management
    //-----------------------------------------------------------------------------
    
    /**
     * Get installed extensions
     */
    public List<Extension> getInstalledExtensions() {
        List<Extension> extensions = extensionService.getInstalledExtensions();
        LOGGER.info("Got " + extensions.size() + " installed extensions");
        return extensions;
    }
    
    /**
     * Get available extensions
     */
    public List<Extension> getAvailableExtensions() {
        List<Extension> extensions = extensionService.getAvailableExtensions();
        LOGGER.info("Got " + extensions.size() + " available extensions");
        return extensions;
    }
    
    /**
     * Install extension
     */
    public CompletableFuture<Boolean> installExtension(String pkgName) {
        return extensionService.installExtension(pkgName)
            .thenApply(success -> {
                if (success) {
                    LOGGER.info("Installed extension: " + pkgName);
                } else {
                    LOGGER.warning("Failed to install extension: " + pkgName);
                }
                return success;
            })
            .exceptionally(e -> {
                LOGGER.log(Level.WARNING, "Error installing extension: " + pkgName, e);
                return false;
            });
    }
    
    /**
     * Uninstall extension
     */
    public boolean uninstallExtension(String pkgName) {
        boolean success = extensionService.uninstallExtension(pkgName);
        if (success) {
            LOGGER.info("Uninstalled extension: " + pkgName);
        } else {
            LOGGER.warning("Failed to uninstall extension: " + pkgName);
        }
        return success;
    }    //-----------------------------------------------------------------------------
    // Tracking Management
    //-----------------------------------------------------------------------------
    
    /**
     * Login to tracking service
     */
    public CompletableFuture<Boolean> loginTrackingService(String serviceId, String username, String password) {
        return trackingService.login(serviceId, username, password)
            .thenApply(success -> {
                if (success) {
                    LOGGER.info("Logged in to tracking service: " + serviceId);
                } else {
                    LOGGER.warning("Failed to log in to tracking service: " + serviceId);
                }
                return success;
            })
            .exceptionally(e -> {
                LOGGER.log(Level.WARNING, "Error logging in to tracking service: " + serviceId, e);
                return false;
            });
    }
    
    /**
     * Bind manga to tracking service
     */
    public boolean bindMangaToTracking(String mangaId, String serviceId, String trackingId) {
        boolean success = trackingService.bindManga(mangaId, serviceId, trackingId);
        if (success) {
            LOGGER.info("Bound manga to tracking service: " + mangaId + " -> " + serviceId);
        } else {
            LOGGER.warning("Failed to bind manga to tracking service: " + mangaId + " -> " + serviceId);
        }
        return success;
    }
    
    /**
     * Update tracking progress
     */
    public CompletableFuture<Boolean> updateTrackingProgress(String mangaId, String serviceId, int progress) {
        return trackingService.updateTracking(mangaId, serviceId, progress)
            .thenApply(success -> {
                if (success) {
                    LOGGER.info("Updated tracking progress: " + mangaId + " -> " + progress);
                } else {
                    LOGGER.warning("Failed to update tracking progress: " + mangaId);
                }
                return success;
            })
            .exceptionally(e -> {
                LOGGER.log(Level.WARNING, "Error updating tracking progress: " + mangaId, e);
                return false;
            });
    }    //-----------------------------------------------------------------------------
    // Custom Functionality 
    //-----------------------------------------------------------------------------
    
    /**
     * Example of custom functionality built on top of Suwayomi
     * Get manga recommendations based on user's library
     */
    public List<Manga> getRecommendations() {
        // Get user's library
        List<Manga> library = mangaService.getLibraryManga();
        
        // Extract genres from library
        List<String> preferredGenres = library.stream()
            .flatMap(manga -> manga.getGenres().stream())
            .distinct()
            .collect(Collectors.toList());
        
        // Get popular manga from sources
        List<Manga> popularManga = new java.util.ArrayList<>();
        List<Extension> extensions = extensionService.getInstalledExtensions();
        
        for (Extension extension : extensions) {
            for (Source source : extension.getSources()) {
                // Get popular manga from source
                List<Manga> sourceManga = mangaService.getMangaFromSource(source.getId(), 1);
                popularManga.addAll(sourceManga);
            }
        }
        
        // Filter manga that match user's preferred genres but aren't in library
        List<String> libraryIds = library.stream()
            .map(Manga::getId)
            .collect(Collectors.toList());
        
        return popularManga.stream()
            .filter(manga -> !libraryIds.contains(manga.getId()))
            .filter(manga -> manga.getGenres().stream().anyMatch(preferredGenres::contains))
            .distinct()
            .limit(10)
            .collect(Collectors.toList());
    }
    
    /**
     * Search across all sources
     */
    public List<Manga> searchAllSources(String query) {
        List<Manga> results = new java.util.ArrayList<>();
        List<Extension> extensions = extensionService.getInstalledExtensions();
        
        for (Extension extension : extensions) {
            for (Source source : extension.getSources()) {
                // Use the source's search functionality
                // Note: This is a simplified example, actual implementation would depend on Suwayomi's API
                results.addAll(searchSource(source.getId(), query));
            }
        }
        
        return results;
    }    /**
     * Search a specific source
     */
    private List<Manga> searchSource(String sourceId, String query) {
        // Implementation would use Suwayomi's API
        // This is a placeholder
        return new java.util.ArrayList<>();
    }
    
    /**
     * Main entry point
     */
    public static void main(String[] args) {
        CustomMangaReaderApp app = new CustomMangaReaderApp();
        app.start();
    }
}