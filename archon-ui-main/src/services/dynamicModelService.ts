import { credentialsService } from './credentialsService';

export interface DynamicModelInfo {
  id: string;
  name: string;
  provider: string;
  type: 'chat' | 'embedding';
  isFree: boolean;
  contextLength?: number;
  description: string;
  pricing?: {
    input?: number;
    output?: number;
  };
  recommended?: boolean;
  isAvailable: boolean;
  lastUpdated: number;
}

class DynamicModelService {
  private cache: Map<string, any> = new Map();

  async getOpenAIModels(type: 'chat' | 'embedding'): Promise<DynamicModelInfo[]> {
    try {
      const credential = await credentialsService.getCredential('OPENAI_API_KEY');
      const apiKey = credential.value;
      
      if (!apiKey) {
        return this.getFallbackModels('openai', type);
      }

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const models: DynamicModelInfo[] = [];
      const now = Date.now();

      for (const model of data.data) {
        const isChatModel = model.id.includes('gpt') || model.id.includes('turbo');
        const isEmbeddingModel = model.id.includes('embedding');

        if ((type === 'chat' && isChatModel) || (type === 'embedding' && isEmbeddingModel)) {
          models.push({
            id: model.id,
            name: this.formatOpenAIName(model.id),
            provider: 'openai',
            type,
            isFree: false,
            description: this.getOpenAIDescription(model.id),
            pricing: this.getOpenAIPricing(model.id),
            recommended: this.isOpenAIRecommended(model.id),
            isAvailable: true,
            lastUpdated: now
          });
        }
      }

      return models;
    } catch (error) {
      console.error('Failed to fetch OpenAI models:', error);
      return this.getFallbackModels('openai', type);
    }
  }

  async getOpenRouterModels(type: 'chat' | 'embedding'): Promise<DynamicModelInfo[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      
      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const models: DynamicModelInfo[] = [];
      const now = Date.now();

      for (const model of data.data) {
        const isEmbeddingModel = model.id.includes('embedding') || model.id.includes('embed');
        const isChatModel = !isEmbeddingModel;

        if ((type === 'chat' && isChatModel) || (type === 'embedding' && isEmbeddingModel)) {
          const pricing = model.pricing ? {
            input: parseFloat(model.pricing.prompt || '0') * 1000000,
            output: parseFloat(model.pricing.completion || '0') * 1000000
          } : undefined;

          const isFree = pricing ? (pricing.input === 0 && pricing.output === 0) : false;

          models.push({
            id: model.id,
            name: model.name || model.id,
            provider: 'openrouter',
            type,
            isFree,
            contextLength: model.context_length,
            description: this.getShortDescription(model),
            pricing,
            recommended: this.isOpenRouterRecommended(model.id),
            isAvailable: true,
            lastUpdated: now
          });
        }
      }

      return models;
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error);
      return this.getFallbackModels('openrouter', type);
    }
  }

  async getModels(provider: string, type: 'chat' | 'embedding'): Promise<DynamicModelInfo[]> {
    switch (provider) {
      case 'openai':
        return this.getOpenAIModels(type);
      case 'openrouter':
        return this.getOpenRouterModels(type);
      default:
        return this.getFallbackModels(provider, type);
    }
  }

  async searchModels(query: string, type: 'chat' | 'embedding', provider?: string): Promise<DynamicModelInfo[]> {
    let models: DynamicModelInfo[] = [];

    if (provider) {
      models = await this.getModels(provider, type);
    } else {
      const providers = ['openai', 'openrouter'];
      const allResults = await Promise.allSettled(
        providers.map(p => this.getModels(p, type))
      );

      models = allResults
        .filter((result): result is PromiseFulfilledResult<DynamicModelInfo[]> => 
          result.status === 'fulfilled')
        .flatMap(result => result.value);
    }

    if (!query.trim()) return models;

    const searchTerm = query.toLowerCase();
    return models.filter(model => 
      model.name.toLowerCase().includes(searchTerm) ||
      model.id.toLowerCase().includes(searchTerm) ||
      model.description.toLowerCase().includes(searchTerm)
    );
  }

  private formatOpenAIName(id: string): string {
    const nameMap: Record<string, string> = {
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'text-embedding-3-small': 'Text Embedding 3 Small',
      'text-embedding-3-large': 'Text Embedding 3 Large'
    };
    return nameMap[id] || id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private getOpenAIDescription(id: string): string {
    const descriptions: Record<string, string> = {
      'gpt-4o': 'Latest GPT-4 model',
      'gpt-4o-mini': 'Fast, cost-effective model',
      'text-embedding-3-small': 'High-quality embeddings'
    };
    return descriptions[id] || 'OpenAI model';
  }

  private getOpenAIPricing(id: string): { input?: number; output?: number } | undefined {
    const pricing: Record<string, { input?: number; output?: number }> = {
      'gpt-4o': { input: 5, output: 15 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'text-embedding-3-small': { input: 0.02 }
    };
    return pricing[id];
  }

  private isOpenAIRecommended(id: string): boolean {
    return ['gpt-4o-mini', 'text-embedding-3-small'].includes(id);
  }

  private isOpenRouterRecommended(id: string): boolean {
    const recommended = [
      'meta-llama/llama-3.1-8b-instruct:free',
      'microsoft/wizardlm-2-8x22b',
      'anthropic/claude-3.5-sonnet'
    ];
    return recommended.includes(id);
  }

  private getShortDescription(model: any): string {
    // Generate concise descriptions based on model ID and characteristics
    if (model.id.includes('free')) return 'Free model';
    if (model.id.includes('llama')) return 'Meta Llama model';
    if (model.id.includes('claude')) return 'Anthropic Claude model';
    if (model.id.includes('gpt')) return 'OpenAI GPT model';
    if (model.id.includes('gemini')) return 'Google Gemini model';
    if (model.id.includes('mistral')) return 'Mistral AI model';
    if (model.id.includes('deepseek')) return 'DeepSeek model';
    if (model.id.includes('qwen')) return 'Alibaba Qwen model';
    if (model.id.includes('embed')) return 'Embedding model';
    
    // Extract key info from longer descriptions
    if (model.description) {
      const desc = model.description;
      if (desc.includes('reasoning')) return 'Reasoning model';
      if (desc.includes('code')) return 'Code generation model';
      if (desc.includes('vision')) return 'Vision-language model';
      if (desc.includes('large')) return 'Large language model';
    }
    
    return 'AI model';
  }

  private getFallbackModels(provider: string, type: 'chat' | 'embedding'): DynamicModelInfo[] {
    const fallbacks: Record<string, Record<string, DynamicModelInfo[]>> = {
      openai: {
        chat: [{
          id: 'gpt-4o-mini',
          name: 'GPT-4o Mini',
          provider: 'openai',
          type: 'chat',
          isFree: false,
          description: 'Fast, cost-effective model (fallback)',
          isAvailable: false,
          lastUpdated: Date.now()
        }],
        embedding: [{
          id: 'text-embedding-3-small',
          name: 'Text Embedding 3 Small',
          provider: 'openai',
          type: 'embedding',
          isFree: false,
          description: 'High-quality embeddings (fallback)',
          isAvailable: false,
          lastUpdated: Date.now()
        }]
      }
    };

    return fallbacks[provider]?.[type] || [];
  }
}

export const dynamicModelService = new DynamicModelService();