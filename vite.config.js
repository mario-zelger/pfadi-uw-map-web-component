import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  if (mode === 'full') {
    return {
      build: {
        target: 'es2020',
        lib: {
          entry: resolve(import.meta.dirname, 'src/pfadi-uw-map.ts'),
          name: 'PfadiUwMap',
          fileName: 'pfadi-uw-map',
          formats: ['es'],
        },
        outDir: 'dist',
        emptyOutDir: true,
        minify: false,
        rolldownOptions: {
          output: {
            format: 'es',
            codeSplitting: false,
          },
        },
      },
    };
  }

  if (mode === 'minified') {
    return {
      build: {
        target: 'es2017',
        lib: {
          entry: resolve(import.meta.dirname, 'src/pfadi-uw-map.ts'),
          name: 'PfadiUwMap',
          fileName: 'pfadi-uw-map.min',
          formats: ['es'],
        },
        outDir: 'dist',
        emptyOutDir: false,
        minify: true,
        rolldownOptions: {
          treeshake: {
            moduleSideEffects: false,
          },
        },
      },
    };
  }

  // Default config for dev mode
  return {
    root: 'sample',
  };
});
