import app from './app.ts';
import { loadFileConfig } from './config/files.ts';
import { checkFfprobe } from './lib/ffmpeg.ts';
import { prisma } from './lib/prisma.ts';

const port = Number(process.env.PORT || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

// MP4 uploads depend on ffprobe, so fail at startup rather than on the first video.
// Prisma connects lazily, so there is nothing to disconnect yet.
try {
  await checkFfprobe(loadFileConfig().ffprobePath);
} catch {
  console.error('ffprobe could not run. Install FFmpeg, or set FFPROBE_PATH to the ffprobe binary.');
  process.exit(1);
}

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log('Connected to PostgreSQL.');

  const server = app.listen(port, () => {
    console.log(`Camioane API listening on http://localhost:${port}`);
  });

  server.on('error', async (error) => {
    console.error('HTTP server failed:', error.message);
    process.exitCode = 1;
    await prisma.$disconnect();
  });

  let shuttingDown = false;

  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();

    server.close(async () => {
      try {
        await prisma.$disconnect();
      } catch {
        console.error('Failed to close the PostgreSQL connection.');
        process.exitCode = 1;
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch {
  console.error('PostgreSQL connection failed. Check DATABASE_URL and confirm the database is running.');
  process.exitCode = 1;
  await prisma.$disconnect();
}
