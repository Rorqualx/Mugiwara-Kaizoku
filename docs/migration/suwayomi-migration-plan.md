# Suwayomi Headless Migration Plan

## Executive Summary

This document outlines a comprehensive plan to transform Suwayomi from a full-stack application with bundled UI components into a headless backend module that can be integrated into larger applications. The migration will preserve all core manga management functionality while removing UI visualization components, resulting in a flexible API-driven backend that can be embedded as a module within other Java/Kotlin applications.

## 1. Project Analysis & Requirements

### 1.1 Current Architecture Analysis

Based on the Suwayomi project structure, the application currently consists of:

- **Suwayomi-Server**: Java-based server component that:
  - Manages manga sources through Tachiyomi extensions
  - Handles library management and downloads
  - Provides a GraphQL API
  - Includes WebUI bundling and serving capabilities

- **Multiple UI Clients**: WebUI (default), VUI (Svelte), JUI (Compose), Sorayomi (Flutter), etc.

### 1.2 Target Architecture Requirements

The migration aims to:

1. Remove all UI visualization components
2. Retain all manga management functionality
3. Create clean APIs for integration with other applications
4. Support programmatic initialization and configuration
5. Allow embedding as a library/module in larger Java/Kotlin projects
6. Maintain support for extensions and tracking services

## 2. Migration Approach

### 2.1 High-Level Strategy

The migration will follow these strategic principles:

1. **Modular Extraction**: Identify and extract core functionality from UI components
2. **Clean API Design**: Create well-documented APIs for all functionality
3. **Configuration Flexibility**: Support both file-based and programmatic configuration
4. **Backward Compatibility**: Maintain support for existing extensions and data formats
5. **Progressive Migration**: Implement changes in phases to allow for testing at each stage

### 2.2 Expected Benefits

- **Reduced Resource Usage**: Removal of web servers and UI handlers
- **Simplified Integration**: Direct API access rather than HTTP calls
- **Better Testability**: Programmatic APIs enable better automated testing
- **Focused Development**: Backend features can evolve independently

## 3. Implementation Plan

### Phase 1: Analysis & Preparation (Week 1-2)

#### 3.1.1 Code Analysis

1. Identify UI-specific components:
   - WebUI bundling and serving components
   - Browser launching code
   - UI-specific API endpoints
   - ElectronJS integration points

2. Map core functionality dependencies:
   - Extension loading and management
   - Manga and chapter data handling
   - Download management
   - Tracking service integration

#### 3.1.2 Setup Testing Framework

1. Create integration test suite to validate core functionality
2. Establish baseline metrics for performance comparison
3. Document API usage patterns for key functions

#### 3.1.3 Dependency Analysis

```
# Create dependency graphs for major components
./gradlew dependencies > dependencies.txt

# Analyze JAR sizes to identify UI components
find . -name "*.jar" -exec du -h {} \; | sort -hr
```

### Phase 2: Core Backend Isolation (Week 3-4)

#### 3.2.1 Separate Server Configuration

1. Create dedicated backend configuration class:

```java
public class SuwayomiBackendConfig {
    private final int port;
    private final String downloadPath;
    private final boolean trackingEnabled;
    // Other configuration properties
    
    private SuwayomiBackendConfig(Builder builder) {
        this.port = builder.port;
        this.downloadPath = builder.downloadPath;
        this.trackingEnabled = builder.trackingEnabled;
        // Initialize other properties
    }
    
    public static class Builder {
        private int port = 4567; // Default value
        private String downloadPath = "./downloads";
        private boolean trackingEnabled = true;
        
        public Builder port(int port) {
            this.port = port;
            return this;
        }
        
        public Builder downloadPath(String path) {
            this.downloadPath = path;
            return this;
        }
        
        public Builder trackingEnabled(boolean enabled) {
            this.trackingEnabled = enabled;
            return this;
        }
        
        public SuwayomiBackendConfig build() {
            return new SuwayomiBackendConfig(this);
        }
    }
    
    // Getters for properties
}
```

2. Update `server-reference.conf` to remove UI-specific settings:

```
# REMOVE these settings
server.webUIEnabled = true
server.webUIFlavor = "WebUI"
server.initialOpenInBrowserEnabled = true
server.webUIInterface = "browser"
server.electronPath = ""
server.webUIChannel = "stable"
server.webUIUpdateCheckInterval = 23

# KEEP core server settings
server.ip = "0.0.0.0"
server.port = 4567
server.socksProxyEnabled = false
# ... other core settings
```

#### 3.2.2 Remove UI-Specific Code

1. Identify and remove WebUI resource handling:

```
# Files likely to contain WebUI handling logic
find . -name "*.java" -o -name "*.kt" | xargs grep -l "webui"
find . -name "*.java" -o -name "*.kt" | xargs grep -l "WebUI"
```

2. Remove browser launching code:

```java
// REMOVE code like this:
if (serverConfig.getInitialOpenInBrowserEnabled()) {
    Desktop.getDesktop().browse(new URI("http://localhost:" + serverConfig.getPort()));
}
```

3. Remove WebUI download and update mechanism:

```
# Look for classes handling WebUI updates
find . -name "*.java" -o -name "*.kt" | xargs grep -l "updateWebUI"
```

#### 3.2.3 Create Module Initialization API

Create a clean module initialization API:

```java
public class SuwayomiBackend {
    private final SuwayomiBackendConfig config;
    private boolean running = false;
    
    private SuwayomiBackend(SuwayomiBackendConfig config) {
        this.config = config;
    }
    
    public static SuwayomiBackend create(SuwayomiBackendConfig config) {
        return new SuwayomiBackend(config);
    }
    
    public synchronized void start() {
        if (running) {
            return;
        }
        
        // Initialize core services
        initializeExtensionManager();
        initializeMangaManager();
        initializeDownloadManager();
        initializeTrackingServices();
        
        // Start required background services
        startUpdateChecker();
        startDownloadQueue();
        
        // Start GraphQL API (without web UI)
        startApiServer();
        
        running = true;
    }
    
    public synchronized void shutdown() {
        if (!running) {
            return;
        }
        
        // Shutdown all services in reverse order
        stopApiServer();
        stopDownloadQueue();
        stopUpdateChecker();
        
        running = false;
    }
    
    // Service accessor methods
    public MangaManager getMangaManager() {
        return mangaManager;
    }
    
    public ExtensionManager getExtensionManager() {
        return extensionManager;
    }
    
    // Other implementation details
}
```

### Phase 3: API Layer Refinement (Week 5-6)

#### 3.3.1 GraphQL Schema Updates

1. Review and refine the GraphQL schema to focus on data operations
2. Remove any UI-specific fields or types
3. Ensure all necessary operations are exposed for headless usage

```graphql
# Example of refined GraphQL schema (partial)
type Manga {
  id: ID!
  title: String!
  thumbnailUrl: String
  status: MangaStatus!
  inLibrary: Boolean!
  description: String
  author: String
  genre: [String!]
  chapters: [Chapter!]
}

type Chapter {
  id: ID!
  name: String!
  uploadDate: DateTime
  isRead: Boolean!
  pageCount: Int
  isDownloaded: Boolean!
}

type Query {
  # Core data operations
  manga(id: ID!): Manga
  mangaList(filter: MangaFilter): [Manga!]!
  extensions: [Extension!]!
  sources: [Source!]!
  
  # Remove UI-specific operations like
  # uiPreferences, etc.
}

type Mutation {
  updateManga(id: ID!): Manga!
  updateChapter(id: ID!): Chapter!
  downloadChapter(id: ID!): Boolean!
  markChapterRead(id: ID!, read: Boolean!): Boolean!
  
  # Remove UI-specific mutations
}
```

#### 3.3.2 Service Layer Definition

Create clean service interfaces for all major functionality:

```java
// Manga Service Interface
public interface MangaService {
    Manga getMangaById(String id);
    List<Manga> getLibraryManga();
    List<Manga> getMangaFromSource(String sourceId, int page);
    CompletableFuture<Manga> updateMangaInfo(String mangaId);
    boolean addMangaToLibrary(String mangaId);
    boolean removeMangaFromLibrary(String mangaId);
    // Other manga-related operations
}

// Extension Service Interface
public interface ExtensionService {
    List<Extension> getInstalledExtensions();
    CompletableFuture<Boolean> installExtension(String pkgName);
    boolean uninstallExtension(String pkgName);
    List<Extension> getAvailableExtensions();
    // Other extension-related operations
}

// Chapter Service Interface
public interface ChapterService {
    List<Chapter> getChapters(String mangaId);
    boolean markChapterRead(String chapterId, boolean read);
    CompletableFuture<Boolean> downloadChapter(String chapterId);
    List<Page> getChapterPages(String chapterId);
    // Other chapter-related operations
}
```

#### 3.3.3 Update Build Configuration

Update Gradle build files to create a library/module artifact:

```gradle
// In build.gradle
apply plugin: 'java-library'
apply plugin: 'maven-publish'

// Configure library JAR
jar {
    archiveBaseName = 'suwayomi-headless'
    manifest {
        attributes(
            'Implementation-Title': 'Suwayomi Headless',
            'Implementation-Version': version
        )
    }
}

// Create sources JAR for better IDE integration
task sourcesJar(type: Jar) {
    archiveClassifier.set('sources')
    from sourceSets.main.allJava
}

// Create Javadoc JAR
task javadocJar(type: Jar) {
    archiveClassifier.set('javadoc')
    from javadoc.destinationDir
}

// Configure publishing
publishing {
    publications {
        mavenJava(MavenPublication) {
            from components.java
            artifact sourcesJar
            artifact javadocJar
            
            pom {
                name = 'Suwayomi Headless'
                description = 'Headless manga management backend based on Suwayomi'
                // Other POM configuration
            }
        }
    }
}
```

### Phase 4: Integration & Testing (Week 7-8)

#### 3.4.1 Sample Integration Code

Create documentation and sample code for integrating the headless backend:

```java
// Example: Integrating Suwayomi Headless into an application
public class MyMangaApplication {
    private SuwayomiBackend suwayomiBackend;
    
    public void initialize() {
        // Configure the backend
        SuwayomiBackendConfig config = new SuwayomiBackendConfig.Builder()
            .port(4567)
            .downloadPath("./manga-downloads")
            .trackingEnabled(true)
            .build();
            
        // Create and start the backend
        suwayomiBackend = SuwayomiBackend.create(config);
        suwayomiBackend.start();
        
        // Register shutdown hook
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            suwayomiBackend.shutdown();
        }));
    }
    
    public void displayLibrary() {
        // Access manga library through the service
        MangaService mangaService = suwayomiBackend.getMangaManager().getMangaService();
        List<Manga> library = mangaService.getLibraryManga();
        
        // Process library data in the application
        for (Manga manga : library) {
            System.out.println(manga.getTitle());
        }
    }
    
    // Other application code
}
```

#### 3.4.2 Integration Testing

Create comprehensive tests to validate the headless backend functionality:

```java
public class SuwayomiHeadlessIntegrationTest {
    private static SuwayomiBackend backend;
    
    @BeforeClass
    public static void setupBackend() {
        SuwayomiBackendConfig config = new SuwayomiBackendConfig.Builder()
            .port(4567)
            .downloadPath("./test-downloads")
            .build();
            
        backend = SuwayomiBackend.create(config);
        backend.start();
    }
    
    @AfterClass
    public static void shutdownBackend() {
        if (backend != null) {
            backend.shutdown();
        }
    }
    
    @Test
    public void testExtensionInstallation() {
        ExtensionService extensionService = 
            backend.getExtensionManager().getExtensionService();
            
        // Get available extensions
        List<Extension> available = extensionService.getAvailableExtensions();
        assumeTrue("No extensions available for testing", !available.isEmpty());
        
        // Install the first available extension
        String pkgName = available.get(0).getPackageName();
        CompletableFuture<Boolean> installFuture = 
            extensionService.installExtension(pkgName);
            
        // Wait for installation to complete
        boolean success = installFuture.join();
        assertTrue("Extension installation failed", success);
        
        // Verify the extension is installed
        List<Extension> installed = extensionService.getInstalledExtensions();
        boolean found = installed.stream()
            .anyMatch(e -> e.getPackageName().equals(pkgName));
        assertTrue("Installed extension not found", found);
    }
    
    // Additional tests for manga, chapters, downloads, etc.
}
```

## 4. Implementation Tasks Breakdown

### 4.1 Server Core Refactoring

| Task | Description | Priority | Effort |
|------|-------------|----------|--------|
| Remove WebUI bundling | Delete code that bundles WebUI with server | High | 3 days |
| Refactor server initialization | Create clean initialization without browser launching | High | 2 days |
| Remove UI resource serving | Eliminate code that serves UI resources | High | 2 days |
| Update configuration handling | Support both file and programmatic configuration | Medium | 3 days |
| Refactor logging system | Ensure proper logging for headless operation | Medium | 1 day |

### 4.2 API Layer Development

| Task | Description | Priority | Effort |
|------|-------------|----------|--------|
| Clean service interfaces | Create well-defined service interfaces | High | 4 days |
| GraphQL schema refinement | Remove UI-specific operations from GraphQL | High | 3 days |
| Implement builder patterns | Create fluent APIs for configuration | Medium | 2 days |
| Documentation | Document APIs and integration patterns | Medium | 3 days |
| Error handling improvements | Ensure proper error propagation | Medium | 2 days |

### 4.3 Build & Packaging

| Task | Description | Priority | Effort |
|------|-------------|----------|--------|
| Update Gradle configuration | Configure for library/module output | High | 1 day |
| Create Maven artifacts | Configure publishing of library | Medium | 1 day |
| Dependency optimization | Reduce unnecessary dependencies | Medium | 2 days |
| Version compatibility | Ensure compatibility with various Java versions | Low | 2 days |

### 4.4 Testing & Validation

| Task | Description | Priority | Effort |
|------|-------------|----------|--------|
| Create integration tests | Test core functionality | High | 4 days |
| Performance testing | Measure resource usage improvements | Medium | 2 days |
| Sample application | Create sample app using the module | Medium | 3 days |
| Migration documentation | Document migration from full to headless | Medium | 2 days |

## 5. Migration Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking extension compatibility | High | Medium | Create compatibility layer; thorough testing with popular extensions |
| Performance degradation | Medium | Low | Performance testing at each phase; optimization where needed |
| Incomplete API exposure | High | Medium | Comprehensive analysis of UI requirements; thorough testing |
| Data migration issues | High | Low | Create data migration utilities; maintain backward compatibility |
| Incomplete removal of UI dependencies | Medium | Medium | Dependency analysis; automated testing |

## 6. Timeline & Milestones

### Milestone 1: Analysis Complete (End of Week 2)
- ✓ Full code analysis completed
- ✓ UI components identified
- ✓ Core dependencies mapped
- ✓ Test framework established

### Milestone 2: Core Backend Isolated (End of Week 4)
- ✓ UI-specific code removed
- ✓ Server configuration refactored
- ✓ Initial API design completed
- ✓ Basic initialization working

### Milestone 3: API Layer Completed (End of Week 6)
- ✓ GraphQL schema refined
- ✓ Service interfaces implemented
- ✓ Build configuration updated
- ✓ Basic integration test passing

### Milestone 4: Full Integration Ready (End of Week 8)
- ✓ All tests passing
- ✓ Documentation completed
- ✓ Sample application working
- ✓ Performance validated
- ✓ First release candidate available

## 7. Future Considerations

- **Plugin System**: Consider implementing a plugin system for extending functionality
- **Multiple API Versions**: Support for versioned APIs to ease future transitions
- **Client SDK**: Develop client SDKs for common languages to simplify integration
- **Performance Optimization**: Targeted performance improvements for headless operation
- **Containerization**: Optimized container images for headless deployment

## 8. Conclusion

This migration plan outlines a comprehensive approach to transforming Suwayomi from a full-stack application with UI components to a headless backend module. By following this plan, the project will preserve its core manga management capabilities while becoming more flexible for integration into larger applications.

The result will be a powerful manga backend that can be embedded into custom applications, enabling developers to create specialized manga reading experiences while leveraging Suwayomi's robust manga source and management capabilities.