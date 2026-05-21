/**
 * Debug script to query Transmission directly for Fire Force torrent status
 */

const TRANSMISSION_URL = 'http://localhost:9091/transmission/rpc';
const FIRE_FORCE_HASH = 'e87f4fa4d2f97575cf83870416bff64b86b58a49';

interface TransmissionTorrent {
  id: number;
  hashString: string;
  name: string;
  status: number;
  error: number;
  errorString: string;
  percentDone: number;
  rateDownload: number;
  rateUpload: number;
  downloadDir: string;
  totalSize: number;
  downloadedEver: number;
  uploadedEver: number;
  isFinished: boolean;
  isStalled: boolean;
}

interface TransmissionResponse {
  result: string;
  arguments: {
    torrents: TransmissionTorrent[];
  };
}

async function queryTransmission() {
  console.log('🔍 Querying Transmission for Fire Force torrent...\n');
  console.log(`Hash: ${FIRE_FORCE_HASH}\n`);

  let sessionId: string | null = null;

  // Function to make RPC request
  const rpcRequest = async (method: string, args: Record<string, unknown>) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (sessionId) {
      headers['X-Transmission-Session-Id'] = sessionId;
    }

    const response = await fetch(TRANSMISSION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        method,
        arguments: args
      })
    });

    // Handle session ID refresh
    if (response.status === 409) {
      const newSessionId = response.headers.get('X-Transmission-Session-Id');
      if (newSessionId) {
        console.log('⚠️  Session ID refreshed\n');
        sessionId = newSessionId;
        // Retry with new session ID
        return rpcRequest(method, args);
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<TransmissionResponse>;
  };

  try {
    // Query all torrents
    const result = await rpcRequest('torrent-get', {
      fields: [
        'id',
        'hashString',
        'name',
        'status',
        'error',
        'errorString',
        'percentDone',
        'rateDownload',
        'rateUpload',
        'downloadDir',
        'totalSize',
        'downloadedEver',
        'uploadedEver',
        'isFinished',
        'isStalled'
      ]
    });

    const torrents = result.arguments.torrents;
    const fireForce = torrents.find(t => t.hashString === FIRE_FORCE_HASH);

    if (!fireForce) {
      console.error('❌ Fire Force torrent not found in Transmission!');
      console.log('\n📋 Available torrents:');
      torrents.forEach(t => {
        console.log(`  - ${t.name} (${t.hashString.substring(0, 8)}...)`);
      });
      return;
    }

    console.log('✅ Found Fire Force torrent!\n');
    console.log('📊 Torrent Details:');
    console.log('─'.repeat(80));
    console.log(`ID:              ${fireForce.id}`);
    console.log(`Name:            ${fireForce.name}`);
    console.log(`Hash:            ${fireForce.hashString}`);
    console.log(`Status Code:     ${fireForce.status}`);
    console.log(`Error Code:      ${fireForce.error}`);
    console.log(`Error String:    ${fireForce.errorString || '(none)'}`);
    console.log(`Progress:        ${(fireForce.percentDone * 100).toFixed(2)}%`);
    console.log(`Download Speed:  ${fireForce.rateDownload} bytes/s`);
    console.log(`Upload Speed:    ${fireForce.rateUpload} bytes/s`);
    console.log(`Total Size:      ${(fireForce.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`Downloaded:      ${(fireForce.downloadedEver / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`Uploaded:        ${(fireForce.uploadedEver / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`Download Dir:    ${fireForce.downloadDir}`);
    console.log(`Is Finished:     ${fireForce.isFinished}`);
    console.log(`Is Stalled:      ${fireForce.isStalled}`);
    console.log('─'.repeat(80));

    // Decode status
    console.log('\n📍 Status Interpretation:');
    const statusNames = ['STOPPED', 'CHECK_WAIT', 'CHECK', 'DOWNLOAD_WAIT', 'DOWNLOAD', 'SEED_WAIT', 'SEED'];
    console.log(`  Raw Status: ${fireForce.status} (${statusNames[fireForce.status] || 'UNKNOWN'})`);

    // Map to DownloadStatus
    let mappedStatus = 'UNKNOWN';
    switch (fireForce.status) {
      case 0: mappedStatus = 'PAUSED'; break;
      case 1:
      case 2: mappedStatus = 'DOWNLOADING'; break;
      case 3: mappedStatus = 'QUEUED'; break;
      case 4: mappedStatus = 'DOWNLOADING'; break;
      case 5: mappedStatus = 'QUEUED'; break;
      case 6: mappedStatus = 'SEEDING'; break;
    }
    console.log(`  Mapped Status: ${mappedStatus}`);

    // Error analysis
    if (fireForce.error !== 0) {
      console.log('\n⚠️  ERROR DETECTED!');
      console.log(`  Error Code: ${fireForce.error}`);
      console.log(`  Error Message: ${fireForce.errorString}`);
      console.log('\n  Possible causes:');
      console.log('  - Tracker connection issues');
      console.log('  - Permission errors on download directory');
      console.log('  - Disk I/O errors');
      console.log('  - Network timeouts');
    }

    // Import readiness check
    console.log('\n🎯 Import Readiness:');
    const isComplete = fireForce.percentDone === 1;
    const isSeeding = fireForce.status === 6;
    const hasSavePath = fireForce.downloadDir && fireForce.downloadDir.length > 0;
    const hasError = fireForce.error !== 0;

    console.log(`  ✓ Download Complete: ${isComplete ? '✅ YES' : '❌ NO'}`);
    console.log(`  ✓ Currently Seeding: ${isSeeding ? '✅ YES' : '❌ NO'}`);
    console.log(`  ✓ Has Save Path:     ${hasSavePath ? '✅ YES' : '❌ NO'}`);
    console.log(`  ✓ No Errors:         ${!hasError ? '✅ YES' : '❌ NO'}`);

    const canImport = isComplete && hasSavePath && (mappedStatus === 'SEEDING' || mappedStatus === 'COMPLETED');
    console.log(`\n  → Ready for Import: ${canImport ? '✅ YES' : '❌ NO'}`);

    if (!canImport) {
      console.log('\n  Blocking Issues:');
      if (!isComplete) console.log('    - Download not 100% complete');
      if (!hasSavePath) console.log('    - No save path specified');
      if (mappedStatus !== 'SEEDING' && mappedStatus !== 'COMPLETED') {
        console.log(`    - Status is ${mappedStatus} (expected SEEDING or COMPLETED)`);
      }
      if (hasError) {
        console.log(`    - Has error: ${fireForce.errorString}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error querying Transmission:');
    console.error(error);
  }
}

// Run the query
queryTransmission().catch(console.error);
