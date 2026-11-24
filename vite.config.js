import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      output: {
        assetFileNames: asset => asset.names.includes('eng.traineddata.gz')
          ? 'assets/eng.traineddata.gz'
          : 'assets/[name]-[hash][extname]',
      },
    },
  },
});
