import crypto from 'node:crypto';

/**
 * Chunker & Merkle Tree Engine for Content-Addressable Delta Sync
 */
export class Chunker {
  constructor(chunkSizeBytes = 64 * 1024) { // Default 64 KB chunks
    this.chunkSizeBytes = chunkSizeBytes;
  }

  static hashBuffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Slices a file buffer into content chunks with SHA-256 hashes
   */
  chunkFile(filename, buffer) {
    const chunks = [];
    const totalSize = buffer.length;
    let offset = 0;
    let index = 0;

    while (offset < totalSize) {
      const end = Math.min(offset + this.chunkSizeBytes, totalSize);
      const chunkBuf = buffer.subarray(offset, end);
      const hash = Chunker.hashBuffer(chunkBuf);

      chunks.push({
        index,
        offset,
        size: chunkBuf.length,
        hash,
        data: chunkBuf
      });

      offset = end;
      index++;
    }

    // Compute Merkle Root Hash
    const rootHash = this.computeMerkleRoot(chunks.map((c) => c.hash));

    const manifest = {
      filename,
      totalSize,
      chunkSizeBytes: this.chunkSizeBytes,
      chunkCount: chunks.length,
      rootHash,
      chunkHashes: chunks.map((c) => ({ index: c.index, size: c.size, hash: c.hash })),
      createdAt: Date.now()
    };

    return { manifest, chunks };
  }

  /**
   * Computes a Merkle root hash from an array of chunk hashes
   */
  computeMerkleRoot(hashes) {
    if (hashes.length === 0) return crypto.createHash('sha256').update('').digest('hex');
    let currentLevel = [...hashes];

    while (currentLevel.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          const combined = currentLevel[i] + currentLevel[i + 1];
          nextLevel.push(crypto.createHash('sha256').update(combined).digest('hex'));
        } else {
          nextLevel.push(currentLevel[i]);
        }
      }
      currentLevel = nextLevel;
    }

    return currentLevel[0];
  }

  /**
   * Computes the delta diff: returns which chunk indices are missing or mismatched
   */
  computeDelta(sourceManifest, destManifest) {
    if (!destManifest) {
      // Destination has nothing: all chunks required
      return {
        needsFullSync: true,
        missingChunkIndices: sourceManifest.chunkHashes.map((c) => c.index),
        bytesToTransfer: sourceManifest.totalSize
      };
    }

    if (sourceManifest.rootHash === destManifest.rootHash) {
      // In perfect sync! Zero bytes needed
      return {
        needsFullSync: false,
        missingChunkIndices: [],
        bytesToTransfer: 0
      };
    }

    // Compare chunk by chunk
    const missingIndices = [];
    let bytesToTransfer = 0;
    const destHashMap = new Map(destManifest.chunkHashes.map((c) => [c.index, c.hash]));

    for (const srcChunk of sourceManifest.chunkHashes) {
      const destHash = destHashMap.get(srcChunk.index);
      if (destHash !== srcChunk.hash) {
        missingIndices.push(srcChunk.index);
        bytesToTransfer += srcChunk.size;
      }
    }

    return {
      needsFullSync: false,
      missingChunkIndices: missingIndices,
      bytesToTransfer
    };
  }

  /**
   * Reassembles chunks into full file buffer and verifies root hash
   */
  reassemble(manifest, chunks) {
    // Sort chunks by index
    const sorted = [...chunks].sort((a, b) => a.index - b.index);
    const totalSize = sorted.reduce((acc, c) => acc + c.size, 0);
    const buffer = Buffer.alloc(totalSize);

    let offset = 0;
    for (const chunk of sorted) {
      chunk.data.copy(buffer, offset);
      offset += chunk.size;
    }

    // Verify root hash
    const recomputedRoot = this.computeMerkleRoot(sorted.map((c) => c.hash));
    if (recomputedRoot !== manifest.rootHash) {
      throw new Error(`Integrity verification failed! Expected ${manifest.rootHash}, got ${recomputedRoot}`);
    }

    return buffer;
  }
}
