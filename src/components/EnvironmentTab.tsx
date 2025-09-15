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
import { uploadConfigToIPFS, isPinataConfigured } from '@/services/ipfsUploader';
import { uploadAndUpdateIPNS, type EnvironmentConfig, type ConfigStructure } from '@/services/ipnsUpdater';

interface EnvironmentTabProps {
  environmentName: string;
  ipnsPublicKey: string;
  environmentConfig: EnvironmentConfig;
  configStructure: ConfigStructure;
  fetchedConfig?: FetchedConfig;
  currentIPFSHash?: string;
  loading: boolean;
  onFetch: () => void;
  onUpdateValue?: (key: string, value: string) => void;
  onUpdateKey?: (oldKey: string, newKey: string) => void;
  onAddKey: (environmentName: string, key: string, value: string) => void;
  onRemoveKey: (environmentName: string, key: string) => void;
}

export function EnvironmentTab({ 
  environmentName, 
  ipnsPublicKey, 
  environmentConfig,
  configStructure,
  fetchedConfig, 
  currentIPFSHash,
  loading, 
  onFetch,
  onAddKey,
  onRemoveKey
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
      setRawJsonValue(JSON.stringify(fetchedConfig, null, 2));
    } else if (!rawJsonValue) {
      // Initialize with empty object if no config and no existing value
      setRawJsonValue('{\n  \n}');
    }
  }, [fetchedConfig]);

  // Auto-parse JSON and update inputs when rawJsonValue changes (if it's valid JSON)
  React.useEffect(() => {
    if (!showRawJson) return; // Only auto-parse when JSON view is visible
    
    try {
      const parsed = JSON.parse(rawJsonValue);
      
      // Only auto-update if it's different from current fetchedConfig
      const currentJson = fetchedConfig ? JSON.stringify(fetchedConfig) : '{}';
      const newJson = JSON.stringify(parsed);
      
      if (currentJson !== newJson) {
        // Clear existing config
        if (fetchedConfig) {
          Object.keys(fetchedConfig).forEach(k => onRemoveKey(environmentName, k));
        }
        
        // Add new config
        Object.entries(parsed).forEach(([k, v]) => {
          onAddKey(environmentName, k, String(v));
        });
      }
    } catch (error) {
      // Ignore JSON parse errors during typing - only show error on manual save
    }
  }, [rawJsonValue, showRawJson, fetchedConfig, environmentName, onAddKey, onRemoveKey]);

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
      configToUpload = fetchedConfig;
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
            configStructure,
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
                onClick={() => setShowRawJson(!showRawJson)}
                className="w-full sm:w-auto"
              >
                <FileText className="h-4 w-4 mr-2" />
                {showRawJson ? 'Hide' : 'Show'} JSON
              </Button>
              <Button 
                onClick={handleUploadAndPublish}
                disabled={uploading || !isPinataConfigured(configStructure._env?.pinataJWT as string) || (showRawJson && !rawJsonValue.trim())}
                size="sm"
                className="w-full sm:w-auto"
                title={!isPinataConfigured(configStructure._env?.pinataJWT as string) ? 'Add pinataJWT to _env section in config or create .env file with VITE_PINATA_JWT' : 'Upload to IPFS and publish via IPNS'}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Publishing...' : (isPinataConfigured(configStructure._env?.pinataJWT as string) ? 'Upload & Publish' : 'Configure Pinata')}
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
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_120px] gap-3 px-1">
                <Label className="text-sm font-medium text-muted-foreground">Key</Label>
                <Label className="text-sm font-medium text-muted-foreground">Value</Label>
                <Label className="text-sm font-medium text-muted-foreground">Actions</Label>
              </div>
              
              <div className="space-y-2">
                {Object.entries(fetchedConfig || {}).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-1 md:grid-cols-[200px_1fr_120px] gap-3 items-center px-1">
                    <Input
                      value={key}
                      onChange={(e) => {
                        const newKey = e.target.value;
                        if (newKey !== key && newKey.trim()) {
                          // Remove old key and add new one with same value
                          const value = fetchedConfig?.[key];
                          onRemoveKey(environmentName, key);
                          onAddKey(environmentName, newKey, String(value));
                        }
                      }}
                      className="font-mono text-sm"
                      placeholder="Key name"
                    />
                    <Input
                      value={String(value)}
                      onChange={(e) => {
                        // Remove old key and add new one with updated value
                        onRemoveKey(environmentName, key);
                        onAddKey(environmentName, key, e.target.value);
                      }}
                      className="font-mono text-sm"
                      style={{
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden'
                      }}
                      onFocus={(e) => {
                        e.target.style.textOverflow = 'clip';
                        e.target.style.whiteSpace = 'normal';
                        e.target.style.overflow = 'visible';
                      }}
                      onBlur={(e) => {
                        e.target.style.textOverflow = 'ellipsis';
                        e.target.style.whiteSpace = 'nowrap';
                        e.target.style.overflow = 'hidden';
                      }}
                      placeholder="Value"
                      title={String(value)} // Show full value on hover
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRemoveKey(environmentName, key)}
                      className="w-full"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-3">
                <Label className="text-sm font-medium mb-3 block">Add New Key-Value Pair</Label>
                <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_80px] gap-3 items-center">
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
                      disabled={uploading || !isPinataConfigured(configStructure._env?.pinataJWT as string)}
                      size="sm"
                      title={!isPinataConfigured(configStructure._env?.pinataJWT as string) ? 'Add pinataJWT to _env section in config or create .env file with VITE_PINATA_JWT' : 'Upload to IPFS and publish via IPNS'}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? 'Publishing...' : (isPinataConfigured(configStructure._env?.pinataJWT as string) ? 'Upload & Publish' : 'Configure Pinata')}
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