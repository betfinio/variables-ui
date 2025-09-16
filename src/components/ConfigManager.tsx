import { useState } from 'react';
import { ConfigUpload } from './ConfigUpload';
import { ConfigTabs } from './ConfigTabs';
import { fetchFromIPNS } from '@/services/ipnsFetcher';
import type { FetchedConfig } from '@/services/ipnsFetcher';
import type { EnvironmentConfig, ConfigStructure, ConfigStructureWithEnv, ConfigStructureEnv } from '@/services/ipnsUpdater';

export function ConfigManager() {


  const [configEnvs, setConfigEnvs] = useState<ConfigStructureEnv["__env"]>();
  const [configStructure, setConfigStructure] = useState<ConfigStructure | null>(null);
  const [fetchedConfigs, setFetchedConfigs] = useState<Record<string, FetchedConfig[]>>({});
  const [currentIPFSHashes, setCurrentIPFSHashes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');

  // Handle config upload  
  const handleConfigLoaded = (config: ConfigStructureWithEnv) => {

    setConfigEnvs(config.__env as ConfigStructureEnv["__env"]);

    if (config.__env) {
      setConfigEnvs(config.__env);

    }

    const { __env, ...configWithoutEnd } = config;

    setConfigStructure(configWithoutEnd);
    setFetchedConfigs({});
    setCurrentIPFSHashes({}); // Clear hashes on new config load
    setError(null);


    const envNames = Object.keys(configWithoutEnd).map(name => name);
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



    try {
      let resolveResult;

      // Prefer private key resolution if available (generates correct IPNS name)
      if (environmentConfig?.ipnsPrivateKey) {

        const { resolveIPNSFromPrivateKey } = await import('@/services/ipnsUpdater');
        resolveResult = await resolveIPNSFromPrivateKey(environmentConfig.ipnsPrivateKey);
      } else {

        const { resolveIPNSFromPublicKey } = await import('@/services/ipnsUpdater');
        resolveResult = await resolveIPNSFromPublicKey(ipnsKey);
      }

      if (resolveResult.success && resolveResult.ipfsHash) {
        setCurrentIPFSHashes(prev => ({
          ...prev,
          [environmentName]: resolveResult.ipfsHash!
        }));
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
        [environmentName]: Object.entries(result.data ?? {}).map(([key, value]) => ({ key, value })) ?? []
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
      [environmentName]: prev[environmentName].map(item => {
        if (item.key === key) {
          return { ...item, value };
        }
        return item;
      })
    }));
  };

  // Update a key name (rename key)
  const handleUpdateKey = (environmentName: string, oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;

    setFetchedConfigs(prev => {
      const config = [...prev[environmentName]];
      const updatedConfig = config.map(item => {

        if (item.key === oldKey) {
          return { ...item, key: newKey };
        }
        return item;
      });

      return {
        ...prev,
        [environmentName]: updatedConfig
      };
    });
  };

  // Add new key-value pair
  const handleAddKey = (environmentName: string, key: string, value: string) => {
    if (!key.trim()) return;

    setFetchedConfigs(prev => ({
      ...prev,
      [environmentName]: [
        ...prev[environmentName] || [],
        { key, value }
      ]
    }));
  };

  // Remove key-value pair
  const handleRemoveKey = (environmentName: string, key: string) => {
    setFetchedConfigs(prev => {
      const newConfig = [...prev[environmentName]];
      const updatedConfig = newConfig.filter(item => item.key !== key);
      return {
        ...prev,
        [environmentName]: updatedConfig
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


  const handleUpdateEntireConfig = (environmentName: string, config: FetchedConfig[]) => {
    setFetchedConfigs(prev => ({
      ...prev,
      [environmentName]: config
    }));
  };

  if (!configStructure || !configEnvs) {
    return <ConfigUpload onConfigLoaded={handleConfigLoaded} />;
  }

  return (
    <ConfigTabs
      configEnvs={configEnvs}
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
      onUpdateEntireConfig={handleUpdateEntireConfig}
    />
  );
}

