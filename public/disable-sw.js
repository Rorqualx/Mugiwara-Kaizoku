// Unregister all service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister();
      console.log('Unregistered service worker:', registration.scope);
    }
  });
}

// Clear all caches
if ('caches' in window) {
  caches.keys().then(cacheNames => {
    return Promise.all(
      cacheNames.map(cacheName => {
        return caches.delete(cacheName);
      })
    );
  }).then(() => {
    console.log('All caches cleared!');
    alert('Service worker and caches cleared! Please CLOSE ALL TABS and reopen.');
  });
}
