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
  /** Marketplace item links found in the album description, if any. */
  links?: string[];
  /** The seller's raw description text — the CNY price is almost always the first line. */
  description?: string | null;
  /** The album's own title — lets a URL deep-link (which carries no title) still read a title-only price. */
  title?: string | null;
}

/** What `/api/yupoo/album?light=1` returns: the description (for price) and its item links, no photo scan. */
export interface YupooAlbumLightResponse {
  description: string | null;
  links: string[];
}

export function isValidYupooHost(host: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,62}$/i.test(host);
}

/** Route a photo.yupoo.com URL through the referer-spoofing image proxy. */
export function proxiedImg(url: string, host: string): string {
  return `/api/yupoo/img?host=${encodeURIComponent(host)}&u=${encodeURIComponent(url)}`;
}
