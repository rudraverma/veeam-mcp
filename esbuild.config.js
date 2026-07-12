import * as esbuild from 'esbuild';

/**
 * Bundle the server into a single ESM file. Runtime deps are marked external and installed
 * via npm (see package.json) — this keeps the build fast and the bundle small. The MCP client
 * launches build/index.js directly.
 */
await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'es2022',
    format: 'esm',
    outfile: 'build/index.js',
    banner: {
        // Shebang so the file can be invoked directly as a bin.
        js: '#!/usr/bin/env node',
    },
    external: ['@modelcontextprotocol/sdk', 'axios', 'zod'],
    sourcemap: true,
});
