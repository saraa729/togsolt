/**
 * Сайтын нийтийн хаяг — sitemap, robots, canonical холбоосуудад ашиглана.
 * Байршуулахдаа `NEXT_PUBLIC_SITE_URL`-ээр дарж өгнө.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
