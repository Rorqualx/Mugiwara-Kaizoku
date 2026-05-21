# Trpc Endpoint Usage Analysis

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Trpc Endpoint Usage Analysis

---
# tRPC Endpoint Usage Analysis Report

**Last Updated**: January 2025

## Summary

After a systematic analysis of all tRPC endpoints in the Mugiwara-Kaizoku application, we found:

- **Total endpoints**: 84
- **Used endpoints**: 25 (30%)
- **Unused endpoints**: 59 (70%)

This indicates that a significant portion of the backend API is not being utilized by the frontend.

## Unused Endpoints by Category

### 1. **Search System** (100% unused)
All search router endpoints are unused:
- `search.withProvider`
- `search.all`
- `search.getMetadata`
- `search.getProviders`
- `search.setDefaultProvider`

**Implication**: The new search system appears to be fully implemented on the backend but not integrated into the frontend.

### 2. **Manga Management** (14 out of 19 endpoints unused - 74%)
Critical unused manga endpoints:
- `manga.add` - Adding new manga
- `manga.search` - Searching for manga
- `manga.download` - Downloading chapters
- `manga.refreshMetaData` - Refreshing metadata
- `manga.bind` - Binding to AniList
- `manga.sources` - Getting available sources
- `manga.searchAcrossProviders`
- `manga.searchProviderConfirmation`
- `manga.getProviderMetadata`

**Implication**: Many manga management features are implemented but not exposed to users.

### 3. **Settings Management** (19 out of 22 endpoints unused - 86%)
Most settings endpoints are unused:
- All search configuration endpoints
- All backup/restore endpoints
- All file organization endpoints
- All integration endpoints
- Metadata conflict resolution

**Implication**: Advanced configuration options exist but are not available in the UI.

### 4. **System Management** (10 out of 16 endpoints unused - 63%)
Unused system features:
- All backup/restore functionality
- Update management
- Process information
- Mangal sources

**Implication**: System administration features are not accessible to users.

### 5. **Task Management** (5 out of 6 endpoints unused - 83%)
Most task management is unused:
- `tasks.retry`
- `tasks.cancel`
- `tasks.getQueued`
- `tasks.getScheduled`
- `tasks.getByType`

**Implication**: Advanced task management capabilities exist but aren't exposed.

### 6. **Other Completely Unused Routers**
- **Events Router**: Real-time event system not used
- **Health Router**: Health checks not used
- **History Router**: Download history not used
- **Backup Router**: Comprehensive backup system not used
- **Metadata Router**: Advanced metadata management not used

## Used Endpoints Analysis

### Most Used Endpoints
1. `settings.get` and `settings.set` - 8 uses each
2. `manga.query` and `library.query` - 6 uses each
3. `activity.query` - 6 uses
4. `library.delete` - 6 uses

### Feature Coverage
The used endpoints suggest the application currently supports:
- Basic library management (create, read, update, delete)
- Basic manga viewing and management
- Activity monitoring
- Basic settings management
- System status and logs viewing

## Root Cause Analysis

### Why 70% of Endpoints Are Unused

1. **Parallel Development Without Coordination**
   - Backend and frontend developed simultaneously
   - No integration planning or checkpoints
   - Features built speculatively without UI designs

2. **Missing UI/UX Design Phase**
   - Endpoints created without wireframes
   - No user flow documentation
   - Developers unsure where to integrate features

3. **Incomplete Feature Implementation**
   - Can search but can't add manga
   - Can view tasks but can't manage them
   - Settings exist but no UI to configure them

4. **Over-Engineering**
   - Complex features built before basics
   - Advanced backup system with no UI
   - Elaborate provider system unused

## Comprehensive Documentation

For detailed integration plans and analysis, see:

1. **[Integration Plan](./trpc-unused-endpoints-integration-plan.md)** - Comprehensive 8-week plan
2. **[Technical Analysis](./trpc-unused-endpoints-technical-analysis.md)** - Code examples and patterns
3. **[Quick Reference](./trpc-unused-endpoints-quick-reference.md)** - At-a-glance endpoint list
4. **[Gap Analysis](./trpc-endpoint-integration-gap-analysis.md)** - Root cause analysis
5. **[Final Report](./trpc-endpoint-integration-final-report.md)** - Executive summary
6. **[Document Index](./trpc-unused-endpoints-document-index.md)** - Guide to all documents

## Recommendations

### 1. **Feature Implementation Priority**
Consider implementing UI for high-value unused endpoints:
- **Manga search and add functionality** (`manga.search`, `manga.add`)
- **Chapter downloading** (`manga.download`)
- **Metadata refresh** (`manga.refreshMetaData`)
- **Search provider configuration** (all `settings.search.*` endpoints)

### 2. **Code Cleanup Options**
For endpoints that won't be used:
- Consider removing unused routers entirely (e.g., if events/history won't be used)
- Document why certain endpoints exist but aren't used
- Add comments indicating future implementation plans

### 3. **Architecture Considerations**
- The high percentage of unused endpoints suggests either:
  - Over-engineering of the backend
  - Incomplete frontend implementation
  - Features planned for future releases

### 4. **Missing Frontend Features**
Based on unused endpoints, these features appear to be missing:
- Manga discovery/search UI
- Download management UI
- Advanced settings pages
- Backup/restore functionality
- Task management interface
- Real-time notifications

### 5. **Potential Quick Wins**
Easy-to-implement features using existing endpoints:
- Add manga search page using `manga.search`
- Add download button using `manga.download`
- Add settings pages for search providers
- Add task retry/cancel buttons

## Technical Debt

The analysis reveals significant technical debt in the form of:
1. **Unused code**: 70% of endpoints are not utilized
2. **Missing features**: Core functionality like search and download not exposed
3. **Incomplete integrations**: Search providers configured but not used

## Next Steps

1. **Prioritize**: Decide which unused endpoints represent features to implement vs. remove
2. **Document**: Add documentation explaining why certain endpoints exist but aren't used
3. **Implement**: Create UI components for high-priority unused endpoints
4. **Clean up**: Remove truly unnecessary endpoints after careful consideration
5. **Test**: Ensure all implemented endpoints are properly tested

## Conclusion

The analysis shows that while Mugiwara-Kaizoku has a comprehensive backend API, only 30% of it is currently utilized. This represents both an opportunity (many features ready to be exposed) and a maintenance burden (unused code to maintain). Strategic decisions about which features to implement vs. remove will help improve the application's functionality while reducing complexity.

**Critical Finding**: The most critical gap is the `manga.add` endpoint - users can search for manga but cannot add them to their library, breaking the core user workflow.
