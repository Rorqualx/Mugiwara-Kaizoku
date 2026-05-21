/**
 * Mock for pretty-bytes module
 * Provides basic byte formatting functionality for tests
 */

const prettyBytes = (bytes, options = {}) => {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
    return '0 B';
  }

  const { binary = false } = options;
  const base = binary ? 1024 : 1000;
  const units = binary
    ? ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
    : ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  if (bytes === 0) return '0 B';
  if (bytes < base) return `${bytes} B`;

  const exp = Math.floor(Math.log(bytes) / Math.log(base));
  const size = (bytes / Math.pow(base, exp)).toFixed(1);
  
  // Remove unnecessary trailing .0
  const formatted = size.endsWith('.0') ? size.slice(0, -2) : size;
  
  return `${formatted} ${units[exp]}`;
};

module.exports = prettyBytes;
module.exports.default = prettyBytes;