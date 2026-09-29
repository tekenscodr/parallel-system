/**
 * Pure TypeScript ISO/IEC 18004 QR Code SVG Generator (Versions 1–14, ECC Level L, Byte Mode)
 * Zero external dependencies. Evaluates all 8 ISO masks and produces crisp, scannable vector <svg> QR codes.
 */

// Reed-Solomon GF(256) with primitive polynomial 0x11D (x^8 + x^4 + x^3 + x^2 + 1)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsComputeRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

interface VersionSpec {
  version: number;
  totalCodewords: number;
  ecCodewordsPerBlock: number;
  numBlocksGroup1: number;
  dataCodewordsGroup1: number;
  numBlocksGroup2: number;
  dataCodewordsGroup2: number;
  alignmentCenters: number[];
}

// ECC Level L specifications for Versions 1 to 14
const VERSION_SPECS_L: VersionSpec[] = [
  { version: 1, totalCodewords: 26, ecCodewordsPerBlock: 7, numBlocksGroup1: 1, dataCodewordsGroup1: 19, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [] },
  { version: 2, totalCodewords: 44, ecCodewordsPerBlock: 10, numBlocksGroup1: 1, dataCodewordsGroup1: 34, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 18] },
  { version: 3, totalCodewords: 70, ecCodewordsPerBlock: 15, numBlocksGroup1: 1, dataCodewordsGroup1: 55, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 22] },
  { version: 4, totalCodewords: 100, ecCodewordsPerBlock: 20, numBlocksGroup1: 1, dataCodewordsGroup1: 80, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 26] },
  { version: 5, totalCodewords: 134, ecCodewordsPerBlock: 26, numBlocksGroup1: 1, dataCodewordsGroup1: 108, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 30] },
  { version: 6, totalCodewords: 172, ecCodewordsPerBlock: 18, numBlocksGroup1: 2, dataCodewordsGroup1: 68, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 34] },
  { version: 7, totalCodewords: 196, ecCodewordsPerBlock: 20, numBlocksGroup1: 2, dataCodewordsGroup1: 78, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 22, 38] },
  { version: 8, totalCodewords: 242, ecCodewordsPerBlock: 24, numBlocksGroup1: 2, dataCodewordsGroup1: 97, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 24, 42] },
  { version: 9, totalCodewords: 292, ecCodewordsPerBlock: 30, numBlocksGroup1: 2, dataCodewordsGroup1: 116, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 26, 46] },
  { version: 10, totalCodewords: 346, ecCodewordsPerBlock: 18, numBlocksGroup1: 2, dataCodewordsGroup1: 68, numBlocksGroup2: 2, dataCodewordsGroup2: 69, alignmentCenters: [6, 28, 50] },
  { version: 11, totalCodewords: 404, ecCodewordsPerBlock: 20, numBlocksGroup1: 4, dataCodewordsGroup1: 81, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 30, 54] },
  { version: 12, totalCodewords: 466, ecCodewordsPerBlock: 24, numBlocksGroup1: 2, dataCodewordsGroup1: 92, numBlocksGroup2: 2, dataCodewordsGroup2: 93, alignmentCenters: [6, 32, 58] },
  { version: 13, totalCodewords: 532, ecCodewordsPerBlock: 26, numBlocksGroup1: 4, dataCodewordsGroup1: 107, numBlocksGroup2: 0, dataCodewordsGroup2: 0, alignmentCenters: [6, 34, 62] },
  { version: 14, totalCodewords: 581, ecCodewordsPerBlock: 30, numBlocksGroup1: 3, dataCodewordsGroup1: 115, numBlocksGroup2: 1, dataCodewordsGroup2: 116, alignmentCenters: [6, 26, 46, 66] },
  { version: 15, totalCodewords: 655, ecCodewordsPerBlock: 22, numBlocksGroup1: 5, dataCodewordsGroup1: 87, numBlocksGroup2: 1, dataCodewordsGroup2: 88, alignmentCenters: [6, 26, 48, 70] },
  { version: 16, totalCodewords: 733, ecCodewordsPerBlock: 24, numBlocksGroup1: 5, dataCodewordsGroup1: 98, numBlocksGroup2: 1, dataCodewordsGroup2: 99, alignmentCenters: [6, 26, 50, 74] },
  { version: 17, totalCodewords: 815, ecCodewordsPerBlock: 28, numBlocksGroup1: 1, dataCodewordsGroup1: 107, numBlocksGroup2: 5, dataCodewordsGroup2: 108, alignmentCenters: [6, 30, 54, 78] },
  { version: 18, totalCodewords: 901, ecCodewordsPerBlock: 30, numBlocksGroup1: 5, dataCodewordsGroup1: 120, numBlocksGroup2: 1, dataCodewordsGroup2: 121, alignmentCenters: [6, 30, 56, 82] },
  { version: 19, totalCodewords: 991, ecCodewordsPerBlock: 28, numBlocksGroup1: 3, dataCodewordsGroup1: 113, numBlocksGroup2: 4, dataCodewordsGroup2: 114, alignmentCenters: [6, 30, 58, 86] },
  { version: 20, totalCodewords: 1085, ecCodewordsPerBlock: 28, numBlocksGroup1: 3, dataCodewordsGroup1: 107, numBlocksGroup2: 5, dataCodewordsGroup2: 108, alignmentCenters: [6, 34, 62, 90] },
];

function selectVersion(byteLength: number): VersionSpec {
  for (const spec of VERSION_SPECS_L) {
    const totalDataCodewords =
      spec.numBlocksGroup1 * spec.dataCodewordsGroup1 +
      spec.numBlocksGroup2 * spec.dataCodewordsGroup2;
    const headerBits = 4 + (spec.version <= 9 ? 8 : 16);
    const capacityBytes = Math.floor((totalDataCodewords * 8 - headerBits) / 8);
    if (byteLength <= capacityBytes) {
      return spec;
    }
  }
  return VERSION_SPECS_L[VERSION_SPECS_L.length - 1];
}

function encodeDataCodewords(bytes: Uint8Array, spec: VersionSpec): Uint8Array {
  const totalDataCodewords =
    spec.numBlocksGroup1 * spec.dataCodewordsGroup1 +
    spec.numBlocksGroup2 * spec.dataCodewordsGroup2;
  const headerBits = 4 + (spec.version <= 9 ? 8 : 16);
  const maxPayloadBytes = Math.floor((totalDataCodewords * 8 - headerBits) / 8);
  const safeBytes = bytes.length > maxPayloadBytes ? bytes.slice(0, maxPayloadBytes) : bytes;
  const bits: number[] = [];

  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Byte mode indicator: 0100
  pushBits(0b0100, 4);
  // Character count indicator
  pushBits(safeBytes.length, spec.version <= 9 ? 8 : 16);
  // Payload bytes
  for (let i = 0; i < safeBytes.length; i++) {
    pushBits(safeBytes[i], 8);
  }

  // Terminator (up to 4 zero bits)
  const maxBits = totalDataCodewords * 8;
  const termLen = Math.max(0, Math.min(4, maxBits - bits.length));
  pushBits(0, termLen);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords = new Uint8Array(totalDataCodewords);
  const byteLen = bits.length / 8;
  for (let i = 0; i < byteLen; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i * 8 + j];
    }
    codewords[i] = b;
  }

  // Pad remaining codewords with alternating 0xEC, 0x11
  let padIdx = 0;
  for (let i = byteLen; i < totalDataCodewords; i++) {
    codewords[i] = padIdx % 2 === 0 ? 0xec : 0x11;
    padIdx++;
  }

  return codewords;
}

function interleaveBlocks(dataCodewords: Uint8Array, spec: VersionSpec): Uint8Array {
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;

  for (let i = 0; i < spec.numBlocksGroup1; i++) {
    const block = dataCodewords.slice(offset, offset + spec.dataCodewordsGroup1);
    offset += spec.dataCodewordsGroup1;
    dataBlocks.push(block);
    ecBlocks.push(rsComputeRemainder(block, spec.ecCodewordsPerBlock));
  }
  for (let i = 0; i < spec.numBlocksGroup2; i++) {
    const block = dataCodewords.slice(offset, offset + spec.dataCodewordsGroup2);
    offset += spec.dataCodewordsGroup2;
    dataBlocks.push(block);
    ecBlocks.push(rsComputeRemainder(block, spec.ecCodewordsPerBlock));
  }

  const result = new Uint8Array(spec.totalCodewords);
  let ptr = 0;
  const maxDataLen = Math.max(spec.dataCodewordsGroup1, spec.dataCodewordsGroup2);
  for (let col = 0; col < maxDataLen; col++) {
    for (const block of dataBlocks) {
      if (col < block.length) {
        result[ptr++] = block[col];
      }
    }
  }
  for (let col = 0; col < spec.ecCodewordsPerBlock; col++) {
    for (const ec of ecBlocks) {
      result[ptr++] = ec[col];
    }
  }

  return result;
}

function computeFormatBits(eccFormatBits: number, mask: number): number {
  const data = (eccFormatBits << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) {
      rem ^= 0x537 << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function computeVersionBits(version: number): number {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--) {
    if ((rem >>> i) & 1) {
      rem ^= 0x1f25 << (i - 12);
    }
  }
  return (version << 12) | rem;
}

function maskBit(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return false;
  }
}

function writeFormatBits(modules: boolean[][], size: number, eccFormatBits: number, mask: number): void {
  const formatBits = computeFormatBits(eccFormatBits, mask);

  // First copy: around top-left finder pattern
  // Bits 0..5 along col 8, rows 0..5
  for (let i = 0; i <= 5; i++) {
    modules[i][8] = ((formatBits >>> i) & 1) === 1;
  }
  // Bit 6 at (row 7, col 8), Bit 7 at (row 8, col 8), Bit 8 at (row 8, col 7)
  modules[7][8] = ((formatBits >>> 6) & 1) === 1;
  modules[8][8] = ((formatBits >>> 7) & 1) === 1;
  modules[8][7] = ((formatBits >>> 8) & 1) === 1;
  // Bits 9..14 along row 8, cols 5..0
  for (let i = 9; i < 15; i++) {
    modules[8][14 - i] = ((formatBits >>> i) & 1) === 1;
  }

  // Second copy: under top-right finder (row 8, cols size-1..size-8) and beside bottom-left finder (rows size-7..size-1, col 8)
  for (let i = 0; i < 8; i++) {
    modules[8][size - 1 - i] = ((formatBits >>> i) & 1) === 1;
  }
  for (let i = 8; i < 15; i++) {
    modules[size - 15 + i][8] = ((formatBits >>> i) & 1) === 1;
  }
}

function computePenaltyScore(modules: boolean[][]): number {
  const size = modules.length;
  let penalty = 0;

  // Rule 1: 5+ consecutive same-color modules in row or col
  for (let r = 0; r < size; r++) {
    let runColor = modules[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (modules[r][c] === runColor) {
        runLen++;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty += 1;
      } else {
        runColor = modules[r][c];
        runLen = 1;
      }
    }
  }

  for (let c = 0; c < size; c++) {
    let runColor = modules[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (modules[r][c] === runColor) {
        runLen++;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty += 1;
      } else {
        runColor = modules[r][c];
        runLen = 1;
      }
    }
  }

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const color = modules[r][c];
      if (
        modules[r][c + 1] === color &&
        modules[r + 1][c] === color &&
        modules[r + 1][c + 1] === color
      ) {
        penalty += 3;
      }
    }
  }

  // Rule 3: Finder-like 1:1:3:1:1 patterns preceded or followed by 4 light modules
  const isFinderLikeAt = (line: boolean[], idx: number): boolean => {
    // Pattern A: 10111010000
    const patA =
      line[idx] &&
      !line[idx + 1] &&
      line[idx + 2] &&
      line[idx + 3] &&
      line[idx + 4] &&
      !line[idx + 5] &&
      line[idx + 6] &&
      !line[idx + 7] &&
      !line[idx + 8] &&
      !line[idx + 9] &&
      !line[idx + 10];
    // Pattern B: 00001011101
    const patB =
      !line[idx] &&
      !line[idx + 1] &&
      !line[idx + 2] &&
      !line[idx + 3] &&
      line[idx + 4] &&
      !line[idx + 5] &&
      line[idx + 6] &&
      line[idx + 7] &&
      line[idx + 8] &&
      !line[idx + 9] &&
      line[idx + 10];
    return patA || patB;
  };

  for (let r = 0; r < size; r++) {
    const row = modules[r];
    for (let c = 0; c <= size - 11; c++) {
      if (isFinderLikeAt(row, c)) penalty += 40;
    }
  }
  for (let c = 0; c < size; c++) {
    const col: boolean[] = [];
    for (let r = 0; r < size; r++) col.push(modules[r][c]);
    for (let r = 0; r <= size - 11; r++) {
      if (isFinderLikeAt(col, r)) penalty += 40;
    }
  }

  // Rule 4: Balance of dark and light modules
  let darkCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) darkCount++;
    }
  }
  const totalModules = size * size;
  const fivePercentSteps = Math.floor((Math.abs(darkCount * 20 - totalModules * 10) + totalModules - 1) / totalModules) - 1;
  if (fivePercentSteps > 0) {
    penalty += fivePercentSteps * 10;
  }

  return penalty;
}

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const spec = selectVersion(bytes.length);
  const size = spec.version * 4 + 17;

  const baseModules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunctionModule = (r: number, c: number, dark: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      baseModules[r][c] = dark;
      isFunction[r][c] = true;
    }
  };

  // Finder patterns + separators
  const drawFinder = (topR: number, leftC: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topR + dr;
        const c = leftC + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onOuterBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunctionModule(r, c, inOuter && (onOuterBorder || inInner));
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const centers = spec.alignmentCenters;
  for (const r of centers) {
    for (const c of centers) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunctionModule(r + dr, c + dc, dist !== 1);
        }
      }
    }
  }

  // Dark module at (row = 4 * version + 9, col = 8)
  setFunctionModule(4 * spec.version + 9, 8, true);

  // Reserve format info areas
  for (let i = 0; i <= 8; i++) {
    if (!isFunction[8][i]) setFunctionModule(8, i, false);
    if (!isFunction[i][8]) setFunctionModule(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    setFunctionModule(8, size - 1 - i, false);
  }
  for (let i = 0; i < 7; i++) {
    setFunctionModule(size - 1 - i, 8, false);
  }

  // Version info for version >= 7
  if (spec.version >= 7) {
    const vBits = computeVersionBits(spec.version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunctionModule(b, a, bit);
      setFunctionModule(a, b, bit);
    }
  }

  // Encode & place data bits
  const dataCw = encodeDataCodewords(bytes, spec);
  const allCw = interleaveBlocks(dataCw, spec);

  let bitIdx = 0;
  const totalBits = allCw.length * 8;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // Skip vertical timing pattern
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!isFunction[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            const byteVal = allCw[bitIdx >>> 3];
            dark = ((byteVal >>> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          baseModules[r][c] = dark;
        }
      }
    }
    upward = !upward;
  }

  // Evaluate all 8 masks and pick the lowest penalty score
  let bestMask = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;
  let bestGrid: boolean[][] = baseModules;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = baseModules.map((row, r) =>
      row.map((val, c) => (!isFunction[r][c] && maskBit(mask, r, c) ? !val : val))
    );
    writeFormatBits(candidate, size, 0b01, mask);
    const penalty = computePenaltyScore(candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
      bestGrid = candidate;
    }
  }

  writeFormatBits(bestGrid, size, 0b01, bestMask);
  return bestGrid;
}

export function renderQrCodeSvg(
  text: string,
  options?: {
    size?: number;
    color?: string;
    bgColor?: string;
    margin?: number;
  }
): string {
  const matrix = generateQrMatrix(text);
  const n = matrix.length;
  const minMargin = Math.max(1, options?.margin ?? 2);
  const pxSize = options?.size ?? 74;
  const color = options?.color ?? "#000000";
  const bgColor = options?.bgColor ?? "#FFFFFF";

  // Snap module width to exact integer pixels inside the target box so every module
  // has an identical width/height with zero subpixel rounding distortion.
  const minGrid = n + minMargin * 2;
  const scale = Math.max(1, Math.floor(pxSize / minGrid));
  const viewSize = pxSize >= minGrid ? pxSize : minGrid;
  const offset = Math.floor((viewSize - n * scale) / 2);

  const pathParts: string[] = [];
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (matrix[r][c]) {
        let runLen = 1;
        while (c + runLen < n && matrix[r][c + runLen]) {
          runLen++;
        }
        const x = offset + c * scale;
        const y = offset + r * scale;
        const w = runLen * scale;
        pathParts.push(`M${x},${y}h${w}v${scale}h-${w}z`);
        c += runLen;
      } else {
        c++;
      }
    }
  }

  return `<svg width="${pxSize}" height="${pxSize}" viewBox="0 0 ${viewSize} ${viewSize}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="display:block;"><rect width="${viewSize}" height="${viewSize}" fill="${bgColor}"/><path d="${pathParts.join("")}" fill="${color}"/></svg>`;
}
