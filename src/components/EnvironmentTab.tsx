import { useState } from 'react';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Download, FileText, Upload, Save } from 'lucide-react';
import type { FetchedConfig } from '@/services/ipnsFetcher';
import { uploadConfigToIPFS, isQuickNodeConfigured } from '@/services/ipfsUploader';
import { uploadAndUpdateIPNS, type EnvironmentConfig, type ConfigStructure, type ConfigStructureEnv } from '@/services/ipnsUpdater';

interface EnvironmentTabProps {
  configEnvs: ConfigStructureEnv["__env"];
  environmentName: string;
  ipnsPublicKey: string;
  environmentConfig: EnvironmentConfig;
  configStructure: ConfigStructure;
  fetchedConfig?: FetchedConfig[];
  currentIPFSHash?: string;
  loading: boolean;
  onFetch: () => void;
  onUpdateValue?: (key: string, value: string) => void;
  onUpdateKey?: (oldKey: string, newKey: string) => void;
  onAddKey: (environmentName: string, key: string, value: string) => void;
  onRemoveKey: (environmentName: string, key: string) => void;
  onUpdateEntireConfig: (config: FetchedConfig[]) => void;
}

export function EnvironmentTab({
  configEnvs,
  environmentName,
  ipnsPublicKey,
  environmentConfig,
  fetchedConfig,
  currentIPFSHash,
  loading,
  onFetch,
  onAddKey,
  onRemoveKey,
  onUpdateKey,
  onUpdateEntireConfig,
  onUpdateValue
}: EnvironmentTabProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawJsonValue, setRawJsonValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);


  const handleAddKey = () => {
    if (newKey.trim() && newValue.trim()) {
      onAddKey(environmentName, newKey.trim(), newValue.trim());
      setNewKey('');
      setNewValue('');
    }
  };

  // Update raw JSON when fetchedConfig changes
  React.useEffect(() => {
    if (fetchedConfig) {
      const fetchedConfigJson = JSON.stringify(fetchedConfig.reduce((acc, item) => {
        acc[item.key as string] = item.value as string;
        return acc;
      }, {} as Record<string, unknown>), null, 2);

      setRawJsonValue(fetchedConfigJson);
    } else if (!rawJsonValue) {
      // Initialize with empty object if no config and no existing value
      setRawJsonValue('');
    }
  }, [fetchedConfig]);



  // Handle raw JSON save (local only)
  const handleSaveRawJson = () => {
    try {
      const parsed = JSON.parse(rawJsonValue);

      // Clear existing config and add new config locally
      if (fetchedConfig) {
        Object.keys(fetchedConfig).forEach(k => onRemoveKey(environmentName, k));
      }

      Object.entries(parsed).forEach(([k, v]) => {
        onAddKey(environmentName, k, String(v));
      });

      // Show local save confirmation
      setUploadResult('✅ Changes saved locally!');

    } catch (error) {
      alert(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle upload to IPFS and update IPNS (merged functionality)
  const handleUploadAndPublish = async () => {
    let configToUpload: Record<string, unknown>;

    // If we have fetchedConfig, use it; otherwise parse from rawJsonValue
    if (fetchedConfig) {
      configToUpload = fetchedConfig.reduce((acc, item) => {

        acc[item.key as string] = item.value as string;
        return acc;
      }, {} as Record<string, unknown>);
    } else {
      try {
        configToUpload = JSON.parse(rawJsonValue);
      } catch (error) {
        setUploadResult(`❌ Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return;
      }
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const { ipfsResult, ipnsResult } = await uploadAndUpdateIPNS(
        configToUpload,
        environmentName,
        environmentConfig,
        configEnvs.quickNodeApiKey as string,
        uploadConfigToIPFS
      );

      if (ipfsResult.success && ipfsResult.ipfsHash) {
        let message = `✅ Uploaded to IPFS! Hash: ${ipfsResult.ipfsHash}`;

        if (ipnsResult) {
          if (ipnsResult.success && ipnsResult.ipnsName) {
            message += `\n🔗 IPNS Updated! Name: ${ipnsResult.ipnsName}`;
            message += `\n🌐 Access: https://ipfs.io/ipns/${ipnsResult.ipnsName}`;
          } else {
            message += `\n❌ IPNS update failed: ${ipnsResult.error}`;
          }
        } else {
          message += `\n⚠️ No IPNS private key found - IPFS upload only`;
        }

        setUploadResult(message);
      } else {
        setUploadResult(`❌ Upload failed: ${ipfsResult.error}`);
      }
    } catch (error) {
      setUploadResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };


  const handleUpdateJson = (json: string) => {

    try {

      const parsedJson = JSON.parse(json);
      const nextFetchedConfig = Object.entries(parsedJson).map(([k, v]) => ({ key: k, value: v as string }));

      onUpdateEntireConfig(nextFetchedConfig);
    } catch (error) {
      console.error("Error updating JSON", error);
    }
  };

  const handleSetShowRawJson = () => {
    setShowRawJson((prev) => {

      const nextValue = !prev

      if (!nextValue) {
        handleUpdateJson(rawJsonValue);
      }
      return nextValue;
    });

  };




  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="text-lg font-semibold">{environmentName} Environment</span>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={onFetch}
                disabled={loading}
                size="sm"
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                {loading ? 'Fetching...' : 'Fetch from IPNS'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSetShowRawJson}
                className="w-full sm:w-auto"
              >
                <FileText className="h-4 w-4 mr-2" />
                {showRawJson ? 'Hide' : 'Show'} JSON
              </Button>
              <Button
                onClick={handleUploadAndPublish}
                disabled={uploading || !isQuickNodeConfigured(configEnvs.quickNodeApiKey as string) || (showRawJson && !rawJsonValue.trim())}
                size="sm"
                className="w-full sm:w-auto"
                title={!isQuickNodeConfigured(configEnvs.quickNodeApiKey as string) ? 'Add quickNodeApiKey to _env section in config or create .env file with VITE_QUICKNODE_API_KEY' : 'Upload to IPFS and publish via IPNS'}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Publishing...' : (isQuickNodeConfigured(configEnvs.quickNodeApiKey as string) ? 'Upload & Publish' : 'Configure QuickNode')}
              </Button>
            </div>
          </CardTitle>
          <CardDescription className="space-y-2">
            <div className="text-sm">IPNS Key:</div>
            <code className="text-xs bg-muted px-2 py-1 rounded block font-mono break-all overflow-wrap-anywhere">
              {ipnsPublicKey}
            </code>
            {currentIPFSHash && (
              <>
                <div className="text-sm">Current IPFS Hash:</div>
                <code className="text-xs bg-muted px-2 py-1 rounded block font-mono break-all overflow-wrap-anywhere">
                  {currentIPFSHash}
                </code>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {uploadResult && (
            <div className="mb-4 p-3 rounded-lg bg-muted text-sm font-mono whitespace-pre-wrap">
              {uploadResult}
            </div>
          )}

          {!fetchedConfig && !loading && !showRawJson && (
            <p className="text-muted-foreground text-center py-8">
              Click "Fetch from IPNS" to load configuration data, or "Show JSON" to enter manually.
            </p>
          )}

          {loading && (
            <p className="text-muted-foreground text-center py-8">
              Fetching configuration from IPNS...
            </p>
          )}

          {(fetchedConfig || showRawJson) && !showRawJson && (
            <div className="space-y-4">
              {/* Header */}
              <div className="grid grid-cols-1 md:grid-cols-[300px_1fr_120px] gap-3 px-1">
                <Label className="text-sm font-medium text-muted-foreground">Key</Label>
                <Label className="text-sm font-medium text-muted-foreground">Value</Label>
                <Label className="text-sm font-medium text-muted-foreground">Actions</Label>
              </div>

              <div className="space-y-2">
                {fetchedConfig?.map((configField, index) => {


                  let value = configField.value;

                  // Only try to parse if it's actually a string
                  if (typeof configField.value === 'string' &&configField.value.includes('{')) {
                    try {
                      value = JSON.parse(configField.value);

                    } catch (error) {
                      console.log("error", error)
                    }
                  } else {
                    // It's already an object/array/primitive, no need to parse
                    value = JSON.stringify(configField.value);
                  }

                  return (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-[320px_1fr_120px] gap-3 items-center px-1">
                      <Input
                        value={configField.key}
                        onChange={(e) => {
                          const newKey = e.target.value;

                          if (newKey !== configField.key && newKey.trim()) {


                            onUpdateKey?.(configField.key, newKey);
                          }
                        }}
                        className="font-mono text-sm truncate"
                        placeholder="Key name"
                      />
                      <Input
                        value={String(value)}
                        onChange={(e) => {
                          const value = e.target.value;

                          try {
                            const parsedValue = JSON.parse(value);



                            onUpdateValue?.(configField.key, parsedValue);
                          } catch (error) {
                            onUpdateValue?.(configField.key, value);
                          }
                        }}
                        className="font-mono text-sm truncate"


                        placeholder="Value"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRemoveKey(environmentName, configField.key)}
                        className="w-full"
                      >
                        Remove
                      </Button>
                    </div>
                  )
                })}
              </div>

              <Separator />

              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-3">
                <Label className="text-sm font-medium mb-3 block">Add New Key-Value Pair</Label>
                <div className="grid grid-cols-1 md:grid-cols-[300px_1fr_120px] gap-3 items-center">
                  <Input
                    placeholder="Enter key name"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Input
                    placeholder="Enter value"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={handleAddKey}
                    disabled={!newKey.trim() || !newValue.trim()}
                    className="w-full"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}

          {showRawJson && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Raw JSON</Label>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveRawJson}
                    size="sm"
                    variant="outline"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  {rawJsonValue.trim() && (
                    <Button
                      onClick={handleUploadAndPublish}
                      disabled={uploading || !isQuickNodeConfigured(configEnvs.quickNodeApiKey as string)}
                      size="sm"
                      title={!isQuickNodeConfigured(configEnvs.quickNodeApiKey as string) ? 'Add quickNodeApiKey to _env section in config or create .env file with VITE_QUICKNODE_API_KEY' : 'Upload to IPFS and publish via IPNS'}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? 'Publishing...' : (isQuickNodeConfigured(configEnvs.quickNodeApiKey as string) ? 'Upload & Publish' : 'Configure QuickNode')}
                    </Button>
                  )}
                </div>
              </div>
              <Textarea
                value={rawJsonValue}
                onChange={(e) => setRawJsonValue(e.target.value)}
                className="font-mono text-sm min-h-[400px] resize-y"
                placeholder={fetchedConfig ? "Edit JSON configuration here..." : "Paste or create JSON configuration here..."}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}