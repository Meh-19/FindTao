/** Shared types for the Yupoo scraping API routes and their client consumers. */

export interface YupooAlbum {
  id: string;
  title: string;
  count: number;
  /** Cover image URL on photo.yupoo.com — load it through /api/yupoo/img. */
  cover: string | null;
}

export interface YupooAlbumsResponse {
  albums: YupooAlbum[];
  /** True when another page probably exists — fetch page+1 until empty. */
  hasMore: boolean;
}

export interface YupooPhotosResponse {
  photos: string[];
}

export function isValidYupooHost(host: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,62}$/i.test(host);
}

/** Route a photo.yupoo.com URL through the referer-spoofing image proxy. */
export function proxiedImg(url: string, host: string): string {
  return `/api/yupoo/img?host=${encodeURIComponent(host)}&u=${encodeURIComponent(url)}`;
}
