
import { ConfigManager } from './components/ConfigManager';

function App() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 px-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">
          🚀 IPFS Configuration Manager
        </h1>
        <ConfigManager />
      </div>
    </div>
  );
}

export default App;
