/** @type {import('next').NextConfig} */
const nextConfig = {
  // Нативні / CJS-пакети для паролів — не вшивати у зайві server-бандли (webpack).
  serverExternalPackages: ["bcryptjs"],
};

export default nextConfig;
