
import type { Prisma } from '@prisma/client';

// Define LibraryData type with relations
export type LibraryData = Prisma.LibraryGetPayload<{
  include: {
    Manga: true;
  };
}>;

export type LibraryQueryProcedure = {
  useQuery: (
    params: { id: number },
    options?: { enabled?: boolean }
  ) => {
    data: LibraryData | undefined;
    isLoading: boolean;
  };
}