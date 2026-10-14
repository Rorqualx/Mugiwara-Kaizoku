// The shelf: the pages bundled into the installer (stage K0).
//
// This page is where the app starts and where it waits when the server cannot
// be reached. On a normal start it is on screen for a moment only: it asks the
// shell to check the saved server and the shell navigates the window to it.
//
// The query string says why the page was opened:
//   (none)               a normal start: go to the server if it answers
//   ?view=setup          "Change server" from the menu
//   ?view=shelf          "Downloads (offline)" from the menu: stay here
//   ?reason=unreachable  a navigation to the server failed: stay here, say why

(function () {
  'use strict';

  const invoke = window.__TAURI__.core.invoke;
  const params = new URLSearchParams(window.location.search);

  const sections = {
    connecting: document.getElementById('connecting'),
    setup: document.getElementById('setup'),
    shelf: document.getElementById('shelf'),
  };
  const form = document.getElementById('setup-form');
  const address = document.getElementById('address');
  const connect = document.getElementById('connect');
  const setupError = document.getElementById('setup-error');
  const setupCancel = document.getElementById('setup-cancel');
  const status = document.getElementById('status');
  const openLibrary = document.getElementById('open-library');
  const changeServer = document.getElementById('change-server');

  /** How often the shelf asks whether the server has come back. */
  const RECHECK_MS = 20000;
  let recheck = null;

  function show(name) {
    for (const [key, section] of Object.entries(sections)) {
      section.hidden = key !== name;
    }
    if (name !== 'shelf' && recheck !== null) {
      window.clearInterval(recheck);
      recheck = null;
    }
  }

  function setServerText(server) {
    for (const node of document.querySelectorAll('[data-server]')) {
      node.textContent = server ?? '';
    }
  }

  function setStatus(message, ok) {
    status.textContent = message;
    status.hidden = message === '';
    status.classList.toggle('ok', ok);
  }

  function showSetup(current) {
    address.value = current ?? '';
    setupError.hidden = true;
    // With no server saved there is nothing to go back to.
    setupCancel.hidden = current === null;
    show('setup');
    address.focus();
  }

  function showShelf(message) {
    setStatus(message, false);
    show('shelf');
    // The server coming back is said, not acted on: yanking the window to the
    // library while somebody is looking at this page would be a surprise.
    if (recheck === null) {
      recheck = window.setInterval(() => {
        invoke('check_server').then(
          () => setStatus('The server is reachable again.', true),
          (reason) => setStatus(String(reason), false),
        );
      }, RECHECK_MS);
    }
  }

  async function goToLibrary() {
    openLibrary.disabled = true;
    try {
      // On success the shell navigates the window away and this page is gone.
      await invoke('open_library');
    } catch (reason) {
      showShelf(String(reason));
    } finally {
      openLibrary.disabled = false;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    connect.disabled = true;
    connect.textContent = 'Connecting...';
    setupError.hidden = true;
    try {
      const saved = await invoke('set_server', { address: address.value });
      setServerText(saved);
      show('connecting');
      await goToLibrary();
    } catch (reason) {
      setupError.textContent = String(reason);
      setupError.hidden = false;
    } finally {
      connect.disabled = false;
      connect.textContent = 'Connect';
    }
  });

  setupCancel.addEventListener('click', () => showShelf(''));
  openLibrary.addEventListener('click', goToLibrary);
  changeServer.addEventListener('click', async () => showSetup(await invoke('get_server')));

  async function start() {
    const server = await invoke('get_server');
    setServerText(server);

    if (server === null || params.get('view') === 'setup') {
      showSetup(server);
      return;
    }
    if (params.get('view') === 'shelf') {
      showShelf('');
      return;
    }
    if (params.get('reason') === 'unreachable') {
      showShelf(`Could not reach ${server}. The library needs the server.`);
      return;
    }
    show('connecting');
    await goToLibrary();
  }

  start();
})();
