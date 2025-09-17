/**
 * IPFS Upload Service
 * Handles uploading configuration data to IPFS via QuickNode
 */


export interface UploadResult {
  success: boolean;
  ipfsHash?: string;
  error?: string;
}

/**
 * Get QuickNode API key from config or environment
 */
function getQuickNodeApiKey(apiKey?: string): string {
  const key = apiKey;

  if (!key) {
    throw new Error('QuickNode API key is required - either from config.__env.quickNodeApiKey');
  }

  return key;
}

/**
 * Upload configuration data to IPFS via QuickNode
 */
export async function uploadConfigToIPFS(
  config: Record<string, unknown>,
  environmentName: string,
  quickNodeApiKey?: string
): Promise<UploadResult> {
  try {
    const apiKey = getQuickNodeApiKey(quickNodeApiKey);

    // Create JSON string from config
    const jsonString = JSON.stringify(config, null, 2);
    const fileName = `env-${environmentName}.json`;

    // Create FormData for QuickNode API
    const formData = new FormData();
    
    // Create Blob from JSON string
    const jsonBlob = new Blob([jsonString], { type: 'application/json' });
    
    // Append to FormData using QuickNode format
    formData.append("Body", jsonBlob, fileName);
    formData.append("Key", fileName);
    formData.append("ContentType", "application/json");

    // Upload to QuickNode
    const response = await fetch("https://api.quicknode.com/ipfs/rest/v1/s3/put-object", {
      method: 'POST',
      headers: {
        'x-api-key': apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QuickNode upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // Extract CID from QuickNode response
    const ipfsHash = result.pin?.cid || result.cid || result.hash;
    
    if (!ipfsHash) {
      throw new Error('No IPFS hash returned from QuickNode');
    }

    return {
      success: true,
      ipfsHash: ipfsHash
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error'
    };
  }
}

/**
 * Check if QuickNode is configured (either via env or config)
 */
export function isQuickNodeConfigured(quickNodeApiKey?: string): boolean {
  return !!(quickNodeApiKey);
}

/**
 * Get upload status message
 */
export function getUploadStatusMessage(environmentName: string): string {
  if (!isQuickNodeConfigured()) {
    return 'QuickNode not configured. Please set quickNodeApiKey in _env section in config';
  }
  return `Ready to upload ${environmentName} configuration to IPFS via QuickNode`;
}


