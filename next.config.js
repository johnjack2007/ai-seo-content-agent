/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@playwright/test']
  },
  images: {
    domains: ['localhost']
  }
}

module.exports = nextConfig 