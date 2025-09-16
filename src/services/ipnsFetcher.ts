
/**
 * IPNS Fetcher Service
 * Handles fetching configuration data from IPNS
 */

export interface FetchedConfig {
  key: string;
  value: string | FetchedConfig;
}

export interface FetchResult {
  success: boolean;
  data?: FetchedConfig;
  ipfsHash?: string;
  error?: string;
}

/**
 * Fetch content from IPNS using the provided public key
 */
export async function fetchFromIPNS(ipnsKey: string): Promise<FetchResult> {
  try {


    const response = await fetch(`https://ipfs.io/ipns/${ipnsKey}`);

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch: ${response.status} ${response.statusText}`
      };
    }


    // Extract IPFS hash from response headers or URL redirects
    let ipfsHash: string | undefined;

    // Check if we can get the IPFS hash from the X-Ipfs-Roots header
    const ipfsRoots = response.headers.get('X-Ipfs-Roots');
    if (ipfsRoots) {
      // X-Ipfs-Roots contains the actual IPFS hash directly
      ipfsHash = ipfsRoots.trim();
    }

    // Also check the final URL after redirects
    if (!ipfsHash && response.url) {
      const urlHashMatch = response.url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
      if (urlHashMatch) {
        ipfsHash = urlHashMatch[1];
      }
    }

    const data = await response.json();
    return {
      success: true,
      data,
      ipfsHash
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

import type { ConfigStructure } from './ipnsUpdater';

/**
 * Validate JSON structure for configuration
 */
export function validateConfigStructure(parsed: unknown): { valid: boolean; error?: string; config?: ConfigStructure } {
  if (typeof parsed !== 'object' || parsed === null) {
    return { valid: false, error: 'Invalid JSON structure' };
  }

  const config = parsed as Record<string, unknown>;
  
  for (const [envName, envConfig] of Object.entries(config)) {
    // Skip _env section - it's for environment variables
    if (envName === '__env') {
      continue;
    }
    
    if (typeof envConfig !== 'object' || envConfig === null || !('ipnsPublicKey' in envConfig)) {
      return { valid: false, error: `Environment "${envName}" missing ipnsPublicKey` };
    }
  }

  return { valid: true, config: config as ConfigStructure };
}
