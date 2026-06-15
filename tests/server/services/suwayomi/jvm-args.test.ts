/**
 * @jest-environment node
 *
 * Regression: Suwayomi's bundled KCEF off-screen browser (WebView/Cloudflare
 * sources like mangafire) loads JOGL's libgluegen_rt.so, which KCEF downloads
 * into <rootDir>/bin/kcef — a dir NOT on the JVM's default java.library.path.
 * Without it on the path the GL canvas throws UnsatisfiedLinkError and the
 * source silently returns zero results. buildJvmArgs must put that dir on
 * java.library.path.
 */
import { join } from 'node:path';

import { describe, it, expect } from '@jest/globals';

import { buildJvmArgs } from '@/server/services/suwayomi/suwayomi-service/lifecycle-manager';

const cfg = { minMemory: 512, maxMemory: 2048, configPath: '/app/data/suwayomi-config', port: 4567, jarPath: '/app/data/suwayomi-server/Suwayomi-Server.jar' };

describe('buildJvmArgs', () => {
  it('puts the KCEF native dir on java.library.path', () => {
    const args = buildJvmArgs(cfg);
    const libPathArg = args.find(a => a.startsWith('-Djava.library.path='));
    expect(libPathArg).toBeDefined();
    expect(libPathArg).toContain(join('/app/data/suwayomi-config', 'bin', 'kcef'));
  });

  it('keeps the standard Linux JRE dirs alongside the kcef dir (does not strip system natives)', () => {
    const libPathArg = buildJvmArgs(cfg).find(a => a.startsWith('-Djava.library.path=')) ?? '';
    expect(libPathArg).toContain('/usr/lib');
  });

  it('derives the kcef dir from the configured rootDir', () => {
    const libPathArg = buildJvmArgs({ ...cfg, configPath: '/custom/root' }).find(a => a.startsWith('-Djava.library.path=')) ?? '';
    expect(libPathArg).toContain(join('/custom/root', 'bin', 'kcef'));
  });

  it('still runs headless and points at the jar', () => {
    const args = buildJvmArgs(cfg);
    expect(args).toContain('-Djava.awt.headless=true');
    expect(args[args.length - 1]).toBe(cfg.jarPath);
  });
});
