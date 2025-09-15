import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Upload, Clipboard, FileText } from 'lucide-react';
import { validateConfigStructure } from '@/services/ipnsFetcher';
import type {  ConfigStructureWithEnv } from '@/services/ipnsUpdater';

interface ConfigUploadProps {
  onConfigLoaded: (config: ConfigStructureWithEnv) => void;
}

export function ConfigUpload({ onConfigLoaded }: ConfigUploadProps) {
  const [rawJsonInput, setRawJsonInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Validate and set configuration structure
  const validateAndSetConfig = (parsed: unknown) => {
    const validation = validateConfigStructure(parsed);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    onConfigLoaded(parsed as ConfigStructureWithEnv);
    setRawJsonInput('');
    setError(null);
  };

  // Handle JSON file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      validateAndSetConfig(parsed);
    } catch (err) {
      setError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Handle raw JSON paste
  const handleRawJsonSubmit = () => {
    if (!rawJsonInput.trim()) {
      setError('Please enter JSON configuration');
      return;
    }

    try {
      const parsed = JSON.parse(rawJsonInput);
      validateAndSetConfig(parsed);
    } catch (err) {
      setError(`Failed to parse JSON: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Load Configuration Structure
        </CardTitle>
        <CardDescription>
          Upload a JSON file or paste your environment configuration structure
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload JSON File
            </Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <Input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Select a JSON file with your environment configuration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>

          {/* Raw JSON Paste Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clipboard className="h-4 w-4" />
              Paste Raw JSON
            </Label>
            <Textarea
              placeholder="Paste your JSON configuration here..."
              value={rawJsonInput}
              onChange={(e) => setRawJsonInput(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
            <Button 
              onClick={handleRawJsonSubmit}
              disabled={!rawJsonInput.trim()}
              className="w-full"
            >
              <Clipboard className="h-4 w-4 mr-2" />
              Load from JSON
            </Button>
          </div>
          
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
                  Expected structure:
                  <pre className="mt-2 text-xs bg-muted p-2 rounded">
    {`{
      "_env": {
        "pinataJWT": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      },
      "development": {
        "ipnsPublicKey": "k51qzi5uqu5dg7f...",
        "ipnsPrivateKey": "CAASqAkwggSk..." (optional)
      },
      "production": {
        "ipnsPublicKey": "k51qzi5uqu5dk61...",
        "ipnsPrivateKey": "CAASqAkwggSk..." (optional)
      }
    }`}
              </pre>
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
