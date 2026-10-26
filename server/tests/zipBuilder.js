/**
 * tests/zipBuilder.js
 *
 * What this file does:
 *   Builds a valid ZIP archive from a list of entries, entirely in memory,
 *   using only Node.js built-in Buffer operations.
 *
 * Why this exists:
 *   The test suite needs ZIP archives containing deliberately unsafe paths
 *   (traversal, absolute paths, symlinks) to verify BuildProof's security
 *   checks. We cannot safely use such ZIPs from external sources. This helper
 *   generates them programmatically and only for testing.
 *
 * No external ZIP library is used here. The ZIP format (PKWARE .ZIP) is a
 * well-documented public specification. We implement only the minimum needed
 * for testing: uncompressed (stored) entries.
 *
 * Usage:
 *   import { buildZip } from './zipBuilder.js';
 *   const buf = buildZip([
 *     { name: 'hello.txt', data: Buffer.from('hello') },
 *     { name: 'sub/world.txt', data: Buffer.from('world') },
 *   ]);
 *   // buf is a valid ZIP archive
 */

'use strict';

// ── CRC-32 ────────────────────────────────────────────────────────────────────

/**
 * crc32(buf)
 * Computes the standard CRC-32 checksum of a Buffer.
 * Required by the ZIP specification for every file entry.
 */
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── Little-endian write helpers ───────────────────────────────────────────────

function u16(buf, off, val) {
  buf[off]     =  val        & 0xFF;
  buf[off + 1] = (val >>  8) & 0xFF;
}

function u32(buf, off, val) {
  buf[off]     =  val         & 0xFF;
  buf[off + 1] = (val >>>  8) & 0xFF;
  buf[off + 2] = (val >>> 16) & 0xFF;
  buf[off + 3] = (val >>> 24) & 0xFF;
}

// ── Main builder ──────────────────────────────────────────────────────────────

/**
 * buildZip(entries)
 *
 * @param {Array<{
 *   name: string,           ZIP entry path (e.g. "sub/file.txt" or "../evil.txt")
 *   data?: Buffer,          file content (default: empty)
 *   externalAttributes?: number  Unix external attributes (upper 16 bits = mode)
 * }>} entries
 *
 * @returns {Buffer} A complete, valid ZIP archive buffer.
 */
export function buildZip(entries) {
  const localParts   = [];  // local file headers + data
  const centralParts = [];  // central directory headers
  let   localOffset  = 0;   // byte offset of each local header

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const data             = entry.data ?? Buffer.alloc(0);
    const uncompressedSize = entry.uncompressedSize ?? data.length;
    const compressedSize   = entry.compressedSize ?? (entry.uncompressedSize != null ? entry.uncompressedSize : data.length);
    const checksum         = crc32(data);
    const extAttrs         = entry.externalAttributes ?? 0;

    // ── Local file header (30 bytes + filename) ───────────────────────────
    const local = Buffer.alloc(30 + nameBytes.length);
    u32(local,  0, 0x04034B50);        // Local file header signature
    u16(local,  4, 20);                // Version needed: 2.0
    u16(local,  6, 0);                 // General purpose bit flag
    u16(local,  8, 0);                 // Compression: stored (uncompressed)
    u16(local, 10, 0);                 // Last mod time
    u16(local, 12, 0);                 // Last mod date
    u32(local, 14, checksum);          // CRC-32
    u32(local, 18, compressedSize);    // Compressed size
    u32(local, 22, uncompressedSize);  // Uncompressed size
    u16(local, 26, nameBytes.length);  // Filename length
    u16(local, 28, 0);                 // Extra field length
    nameBytes.copy(local, 30);

    localParts.push(local, data);

    // ── Central directory header (46 bytes + filename) ────────────────────
    const central = Buffer.alloc(46 + nameBytes.length);
    u32(central,  0, 0x02014B50);        // Central directory signature
    u16(central,  4, 0x031E);           // Version made by: Unix, 3.0
    u16(central,  6, 20);               // Version needed
    u16(central,  8, 0);                // Flags
    u16(central, 10, 0);                // Compression
    u16(central, 12, 0);                // Last mod time
    u16(central, 14, 0);                // Last mod date
    u32(central, 16, checksum);         // CRC-32
    u32(central, 20, compressedSize);   // Compressed size
    u32(central, 24, uncompressedSize); // Uncompressed size
    u16(central, 28, nameBytes.length); // Filename length
    u16(central, 30, 0);                // Extra field length
    u16(central, 32, 0);                // File comment length
    u16(central, 34, 0);                // Disk number start
    u16(central, 36, 0);                // Internal attributes
    u32(central, 38, extAttrs);         // External attributes
    u32(central, 42, localOffset);      // Relative offset of local header
    nameBytes.copy(central, 46);

    centralParts.push(central);
    localOffset += local.length + data.length;
  }

  // ── End of central directory record (22 bytes) ────────────────────────────
  const centralBuf  = Buffer.concat(centralParts);
  const eocd        = Buffer.alloc(22);
  u32(eocd,  0, 0x06054B50);          // End of central directory signature
  u16(eocd,  4, 0);                   // Disk number
  u16(eocd,  6, 0);                   // Disk with start of central dir
  u16(eocd,  8, entries.length);      // Entries on this disk
  u16(eocd, 10, entries.length);      // Total entries
  u32(eocd, 12, centralBuf.length);   // Central directory size
  u32(eocd, 16, localOffset);         // Central directory offset
  u16(eocd, 20, 0);                   // Comment length

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

/**
 * makeSymlinkAttributes()
 * Returns the external attributes value that marks a ZIP entry as a
 * Unix symbolic link. Used to test symlink rejection in BuildProof.
 *
 * Unix file type for symlink: S_IFLNK = 0o120000
 * Combined with read/write/execute permissions: 0o120755
 * These go in the upper 16 bits of the external attributes field.
 */
export function makeSymlinkAttributes() {
  return (0o120755 << 16) >>> 0;
}
