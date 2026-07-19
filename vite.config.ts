import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  define: {
    __ANTIFRAUD_SDK_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Antifraud',
      formats: ['es', 'cjs', 'iife'],
      fileName: (format) => {
        switch (format) {
          case 'es': return 'antifraud.esm.js';
          case 'cjs': return 'antifraud.cjs.js';
          case 'iife': return 'antifraud.min.js';
          default: return 'antifraud.js';
        }
      },
    },
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        footer: 'if(typeof Antifraud!=="undefined"&&Antifraud.Antifraud){Antifraud.init=Antifraud.Antifraud.init;}',
      },
    },
  },
});
