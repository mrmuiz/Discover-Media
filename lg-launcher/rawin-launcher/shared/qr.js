// A QR code for a short text (the setup page's address), as rows of "1"
// (dark) and "0": byte mode, error correction M, versions 1 to 10, the mask
// with the lowest penalty. After Project Nayuki's QR Code generator (MIT).
// Plain ES5: on webOS 4 this runs on node 0.12.
'use strict';

// Per version (index 1 to 10): error correction codewords per block, and blocks.
var ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
var BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
var ECL_BITS = 0; // M

function rawModules(ver) {
  var result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    var n = Math.floor(ver / 7) + 2;
    result -= (25 * n - 10) * n - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}
function dataCodewords(ver) {
  return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * BLOCKS[ver];
}
function bit(x, i) { return ((x >>> i) & 1) !== 0; }

// Reed-Solomon over GF(2^8), modulus 0x11D.
function gfMul(x, y) {
  var z = 0;
  for (var i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xFF;
}
function rsDivisor(degree) {
  var result = [], i, j, root = 1;
  for (i = 0; i < degree - 1; i++) result.push(0);
  result.push(1);
  for (i = 0; i < degree; i++) {
    for (j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}
function rsRemainder(data, divisor) {
  var result = divisor.map(function () { return 0; });
  data.forEach(function (b) {
    var factor = b ^ result.shift();
    result.push(0);
    divisor.forEach(function (coef, i) { result[i] ^= gfMul(coef, factor); });
  });
  return result;
}

// The text's bytes as codewords: mode, length, data, terminator, padding.
function codewords(bytes, ver) {
  var bits = [], i;
  function put(value, len) { for (var k = len - 1; k >= 0; k--) bits.push((value >>> k) & 1); }
  put(4, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  for (i = 0; i < bytes.length; i++) put(bytes[i], 8);
  var capacity = dataCodewords(ver) * 8;
  put(0, Math.min(4, capacity - bits.length));
  put(0, (8 - bits.length % 8) % 8);
  for (var pad = 0xEC; bits.length < capacity; pad ^= 0xEC ^ 0x11) put(pad, 8);
  var out = [];
  for (i = 0; i < bits.length; i += 8) {
    var b = 0;
    for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
    out.push(b);
  }
  return out;
}
// Split into blocks, add each one's error correction, interleave.
function interleave(data, ver) {
  var numBlocks = BLOCKS[ver], eccLen = ECC_PER_BLOCK[ver];
  var raw = Math.floor(rawModules(ver) / 8);
  var numShort = numBlocks - raw % numBlocks, shortLen = Math.floor(raw / numBlocks);
  var div = rsDivisor(eccLen), blocks = [], i, j, k = 0;
  for (i = 0; i < numBlocks; i++) {
    var dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    var ecc = rsRemainder(dat, div);
    if (i < numShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  var result = [];
  for (i = 0; i < blocks[0].length; i++) {
    for (j = 0; j < blocks.length; j++) {
      if (i !== shortLen - eccLen || j >= numShort) result.push(blocks[j][i]);
    }
  }
  return result;
}

function Grid(ver) {
  this.size = ver * 4 + 17;
  this.mod = [];
  this.fn = [];
  for (var y = 0; y < this.size; y++) {
    this.mod.push([]); this.fn.push([]);
    for (var x = 0; x < this.size; x++) { this.mod[y].push(false); this.fn[y].push(false); }
  }
}
Grid.prototype.setFn = function (x, y, dark) { this.mod[y][x] = dark; this.fn[y][x] = true; };

function alignmentPositions(ver, size) {
  if (ver === 1) return [];
  var n = Math.floor(ver / 7) + 2;
  var step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  var result = [6];
  for (var pos = size - 7; result.length < n; pos -= step) result.splice(1, 0, pos);
  return result;
}
function drawFormat(g, mask) {
  var data = ECL_BITS << 3 | mask, rem = data, i;
  for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  var bits = (data << 10 | rem) ^ 0x5412, size = g.size;
  for (i = 0; i <= 5; i++) g.setFn(8, i, bit(bits, i));
  g.setFn(8, 7, bit(bits, 6));
  g.setFn(8, 8, bit(bits, 7));
  g.setFn(7, 8, bit(bits, 8));
  for (i = 9; i < 15; i++) g.setFn(14 - i, 8, bit(bits, i));
  for (i = 0; i < 8; i++) g.setFn(size - 1 - i, 8, bit(bits, i));
  for (i = 8; i < 15; i++) g.setFn(8, size - 15 + i, bit(bits, i));
  g.setFn(8, size - 8, true);
}
function drawFunctionPatterns(g, ver) {
  var size = g.size, i, j, dx, dy;
  for (i = 0; i < size; i++) { g.setFn(6, i, i % 2 === 0); g.setFn(i, 6, i % 2 === 0); }
  [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
    for (dy = -4; dy <= 4; dy++) {
      for (dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), x = c[0] + dx, y = c[1] + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) g.setFn(x, y, d !== 2 && d !== 4);
      }
    }
  });
  var pos = alignmentPositions(ver, size), n = pos.length;
  for (i = 0; i < n; i++) {
    for (j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (dy = -2; dy <= 2; dy++) {
        for (dx = -2; dx <= 2; dx++) g.setFn(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }
  drawFormat(g, 0);
  if (ver >= 7) {
    var rem = ver;
    for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    var bits = ver << 12 | rem;
    for (i = 0; i < 18; i++) {
      var a = size - 11 + i % 3, b = Math.floor(i / 3);
      g.setFn(a, b, bit(bits, i));
      g.setFn(b, a, bit(bits, i));
    }
  }
}
function drawCodewords(g, data) {
  var size = g.size, i = 0;
  for (var right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (var vert = 0; vert < size; vert++) {
      for (var j = 0; j < 2; j++) {
        var x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
        if (!g.fn[y][x] && i < data.length * 8) {
          g.mod[y][x] = bit(data[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }
}
function applyMask(g, mask) {
  for (var y = 0; y < g.size; y++) {
    for (var x = 0; x < g.size; x++) {
      var invert;
      switch (mask) {
        case 0: invert = (x + y) % 2 === 0; break;
        case 1: invert = y % 2 === 0; break;
        case 2: invert = x % 3 === 0; break;
        case 3: invert = (x + y) % 3 === 0; break;
        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: invert = x * y % 2 + x * y % 3 === 0; break;
        case 6: invert = (x * y % 2 + x * y % 3) % 2 === 0; break;
        default: invert = ((x + y) % 2 + x * y % 3) % 2 === 0;
      }
      if (!g.fn[y][x] && invert) g.mod[y][x] = !g.mod[y][x];
    }
  }
}
// Runs of one colour, 2x2 blocks and the dark/light balance (the finder-like
// pattern rule is left out: it only picks a slightly better mask).
function penalty(g) {
  var size = g.size, result = 0, dark = 0, x, y, run;
  for (y = 0; y < size; y++) {
    for (var pass = 0; pass < 2; pass++) {
      run = 1;
      for (x = 1; x < size; x++) {
        var a = pass ? g.mod[x][y] : g.mod[y][x], b = pass ? g.mod[x - 1][y] : g.mod[y][x - 1];
        if (a === b) { run++; if (run === 5) result += 3; else if (run > 5) result++; } else run = 1;
      }
    }
  }
  for (y = 0; y < size - 1; y++) {
    for (x = 0; x < size - 1; x++) {
      var c = g.mod[y][x];
      if (c === g.mod[y][x + 1] && c === g.mod[y + 1][x] && c === g.mod[y + 1][x + 1]) result += 3;
    }
  }
  for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (g.mod[y][x]) dark++;
  var total = size * size;
  result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return result;
}

function encode(text) {
  var bytes = [], s = unescape(encodeURIComponent(String(text))), i;
  for (i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
  var ver = 1;
  while (ver <= 10 && dataCodewords(ver) < bytes.length + (ver < 10 ? 2 : 3)) ver++;
  if (ver > 10) return null;
  var data = interleave(codewords(bytes, ver), ver);
  var best = null, bestPenalty = Infinity;
  for (var mask = 0; mask < 8; mask++) {
    var g = new Grid(ver);
    drawFunctionPatterns(g, ver);
    drawCodewords(g, data);
    applyMask(g, mask);
    drawFormat(g, mask);
    var p = penalty(g);
    if (p < bestPenalty) { best = g; bestPenalty = p; }
  }
  return best.mod.map(function (row) { return row.map(function (d) { return d ? '1' : '0'; }).join(''); });
}

module.exports = { encode: encode };
