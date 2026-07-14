/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // Friendly entry URLs that lead into the single role-based web app.
    // /admin and /shop both open the app (login → the account's role view);
    // /download is a real public page, so it is NOT redirected here.
    return [
      { source: "/admin", destination: "/", permanent: false },
      { source: "/shop", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
