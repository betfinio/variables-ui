/**
 * IPFS Upload Service
 * Handles uploading configuration data to IPFS via Pinata
 */

import { PinataSDK } from "pinata";
import type { FetchedConfig } from './ipnsFetcher';

export interface UploadResult {
  success: boolean;
  ipfsHash?: string;
  error?: string;
}

/**
 * Get configured Pinata instance
 */
function getPinataInstance(pinataJwt?: string) {
  const jwt = pinataJwt || import.meta.env.VITE_PINATA_JWT;
  
  if (!jwt) {
    throw new Error('Pinata JWT is required - either from config._env.pinataJWT or VITE_PINATA_JWT environment variable');
  }

  return new PinataSDK({
    pinataJwt: jwt,
    pinataGateway: "https://gateway.pinata.cloud"
  });
}

/**
 * Upload configuration data to IPFS
 */
export async function uploadConfigToIPFS(
  config: FetchedConfig, 
  environmentName: string,
  pinataJWT?: string
): Promise<UploadResult> {
  try {
    const pinataInstance = getPinataInstance(pinataJWT);
    
    // Test authentication first
    await pinataInstance.testAuthentication();
    
    // Create a File object with the JSON data and proper filename
    const jsonString = JSON.stringify(config, null, 2);
    const fileName = `${environmentName}`;
    
    // Create File object with the specific filename (this is what controls the actual filename)
    const file = new File([jsonString], fileName, { 
      type: 'application/json' 
    });
    
    // Upload using fileArray to preserve the filename
    const upload = await pinataInstance.upload.public.file(file, {
      metadata: {
    
        name: fileName,
        keyvalues: {
          environment: environmentName,
          type: 'configuration',
          timestamp: new Date().toISOString()
        }
      }
    });

    return {
      success: true,
      ipfsHash: upload.cid
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error'
    };
  }
}

/**
 * Check if Pinata is configured (either via env or config)
 */
export function isPinataConfigured(pinataJWT?: string): boolean {
  return !!(pinataJWT || import.meta.env.VITE_PINATA_JWT);
}

/**
 * Get upload status message
 */
export function getUploadStatusMessage(environmentName: string): string {
  if (!isPinataConfigured()) {
    return 'Pinata not configured. Please set VITE_PINATA_JWT environment variable.';
  }
  return `Ready to upload ${environmentName} configuration to IPFS`;
}