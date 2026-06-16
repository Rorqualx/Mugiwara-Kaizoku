/**
 * @jest-environment node
 *
 * Tests for withRemovalToast — the shared process-then-notify helper used by
 * both the single-card remove (PosterView) and bulk delete (library/[id]).
 *
 * The behaviour under test is the ordering the UX depends on:
 *   1. a loading toast appears BEFORE the task runs,
 *   2. success is reported ONLY after the task (incl. its awaited refetch)
 *      resolves,
 *   3. failures morph the same toast to an error and re-throw.
 */

jest.mock('@mantine/notifications', () => ({
  notifications: { show: jest.fn(), update: jest.fn() },
}));
jest.mock('@/utils/notify', () => ({ notify: jest.fn() }));

import { notifications } from '@mantine/notifications';

import { notify } from '@/utils/notify';
import { withRemovalToast } from '@/utils/removalToast';

const OPTS = {
  id: 'remove-test',
  processingTitle: 'Removing manga',
  processingMessage: 'Removing X...',
  successTitle: 'Manga Removed',
  successMessage: 'X was removed',
  errorTitle: 'Failed to Remove Manga',
  fallbackErrorMessage: 'fallback',
};

const showMock = notifications.show as jest.Mock;
const updateMock = notifications.update as jest.Mock;
const notifyMock = notify as jest.Mock;

beforeEach(() => {
  showMock.mockReset();
  updateMock.mockReset();
  notifyMock.mockReset();
});

describe('withRemovalToast', () => {
  it('shows a loading toast before the task, then success after it resolves', async () => {
    const order: string[] = [];
    showMock.mockImplementation(() => order.push('loading'));
    updateMock.mockImplementation((a: { color?: string }) =>
      order.push(a.color === 'green' ? 'success' : 'error'));

    let taskStarted = false;
    await withRemovalToast(OPTS, async () => {
      taskStarted = true;
      // The loading toast must already be on screen when the task begins.
      expect(order).toEqual(['loading']);
      await Promise.resolve();
    });

    expect(taskStarted).toBe(true);
    expect(order).toEqual(['loading', 'success']);
    expect(showMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'remove-test', loading: true, title: 'Removing manga' }),
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'remove-test', loading: false, color: 'green', title: 'Manga Removed' }),
    );
    // Durable bell row, no second toast.
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'SUCCESS', toast: false }),
    );
  });

  it('reports success ONLY after an awaited refetch resolves', async () => {
    let refetchResolved = false;
    updateMock.mockImplementation((a: { color?: string }) => {
      if (a.color === 'green') {
        // The fix: success fires after the list has refetched, not before.
        expect(refetchResolved).toBe(true);
      }
    });

    await withRemovalToast(OPTS, async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 20));
      refetchResolved = true; // simulates refetchAll() completing
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it('morphs the toast to an error and re-throws when the task fails', async () => {
    const order: string[] = [];
    showMock.mockImplementation(() => order.push('loading'));
    updateMock.mockImplementation((a: { color?: string }) =>
      order.push(a.color === 'green' ? 'success' : 'error'));

    await expect(
      withRemovalToast(OPTS, async () => { throw new Error('boom'); }),
    ).rejects.toThrow('boom');

    expect(order).toEqual(['loading', 'error']);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'remove-test', loading: false, color: 'red', message: 'boom' }),
    );
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'ERROR', toast: false, message: 'boom' }),
    );
  });

  it('falls back to the provided error message when the throw is not an Error', async () => {
    await expect(
      withRemovalToast(OPTS, async () => { throw 'not-an-error'; }),
    ).rejects.toBe('not-an-error');

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'red', message: 'fallback' }),
    );
  });
});
