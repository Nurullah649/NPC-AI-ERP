/** @type {import('next').NextConfig} */
const nextConfig = {
    // Statik dışa aktarma (static export) için gerekli ayar.
    output: 'export',

    // --- Electron Paketlemesi İçin Kritik Ayarlar ---
    // Bu ayarlar, paketlenmiş uygulamada CSS/JS dosyalarının ve sayfa yollarının
    // doğru yüklenmesini sağlar, "beyaz ekran" sorununu çözer.
    assetPrefix: './',
    trailingSlash: true,
    // ------------------------------------------------

    // Paketleme sırasında resim optimizasyonunu devre dışı bırak.
    images: {
        unoptimized: true,
    },

    // Build sırasında TypeScript ve ESLint hatalarını yoksay (isteğe bağlı).
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
}

export default nextConfig;

