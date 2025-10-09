import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  if (mode === 'full') {
    return {
      build: {
        target: 'es2020',
        lib: {
          entry: resolve(__dirname, 'src/pfadi-uw-map.ts'),
          name: 'PfadiUwMap',
          fileName: 'pfadi-uw-map',
          formats: ['es'],
        },
        outDir: 'dist',
        emptyOutDir: true,
        minify: false,
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
            format: 'es',
          },
        },
      },
      esbuild: {
        target: 'es2020',
        minifyIdentifiers: false,
      },
    };
  }

  if (mode === 'minified') {
    return {
      build: {
        target: 'es2017',
        lib: {
          entry: resolve(__dirname, 'src/pfadi-uw-map.ts'),
          name: 'PfadiUwMap',
          fileName: 'pfadi-uw-map.min',
          formats: ['es'],
        },
        outDir: 'dist',
        emptyOutDir: false,
        minify: 'esbuild',
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
            generatedCode: {
              constBindings: true,
            },
            compact: true,
          },
          treeshake: {
            preset: 'smallest',
            moduleSideEffects: false,
          },
        },
      },
      esbuild: {
        target: 'es2017',
        legalComments: 'none',
      },
    };
  }

  // Default config for dev mode
  return {
    root: 'sample',
  };
});
