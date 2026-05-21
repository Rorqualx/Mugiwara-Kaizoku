/**
 * Buffer Utilities
 *
 * Small helpers for working with Node Buffers safely against APIs that expect
 * ArrayBuffer (e.g. node-unrar-js's createExtractorFromData).
 *
 * @module conversion/utils/buffer-utils
 */

/**
 * Return the exact ArrayBuffer slice backing a Node Buffer.
 *
 * Node `Buffer` is a view into a pooled `ArrayBuffer` — `buf.buffer` may be
 * larger than `buf.length` when the file was read into a pooled allocation.
 * Passing the raw `buf.buffer` to consumers like `node-unrar-js` causes them
 * to scan past EOF into pool padding, which can mis-parse archives.
 *
 * Always slice to the buffer's actual byteOffset/byteLength range.
 */
export function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}
