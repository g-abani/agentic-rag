import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

/**
 * Robust Configuration Management
 * 
 * Features:
 * - Environment validation with helpful error messages
 * - Default values for development
 * - Configuration caching and validation
 * - Automatic .env creation from template
 */

class ConfigManager {
  constructor() {
    this._config = null;
    this._validated = false;
    this._initializeConfig();
  }

  _initializeConfig() {
    // Check if .env exists, create from template if not
    this._ensureEnvFile();
    
    // Build configuration object
    this._config = {
      server: {
        port: parseInt(process.env.PORT) || 3000,
        environment: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',
        corsOrigin: process.env.CORS_ORIGIN || '*'
      },
      azure: {
        openai: {
          endpoint: process.env.AZURE_OPENAI_ENDPOINT,
          apiKey: process.env.AZURE_OPENAI_API_KEY,
          apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-06-01',
          deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4-1106-preview'
        },
        search: {
          endpoint: process.env.AZURE_SEARCH_ENDPOINT,
          apiKey: process.env.AZURE_SEARCH_API_KEY,
          indexName: process.env.AZURE_SEARCH_INDEX_NAME || 'knowledge-base'
        }
      },
      features: {
        enableCache: process.env.ENABLE_CACHE === 'true',
        enableMetrics: process.env.ENABLE_METRICS === 'true',
        maxRetries: parseInt(process.env.MAX_RETRIES) || 3
      }
    };

    this._validateConfig();
  }

  _ensureEnvFile() {
    const envPath = '.env';
    const envExamplePath = 'env.example';
    
    if (!fs.existsSync(envPath)) {
      console.log('📝 .env file not found, creating from template...');
      
      if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('✅ Created .env file from template');
      } else {
        this._createMinimalEnvFile(envPath);
        console.log('✅ Created minimal .env file');
      }
      
      console.log('⚠️  Please edit .env with your Azure credentials before starting');
    }
  }

  _createMinimalEnvFile(envPath) {
    const minimalEnv = `# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Azure OpenAI Configuration (REQUIRED)
AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-openai-api-key
AZURE_OPENAI_API_VERSION=2024-06-01
AZURE_OPENAI_DEPLOYMENT=gpt-4-1106-preview

# Azure AI Search Configuration (REQUIRED)
AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
AZURE_SEARCH_API_KEY=your-search-api-key
AZURE_SEARCH_INDEX_NAME=knowledge-base

# Optional Features
ENABLE_CACHE=false
ENABLE_METRICS=true
MAX_RETRIES=3
`;
    fs.writeFileSync(envPath, minimalEnv);
  }

  _validateConfig() {
    const requiredFields = [
      { key: 'AZURE_OPENAI_ENDPOINT', value: this._config.azure.openai.endpoint },
      { key: 'AZURE_OPENAI_API_KEY', value: this._config.azure.openai.apiKey },
      { key: 'AZURE_SEARCH_ENDPOINT', value: this._config.azure.search.endpoint },
      { key: 'AZURE_SEARCH_API_KEY', value: this._config.azure.search.apiKey },
      { key: 'AZURE_SEARCH_INDEX_NAME', value: this._config.azure.search.indexName }
    ];

    const missingFields = requiredFields.filter(field => {
      return !field.value || 
             field.value.includes('your-') || 
             field.value.includes('placeholder') ||
             field.value === '';
    });

    if (missingFields.length > 0) {
      const missingNames = missingFields.map(f => f.key);
      throw new Error(`Configuration validation failed. Missing or invalid environment variables: ${missingNames.join(', ')}\n\nPlease edit your .env file with valid Azure credentials.`);
    }

    // Validate endpoint URLs
    if (!this._config.azure.openai.endpoint.startsWith('https://')) {
      throw new Error('AZURE_OPENAI_ENDPOINT must be a valid HTTPS URL');
    }

    if (!this._config.azure.search.endpoint.startsWith('https://')) {
      throw new Error('AZURE_SEARCH_ENDPOINT must be a valid HTTPS URL');
    }

    this._validated = true;
    console.log('✅ Configuration validated successfully');
  }

  get config() {
    if (!this._validated) {
      throw new Error('Configuration not validated');
    }
    return this._config;
  }

  isProduction() {
    return this._config.server.environment === 'production';
  }

  isDevelopment() {
    return this._config.server.environment === 'development';
  }
}

// Export singleton instance and legacy exports for compatibility
const configManager = new ConfigManager();
export default configManager.config;
export const config = configManager.config;
export const validateConfig = () => configManager._validated;