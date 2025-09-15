import { useState } from 'react';
import { ConfigUpload } from './ConfigUpload';
import { ConfigTabs } from './ConfigTabs';
import { fetchFromIPNS } from '@/services/ipnsFetcher';
import type { FetchedConfig } from '@/services/ipnsFetcher';
import type { EnvironmentConfig, ConfigStructure } from '@/services/ipnsUpdater';

export function ConfigManager() {
  
  const [configStructure, setConfigStructure] = useState<ConfigStructure | null>(null);
  const [fetchedConfigs, setFetchedConfigs] = useState<Record<string, FetchedConfig>>({});
  const [currentIPFSHashes, setCurrentIPFSHashes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');

  // Handle config upload  
  const handleConfigLoaded = (config: ConfigStructure) => {
    setConfigStructure(config);
    setFetchedConfigs({});
    setCurrentIPFSHashes({}); // Clear hashes on new config load
    setError(null);
    
    // Set first environment as active tab (skip _env)
    const envNames = Object.keys(config).filter(name => name !== '_env');
    const firstEnv = envNames[0];
    if (firstEnv) {
      setActiveTab(firstEnv);
    }
  };

  // Fetch content from IPNS
  const handleFetch = async (environmentName: string, ipnsKey: string) => {
    setLoading(prev => ({ ...prev, [environmentName]: true }));
    setError(null);

        // First, try to resolve IPNS to get current IPFS hash
        const environmentConfig = configStructure?.[environmentName] as EnvironmentConfig;
        
        console.log(`🔍 Environment: ${environmentName}`);
        console.log(`🔍 Public key (ipnsKey): ${ipnsKey}`);
        console.log(`🔍 Has private key: ${!!environmentConfig?.ipnsPrivateKey}`);
    
    try {
      let resolveResult;
      
      // Prefer private key resolution if available (generates correct IPNS name)
      if (environmentConfig?.ipnsPrivateKey) {
        console.log(`🔑 Using private key for IPNS resolution`);
        console.log(`🔑 Private key length: ${environmentConfig.ipnsPrivateKey.length}`);
        const { resolveIPNSFromPrivateKey } = await import('@/services/ipnsUpdater');
        resolveResult = await resolveIPNSFromPrivateKey(environmentConfig.ipnsPrivateKey);
      } else {
        // Fallback to public key resolution
        console.log(`🔓 Using public key for IPNS resolution`);
        const { resolveIPNSFromPublicKey } = await import('@/services/ipnsUpdater');
        resolveResult = await resolveIPNSFromPublicKey(ipnsKey);
      }
      
      if (resolveResult.success && resolveResult.ipfsHash) {
        setCurrentIPFSHashes(prev => ({
          ...prev,
          [environmentName]: resolveResult.ipfsHash!
        }));
        console.log(`🔍 Resolved IPNS to IPFS hash: ${resolveResult.ipfsHash}`);
      } else {
        console.warn(`⚠️ Could not resolve IPNS: ${resolveResult.error}`);
      }
    } catch (error) {
      console.warn(`⚠️ Error resolving IPNS:`, error);
    }

    // Then fetch the actual content
    const result = await fetchFromIPNS(ipnsKey);
    
    if (result.success && result.data) {
      setFetchedConfigs(prev => ({
        ...prev,
        [environmentName]: result.data ?? {}
      }));
      
      // Also store IPFS hash from gateway headers as fallback
      if (result.ipfsHash && !configStructure?.[environmentName]?.ipnsPrivateKey) {
        setCurrentIPFSHashes(prev => ({
          ...prev,
          [environmentName]: result.ipfsHash!
        }));
      }
    } else {
      setError(`Failed to fetch ${environmentName}: ${result.error}`);
    }
    
    setLoading(prev => ({ ...prev, [environmentName]: false }));
  };

  // Update a specific key-value pair
  const handleUpdateValue = (environmentName: string, key: string, value: string) => {
    setFetchedConfigs(prev => ({
      ...prev,
      [environmentName]: {
        ...prev[environmentName],
        [key]: value
      }
    }));
  };

  // Update a key name (rename key)
  const handleUpdateKey = (environmentName: string, oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    
    setFetchedConfigs(prev => {
      const config = { ...prev[environmentName] };
      const value = config[oldKey];
      delete config[oldKey];
      config[newKey] = value;
      
      return {
        ...prev,
        [environmentName]: config
      };
    });
  };

  // Add new key-value pair
  const handleAddKey = (environmentName: string, key: string, value: string) => {
    if (!key.trim()) return;
    
    setFetchedConfigs(prev => ({
      ...prev,
      [environmentName]: {
        ...prev[environmentName] || {},
        [key]: value
      }
    }));
  };

  // Remove key-value pair
  const handleRemoveKey = (environmentName: string, key: string) => {
    setFetchedConfigs(prev => {
      const newConfig = { ...prev[environmentName] };
      delete newConfig[key];
      return {
        ...prev,
        [environmentName]: newConfig
      };
    });
  };

  // Reset to upload state
  const handleReset = () => {
    setConfigStructure(null);
    setFetchedConfigs({});
    setCurrentIPFSHashes({});
    setError(null);
    setActiveTab('');
  };

  if (!configStructure) {
    return <ConfigUpload onConfigLoaded={handleConfigLoaded} />;
  }

      return (
        <ConfigTabs
          configStructure={configStructure}
          fetchedConfigs={fetchedConfigs}
          currentIPFSHashes={currentIPFSHashes}
          loading={loading}
          activeTab={activeTab}
          error={error}
          onTabChange={setActiveTab}
          onFetch={handleFetch}
          onUpdateValue={handleUpdateValue}
          onUpdateKey={handleUpdateKey}
          onAddKey={handleAddKey}
          onRemoveKey={handleRemoveKey}
          onReset={handleReset}
        />
      );
}

