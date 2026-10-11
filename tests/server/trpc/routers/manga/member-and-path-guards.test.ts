// @ts-nocheck - Test file uses mocked callers
/**
 * Membership and server-path guards on the import and relations
 * procedures: a signed-in user who does not have the title, or who names a
 * path outside their folders, is refused before any work is done.
 */

jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn(() => ({})) }));
jest.mock('superjson', () => ({
  __esModule: true,
  default: {
    serialize: jest.fn((data: unknown) => ({ json: data, meta: undefined })),
    deserialize: jest.fn((data: { json: unknown }) => data.json),
    parse: jest.fn((str: string) => JSON.parse(str)),
    stringify: jest.fn((data: unknown) => JSON.stringify(data)),
    registerClass: jest.fn(),
    registerCustom: jest.fn(),
  },
}));
jest.mock('next-auth', () => ({ __esModule: true, default: jest.fn(() => () => Promise.resolve()) }));
jest.mock('next-auth/providers/credentials', () => ({ __esModule: true, default: jest.fn(() => ({ id: 'credentials' })) }));

const mockGetServerSession = jest.fn();
jest.mock('next-auth/next', () => ({ getServerSession: mockGetServerSession }));

const mockManualImport = jest.fn();
jest.mock('@/server/services/download/fileImporter', () => ({
  FileImporter: jest.fn(() => ({ manualImport: mockManualImport })),
}));
const mockScan = jest.fn();
jest.mock('@/server/services/packImport/library-scanner', () => ({ scanMangaLibraryFolder: mockScan }));
jest.mock('@/server/services/realtime/RealtimeEventEmitter', () => ({
  realtimeEmitter: { emitSystemEvent: jest.fn() },
}));
jest.mock('@/server/trpc/routers/manga/crud-operations/get-manga-cache', () => ({ invalidateMangaCache: jest.fn() }));
jest.mock('@/server/services/download/pathMapper', () => ({
  getPathMapper: () => ({ getMappings: () => [{ localPath: '/downloads/completed', remotePath: '/downloads/completed' }] }),
}));
const MEMBER_MANGA = 7;

function createContext(): unknown {
  return {
    req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } },
    res: {},
    prisma: {
      libraryMembership: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve(where.userId_mangaId.mangaId === MEMBER_MANGA ? { id: 1 } : null)),
        findMany: jest.fn(() => Promise.resolve([{ mangaId: MEMBER_MANGA }])),
      },
      chapter: { findMany: jest.fn(() => Promise.resolve([{ mangaId: MEMBER_MANGA }])) },
      library: { findMany: jest.fn(() => Promise.resolve([{ path: '/app/data/libraries/user-1/my-manga' }])) },
      mangaRelation: { findMany: jest.fn(() => Promise.resolve([])) },
    },
  };
}

describe('membership and path guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1', role: 'USER' } });
    mockManualImport.mockResolvedValue({ status: 'success', data: { imported: 1 } });
    mockScan.mockResolvedValue({ status: 'success', data: { newChaptersCreated: 0 } });
  });

  describe('import', () => {
    const file = (sourcePath: string) => ({ sourcePath, chapterId: 11, fileName: 'c001.cbz' });

    it('refuses a manual import into a title the caller does not have', async () => {
      const { importRouter } = await import('@/server/trpc/routers/manga/importOperations');
      const caller = importRouter.createCaller(createContext());

      await expect(
        caller.manualImport({ jobId: '1', mangaId: 99, files: [file('/downloads/completed/c001.cbz')] })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(mockManualImport).not.toHaveBeenCalled();
    });

    it('refuses a manual import from a path outside the caller\'s folders', async () => {
      const { importRouter } = await import('@/server/trpc/routers/manga/importOperations');
      const caller = importRouter.createCaller(createContext());

      await expect(
        caller.manualImport({ jobId: '1', mangaId: MEMBER_MANGA, files: [file('/config/secrets.cbz')] })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(mockManualImport).not.toHaveBeenCalled();
    });

    it('runs a manual import from the download folder into the caller\'s title', async () => {
      const { importRouter } = await import('@/server/trpc/routers/manga/importOperations');
      const caller = importRouter.createCaller(createContext());

      await caller.manualImport({ jobId: '1', mangaId: MEMBER_MANGA, files: [file('/downloads/completed/pack/c001.cbz')] });
      expect(mockManualImport).toHaveBeenCalledTimes(1);
    });

    it('lets an admin import from any path', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1', role: 'ADMIN' } });
      const { importRouter } = await import('@/server/trpc/routers/manga/importOperations');
      const caller = importRouter.createCaller(createContext());

      await caller.manualImport({ jobId: '1', mangaId: MEMBER_MANGA, files: [file('/mnt/other/c001.cbz')] });
      expect(mockManualImport).toHaveBeenCalledTimes(1);
    });

    it('refuses a folder scan of a title the caller does not have', async () => {
      const { importRouter } = await import('@/server/trpc/routers/manga/importOperations');
      const caller = importRouter.createCaller(createContext());

      await expect(caller.scanLibraryFolder({ mangaId: 99 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(mockScan).not.toHaveBeenCalled();
    });
  });

  describe('relations', () => {
    it('refuses relations of a title the caller does not have', async () => {
      const { relationsRouter } = await import('@/server/trpc/routers/manga/relationsOperations');
      const ctx = createContext();
      const caller = relationsRouter.createCaller(ctx);

      await expect(caller.getRelations({ mangaId: 99 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(ctx.prisma.mangaRelation.findMany).not.toHaveBeenCalled();
      await expect(caller.getRelations({ mangaId: MEMBER_MANGA })).resolves.toEqual([]);
    });
  });
});
