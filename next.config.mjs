/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'node-cron'],
    instrumentationHook: true,
  },
}

export default nextConfig
