import { describe, expect, it } from '@jest/globals';

import {
  assertPublicHttpUrl,
  assertUrlHost,
  isHostInDomains,
  isLiteralPrivateHost,
  isPrivateAddress,
  OutboundUrlError,
  rejectPrivateRedirect,
} from '@/server/utils/outbound-url-guard';

describe('outbound-url-guard', () => {
  describe('isHostInDomains', () => {
    const domains = ['fandom.com', 'comicvine.gamespot.com'];

    it('accepts the domain itself and its subdomains', () => {
      expect(isHostInDomains('fandom.com', domains)).toBe(true);
      expect(isHostInDomains('OnePiece.Fandom.com', domains)).toBe(true);
      expect(isHostInDomains('comicvine.gamespot.com.', domains)).toBe(true);
    });

    it('rejects hosts that only contain the domain as a substring', () => {
      expect(isHostInDomains('fandom.com.evil.example', domains)).toBe(false);
      expect(isHostInDomains('notfandom.com', domains)).toBe(false);
      expect(isHostInDomains('gamespot.com', domains)).toBe(false);
    });
  });

  describe('isPrivateAddress', () => {
    it.each([
      '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.50.185',
      '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1',
      '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:7f00:1', '::ffff:c0a8:32b9',
    ])('treats %s as private', (ip) => {
      expect(isPrivateAddress(ip)).toBe(true);
    });

    it.each(['8.8.8.8', '172.32.0.1', '100.63.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8', '::ffff:808:808'])(
      'treats %s as public',
      (ip) => {
        expect(isPrivateAddress(ip)).toBe(false);
      }
    );

    it('treats non-IP input as private', () => {
      expect(isPrivateAddress('example.com')).toBe(true);
    });
  });

  describe('isLiteralPrivateHost', () => {
    it('flags localhost names and private literals, not public names', () => {
      expect(isLiteralPrivateHost('localhost')).toBe(true);
      expect(isLiteralPrivateHost('db.localhost')).toBe(true);
      expect(isLiteralPrivateHost('nas.local')).toBe(true);
      expect(isLiteralPrivateHost('[::1]')).toBe(true);
      expect(isLiteralPrivateHost('192.168.1.1')).toBe(true);
      expect(isLiteralPrivateHost('example.com')).toBe(false);
      expect(isLiteralPrivateHost('8.8.8.8')).toBe(false);
    });
  });

  describe('assertPublicHttpUrl', () => {
    it.each([
      'http://127.0.0.1:5432/',
      'http://localhost:3000/api',
      'http://[::1]/',
      'http://[::ffff:127.0.0.1]/',
      'http://192.168.50.185:9091/transmission/rpc',
      'http://169.254.169.254/latest/meta-data/',
      'file:///etc/passwd',
      'ftp://example.com/x',
      'http://user:pass@8.8.8.8/',
      'not a url',
    ])('rejects %s', async (url) => {
      await expect(assertPublicHttpUrl(url)).rejects.toBeInstanceOf(OutboundUrlError);
    });

    it('accepts a public IP literal without DNS', async () => {
      const parsed = await assertPublicHttpUrl('https://8.8.8.8/path?q=1');
      expect(parsed.hostname).toBe('8.8.8.8');
    });
  });

  describe('assertUrlHost', () => {
    it('accepts an allowed host and rejects look-alikes and non-http schemes', () => {
      expect(assertUrlHost('https://onepiece.fandom.com/wiki/Chapter_1', ['fandom.com']).hostname)
        .toBe('onepiece.fandom.com');
      expect(() => assertUrlHost('https://evil.example/?x=fandom.com', ['fandom.com'])).toThrow(OutboundUrlError);
      expect(() => assertUrlHost('https://fandom.com.evil.example/', ['fandom.com'])).toThrow(OutboundUrlError);
      expect(() => assertUrlHost('javascript://fandom.com/x', ['fandom.com'])).toThrow(OutboundUrlError);
    });
  });

  describe('rejectPrivateRedirect', () => {
    it('throws for a private redirect target and passes a public one', () => {
      expect(() => { rejectPrivateRedirect({ hostname: '127.0.0.1' }); }).toThrow(OutboundUrlError);
      expect(() => { rejectPrivateRedirect({ hostname: 'localhost' }); }).toThrow(OutboundUrlError);
      expect(() => { rejectPrivateRedirect({ hostname: 'example.com' }); }).not.toThrow();
    });
  });
});
