import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings } from 'lucide-react';
import { EnvironmentTab } from './EnvironmentTab';
import type { FetchedConfig } from '@/services/ipnsFetcher';
import type { EnvironmentConfig, ConfigStructure, ConfigStructureEnv } from '@/services/ipnsUpdater';

interface ConfigTabsProps {
  configEnvs: ConfigStructureEnv["__env"];
  configStructure: ConfigStructure;
  fetchedConfigs: Record<string, FetchedConfig[]>;
  currentIPFSHashes: Record<string, string>;
  loading: Record<string, boolean>;
  activeTab: string;
  error: string | null;
  onTabChange: (tab: string) => void;
  onFetch: (environmentName: string, ipnsKey: string) => void;
  onUpdateValue: (environmentName: string, key: string, value: string) => void;
  onUpdateKey: (environmentName: string, oldKey: string, newKey: string) => void;
  onAddKey: (environmentName: string, key: string, value: string) => void;
  onRemoveKey: (environmentName: string, key: string) => void;
  onReset: () => void;
  onUpdateEntireConfig: (environmentName: string, config: FetchedConfig[]) => void;
}

export function ConfigTabs({
  configStructure,
  configEnvs,
  fetchedConfigs,
  currentIPFSHashes,
  loading,
  activeTab,
  error,
  onTabChange,
  onFetch,
  onUpdateValue,
  onUpdateKey,
  onAddKey,
  onRemoveKey,
  onReset,
  onUpdateEntireConfig
}: ConfigTabsProps) {
  return (
    <div className="w-full space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration Manager
          </CardTitle>
          <CardDescription>
            Manage your IPFS/IPNS configuration across environments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            onClick={onReset}
            className="mb-4"
          >
            Load Different Configuration
          </Button>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <div className="overflow-x-auto">
          <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground min-w-full">
            {Object.keys(configStructure).filter(name => name !== '_env').map((envName) => (
              <TabsTrigger 
                key={envName} 
                value={envName} 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm min-w-fit gap-2"
              >
                <span className="truncate max-w-[120px]">{envName}</span>
                {fetchedConfigs[envName] && (
                  <Badge variant="secondary" className="text-xs">
                    {Object.keys(fetchedConfigs[envName]).length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {Object.entries(configStructure).map(([envName, envConfig]) => (
          <TabsContent key={envName} value={envName}>
                <EnvironmentTab
                  configEnvs={configEnvs}
                  environmentName={envName}
                  ipnsPublicKey={(envConfig as EnvironmentConfig).ipnsPublicKey}
                  environmentConfig={envConfig as EnvironmentConfig}
                  configStructure={configStructure}
                  fetchedConfig={fetchedConfigs[envName]}
                  currentIPFSHash={currentIPFSHashes[envName]}
                  loading={loading[envName] || false}
                  onFetch={() => onFetch(envName, (envConfig as EnvironmentConfig).ipnsPublicKey)}
                  onUpdateValue={(key, value) => onUpdateValue(envName, key, value)}
                  onUpdateKey={(oldKey, newKey) => onUpdateKey(envName, oldKey, newKey)}
                  onAddKey={onAddKey}
                  onRemoveKey={onRemoveKey}
                  onUpdateEntireConfig={(config) => onUpdateEntireConfig(envName, config)}
                />
          </TabsContent>
        ))}
      </Tabs>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
