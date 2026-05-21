import { fileURLToPath } from 'url';
import path from 'path';

const generatedPrismaDir = path.resolve(process.cwd(), 'src/generated/prisma');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: 'standalone' output is incompatible with custom server (server-production.ts)
  // The custom server provides WebSocket support via programmatic Next.js API

  // Essential configuration only
  experimental: {
    // Canvas is optional dependency of jsdom - add to externals to prevent build errors
    // happy-dom uses child_process which is Node.js only
    serverComponentsExternalPackages: ['@prisma/client', 'pino', 'pino-pretty', 'canvas', 'happy-dom', 'mangadex-ts-client', 'cheerio', 'undici'],
    // Disable barrel import optimization for tabler icons to prevent webpack errors
    optimizePackageImports: [],
  },

  // Transpile @tabler/icons-react to fix ESM/barrel import issues
  transpilePackages: ['@tabler/icons-react'],
  
  // TypeScript configuration
  // Production builds must fail on type errors; dev builds tolerate them.
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV !== 'production',
  },

  // ESLint configuration
  // Production builds must fail on lint errors; dev builds tolerate them.
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV !== 'production',
    dirs: ['src']
  },
  
  // Webpack configuration
  webpack: (config, { dev, isServer, webpack }) => {
    // Handle ESM modules
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    // Development optimizations for faster HMR
    if (dev) {
      // Enable webpack caching for faster rebuilds
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [fileURLToPath(import.meta.url)],
        },
      };

      // Use default Next.js source maps (eval-source-map) — custom devtool causes
      // severe memory usage during cold builds with Node 25+
      // config.devtool = 'cheap-module-source-map';
    }

    // External modules for server
    if (isServer) {
      // Prisma 7: Externalize @prisma/client and all generated prisma imports
      // The tsconfig alias resolves @prisma/client to src/generated/prisma/client.ts
      // We must prevent webpack from bundling these Node.js-only modules
      config.externals.push(({ request }, callback) => {
        if (request === '@prisma/client' || request?.startsWith?.('@prisma/client/')) {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      });
      config.externals.push('pino');
      config.externals.push('pino-pretty');
      // Canvas is an optional dependency of jsdom - mark as external to prevent bundling errors
      config.externals.push('canvas');
      // happy-dom uses child_process which is Node.js only - must be external
      config.externals.push('happy-dom');
      // mangadex-ts-client uses cheerio which pulls in undici with private class fields
      config.externals.push('mangadex-ts-client');
      config.externals.push('cheerio');
      config.externals.push('undici');
    } else {
      // Provide empty modules for client-side to prevent build errors
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        // @tensorflow/tfjs-node and @mapbox/node-pre-gyp reach for Node-only
        // built-ins + optional AWS helpers. Stubbing the remaining ones that
        // appear in the client bundle transitively via dynamic imports.
        child_process: false,
        net: false,
        tls: false,
        http: false,
        https: false,
        zlib: false,
        stream: false,
        'stream/promises': false,
        'aws-sdk': false,
        'mock-aws-s3': false,
        nock: false,
      };
      // Entirely skip server-only packages in the client bundle so webpack
      // never tries to parse their Node-only internals (e.g. an HTML file
      // referenced by @mapbox/node-pre-gyp, tfjs-node native bindings).
      config.plugins = config.plugins ?? [];
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(@tensorflow\/tfjs-node|@mapbox\/node-pre-gyp|nock|aws-sdk|mock-aws-s3)$/,
        })
      );
    }

    // Skip processing problematic files
    config.module.noParse = [
      /17948/,
      /17885/,
      /17887/,
    ];

    return config;
  },
  
  // Skip middleware compilation issues
  skipMiddlewareUrlNormalize: true,
  
  // Enable SWC minification for ES2022 support
  swcMinify: true,

  async redirects() {
    return [
      { source: '/wanted', destination: '/wanted/missing', permanent: false }
    ];
  },
};

export default nextConfig;