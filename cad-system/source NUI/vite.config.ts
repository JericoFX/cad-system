import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  build: {
    minify: true,
    sourcemap: true,
    emptyOutDir: true,
    outDir: '../nui/build',
    assetsDir: './',
    rollupOptions: {
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`,
        sourcemapFileNames: `[name].js.map`,
      },
    },
  },
  base: './',
  resolve: {
    alias: {
      '~': '/source',
    },
  },
});
