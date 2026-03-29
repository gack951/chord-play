import { defineConfig } from 'vite';
import { handleDevApi } from './src/server/devApi';

export default defineConfig({
  plugins: [
    {
      name: 'local-dev-api',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          handleDevApi(request, response)
            .then((handled) => {
              if (!handled) {
                next();
              }
            })
            .catch(next);
        });
      },
    },
  ],
  server: {
    host: true,
    port: 5173,
  },
});
