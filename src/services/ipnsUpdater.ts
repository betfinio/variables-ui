/**
 * IPNS Update Service
 * Handles updating IPNS records to point to new IPFS content
 */

import { createHeliaHTTP } from '@helia/http'

import { CID } from 'multiformats/cid'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { base36 } from 'multiformats/bases/base36'
import { privateKeyFromProtobuf } from '@libp2p/crypto/keys'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { createIPNSRecord, marshalIPNSRecord, multihashToIPNSRoutingKey } from 'ipns'

export interface IPNSUpdateResult {
  success: boolean;
  ipnsName?: string;
  error?: string;
}

export interface IPNSResolveResult {
  success: boolean;
  ipfsHash?: string;
  ipnsName?: string;
  error?: string;
}

export interface EnvironmentConfig {
  ipnsPublicKey: string;
  ipnsPrivateKey?: string;
  [key: string]: unknown;
}


export type ConfigStructureWithEnv = ConfigStructureEnv & ConfigStructure;

export interface ConfigStructureEnv {
  __env: {
    quickNodeApiKey: string;
    [key: string]: unknown;
  };
}

export interface ConfigStructure {

  [environmentName: string]: EnvironmentConfig | {
    quickNodeApiKey?: string;
    [key: string]: unknown;
  };
}

// Constants for IPNS record creation (from ipns-publish.ts)
const DEFAULT_TTL_MS = 60 * 1000 // 1 min
const DEFAULT_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000 // 1 year

/**
 * Get IPNS name from a private key (from ipns-publish.ts)
 */
function getIPNSNameFromKeypair(privateKey: any): string {
  if (!privateKey) return ''
  return peerIdFromPrivateKey(privateKey).toCID().toString(base36)
}

/**
 * Create a simple resolution function that works with just the IPNS public key
 */
export async function resolveIPNSFromPublicKey(
  ipnsPublicKey: string
): Promise<IPNSResolveResult> {
  try {

    // Try multiple resolution methods using the public key directly
    // NOTE: Public key format (k51...) cannot be used with delegated routing API
    // Only use gateway-based resolution methods
    const resolutionMethods = [
      // Method 1: Try fetching from gateway and check headers
      async () => {
        const response = await fetch(`https://ipfs.io/ipns/${ipnsPublicKey}`, {
          method: 'HEAD'
        });

        if (response.ok) {
          const ipfsRoots = response.headers.get('X-Ipfs-Roots');
          if (ipfsRoots) {
            return ipfsRoots.trim();
          }
        }
        throw new Error(`Gateway header resolution failed: ${response.status}`);
      },

      // Method 2: Try Cloudflare IPFS gateway
      async () => {
        const response = await fetch(`https://cloudflare-ipfs.com/ipns/${ipnsPublicKey}`, {
          method: 'HEAD'
        });

        if (response.ok) {
          const ipfsRoots = response.headers.get('X-Ipfs-Roots');
          if (ipfsRoots) {
            return ipfsRoots.trim();
          }
        }
        throw new Error(`Cloudflare gateway failed: ${response.status}`);
      }
    ];

    // Try each method until one succeeds
    for (const method of resolutionMethods) {
      try {
        const ipfsHash = await method();
        return {
          success: true,
          ipfsHash,
          ipnsName: ipnsPublicKey
        };
      } catch (error) {
        console.warn(`⚠️ Resolution method failed:`, error);
        continue;
      }
    }

    return {
      success: false,
      ipnsName: ipnsPublicKey,
      error: 'All resolution methods failed'
    };

  } catch (error) {
    console.error('❌ IPNS resolve failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown IPNS resolve error'
    };
  }
}

/**
 * Resolve IPNS record to get current IPFS hash using private key (generates correct IPNS name)
 */
export async function resolveIPNSFromPrivateKey(
  privateKeyBase64: string
): Promise<IPNSResolveResult> {
  try {

    // Parse private key to get IPNS name
    const keypair = privateKeyFromProtobuf(uint8ArrayFromString(privateKeyBase64, 'base64'))
    if (keypair.type !== 'Ed25519') {
      throw new Error('Only libp2p Ed25519 keys are supported')
    }

    // Get IPNS name
    const ipnsName = getIPNSNameFromKeypair(keypair)

    // Try multiple resolution methods
    const resolutionMethods = [
      // Method 1: Try fetching from gateway and check headers (most reliable)
      async () => {
        const response = await fetch(`https://ipfs.io/ipns/${ipnsName}`, {
          method: 'HEAD' // Just get headers, don't download content
        });

        if (response.ok) {
          const ipfsRoots = response.headers.get('X-Ipfs-Roots');
          if (ipfsRoots) {
            return ipfsRoots.trim();
          }
        }
        throw new Error(`Gateway header resolution failed: ${response.status}`);
      },

      // Method 2: Try Cloudflare IPFS gateway
      async () => {
        const response = await fetch(`https://cloudflare-ipfs.com/ipns/${ipnsName}`, {
          method: 'HEAD'
        });

        if (response.ok) {
          const ipfsRoots = response.headers.get('X-Ipfs-Roots');
          if (ipfsRoots) {
            return ipfsRoots.trim();
          }
        }
        throw new Error(`Cloudflare gateway failed: ${response.status}`);
      }
    ];

    // Try each method until one succeeds
    for (const method of resolutionMethods) {
      try {
        const ipfsHash = await method();
        return {
          success: true,
          ipfsHash,
          ipnsName
        };
      } catch (error) {
        console.warn(`⚠️ Resolution method failed:`, error);
        continue;
      }
    }

    return {
      success: false,
      ipnsName,
      error: 'All resolution methods failed'
    };

  } catch (error) {
    console.error('❌ IPNS resolve failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown IPNS resolve error'
    };
  }
}

/**
 * Update IPNS record to point to new IPFS content
 */
export async function updateIPNSRecord(
  ipfsHash: string,
  privateKeyBase64: string
): Promise<IPNSUpdateResult> {
  let helia: any

  try {



    // Create Helia instance (from ipns-publish.ts)
    helia = await createHeliaHTTP()


    // Parse private key (from ipns-publish.ts)
    const keypair = privateKeyFromProtobuf(uint8ArrayFromString(privateKeyBase64, 'base64'))
    if (keypair.type !== 'Ed25519') {
      throw new Error('Only libp2p Ed25519 keys are supported')
    }

    // Parse CID (from ipns-publish.ts)
    const cid = CID.parse(ipfsHash)

    // Get IPNS name (from ipns-publish.ts)
    const ipnsName = getIPNSNameFromKeypair(keypair)


    // Use timestamp-based sequence number to ensure it's always incrementing (from ipns-publish.ts)
    const sequenceNumber = BigInt(Date.now())

    const ttlMs = DEFAULT_TTL_MS
    const lifetime = DEFAULT_LIFETIME_MS

    // Create IPNS record (from ipns-publish.ts)
    const record = await createIPNSRecord(keypair, cid, sequenceNumber, lifetime, {
      ttlNs: BigInt(ttlMs) * 1_000_000n // convert to nanoseconds
    })

    // Marshal and publish (from ipns-publish.ts)
    const marshaledRecord = marshalIPNSRecord(record)
    const routingKey = multihashToIPNSRoutingKey(keypair.publicKey.toMultihash())

    await helia.routing.put(routingKey, marshaledRecord)


    return {
      success: true,
      ipnsName: ipnsName
    };

  } catch (error) {
    console.error('❌ IPNS update failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown IPNS update error'
    };
  } finally {
    // Always stop Helia to allow process to exit (from ipns-publish.ts)
    if (helia) {
      try {
        await helia.stop()
      } catch (stopError) {
        console.warn('⚠️  Warning: Error stopping Helia:', stopError)
      }
    }
  }
}

/**
 * Get IPNS private key from environment configuration
 * The private key should be included in the uploaded JSON structure
 */
export function getIPNSPrivateKeyFromConfig(environmentConfig: EnvironmentConfig): string | null {
  return environmentConfig?.ipnsPrivateKey || null;
}

/**
 * Check if IPNS is configured for an environment config
 */
export function isIPNSConfiguredForEnvironmentConfig(environmentConfig: EnvironmentConfig): boolean {
  const privateKey = getIPNSPrivateKeyFromConfig(environmentConfig);
  return !!privateKey;
}

/**
 * Upload to IPFS and update IPNS in one operation
 */
export async function uploadAndUpdateIPNS(
  config: Record<string, unknown>,
  environmentName: string,
  environmentConfig: EnvironmentConfig,

  quickNodeApiKey: string,
  uploadToIPFS: (config: Record<string, unknown>, env: string, quickNodeApiKey?: string) => Promise<{ success: boolean; ipfsHash?: string; error?: string }>
): Promise<{ ipfsResult: { success: boolean; ipfsHash?: string; error?: string }; ipnsResult?: IPNSUpdateResult }> {



  // First upload to IPFS
  const ipfsResult = await uploadToIPFS(config, environmentName, quickNodeApiKey);

  if (!ipfsResult.success || !ipfsResult.ipfsHash) {
    return { ipfsResult };
  }

  // Then update IPNS if configured in the environment config
  const privateKey = getIPNSPrivateKeyFromConfig(environmentConfig);
  if (!privateKey) {
    return { ipfsResult };
  }

  const ipnsResult = await updateIPNSRecord(ipfsResult.ipfsHash, privateKey);

  return { ipfsResult, ipnsResult };
}
