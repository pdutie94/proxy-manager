// This file runs when the Next.js server starts
// Used to initialize background services like the health check scheduler

export async function register() {
  // Only run on the server, not during build
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Starting server initialization...');

    // Dynamic import to avoid Edge runtime issues with node-ssh (uses fs module)
    // The scheduler imports ssh.ts which imports node-ssh
    try {
      const { startHealthCheckScheduler } = await import('./lib/scheduler');
      startHealthCheckScheduler();
      console.log('[Instrumentation] Health check scheduler started successfully');
    } catch (error) {
      console.error('[Instrumentation] Failed to start health check scheduler:', error);
    }
  }
}
