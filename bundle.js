const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: ['src/renderer/index.tsx'],
  bundle: true,
  outfile: 'dist/renderer/bundle.js',
  platform: 'browser',
  target: 'es2022',
  format: 'esm',
  external: ['electron'],
  resolveExtensions: ['.tsx', '.ts', '.jsx', '.js'],
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.woff': 'file',
    '.woff2': 'file',
    '.ttf': 'file',
    '.eot': 'file',
    '.svg': 'file',
  },
  publicPath: './',
  assetNames: 'assets/[name]-[hash]',
}).catch(() => process.exit(1));