import { DynamicModelInfo, ProviderApiAdapter } from '../dynamicModelService';

interface OpenAIModel {
  id: string;
  object: string;
  owned_by: string;
  created?: number;
}

export class OpenAIAdapter implements ProviderApiAdapter {
  provider = 'openai';

  async fetchChatModels(apiKey?: string, baseUrl = 'https://api.openai.com/v1'): Promise<DynamicModelInfo[]> {
    if (!apiKey) {
      console.warn('No OpenAI API key found, using fallback models');
      return this.getFallbackChatModels();
    }

    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const models = data.data as OpenAIModel[];

      // Filter for chat models and map to our format
      return models
        .filter(model => 
          model.id.includes('gpt-4') || 
          model.id.includes('gpt-3.5') || 
          model.id.includes('gpt-4o')
        )
        .map(model => this.mapToModelInfo(model, 'chat'));
    } catch (error) {
      console.error('Failed to fetch OpenAI chat models:', error);
      return this.getFallbackChatModels();
    }
  }

  async fetchEmbeddingModels(apiKey?: string, baseUrl = 'https://api.openai.com/v1'): Promise<DynamicModelInfo[]> {
    if (!apiKey) {
      console.warn('No OpenAI API key found, using fallback models');
      return this.getFallbackEmbeddingModels();
    }

    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const models = data.data as OpenAIModel[];

      // Filter for embedding models and map to our format
      return models
        .filter(model => 
          model.id.includes('text-embedding') || 
          model.id.includes('ada-002')
        )
        .map(model => this.mapToModelInfo(model, 'embedding'));
    } catch (error) {
      console.error('Failed to fetch OpenAI embedding models:', error);
      return this.getFallbackEmbeddingModels();
    }
  }

  private mapToModelInfo(model: OpenAIModel, type: 'chat' | 'embedding'): DynamicModelInfo {
    const baseInfo = {
      id: model.id,
      name: this.getDisplayName(model.id),
      provider: this.provider,
      type,
      isFree: false,
      description: this.getDescription(model.id),
    };

    if (type === 'chat') {
      return {
        ...baseInfo,
        contextLength: this.getContextLength(model.id),
        pricing: this.getPricing(model.id),
        recommended: this.isRecommended(model.id),
      };
    } else {
      return {
        ...baseInfo,
        pricing: { input: this.getEmbeddingPricing(model.id) },
        recommended: this.isRecommendedEmbedding(model.id),
      };
    }
  }

  private getDisplayName(modelId: string): string {
    const nameMap: { [key: string]: string } = {
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'text-embedding-3-large': 'Text Embedding 3 Large',
      'text-embedding-3-small': 'Text Embedding 3 Small',
      'text-embedding-ada-002': 'Text Embedding Ada 002',
    };
    return nameMap[modelId] || modelId;
  }

  private getDescription(modelId: string): string {
    const descriptions: { [key: string]: string } = {
      'gpt-4o': 'Latest GPT-4 with multimodal capabilities',
      'gpt-4o-mini': 'Fast, cost-effective model with strong reasoning',
      'gpt-4-turbo': 'High-performance GPT-4 model',
      'gpt-4': 'Original GPT-4 model',
      'gpt-3.5-turbo': 'Fast and affordable model for basic tasks',
      'text-embedding-3-large': 'Highest quality OpenAI embeddings',
      'text-embedding-3-small': 'High-quality embeddings with good performance/cost ratio',
      'text-embedding-ada-002': 'Previous generation, still reliable',
    };
    return descriptions[modelId] || 'OpenAI model';
  }

  private getContextLength(modelId: string): number {
    const contextLengths: { [key: string]: number } = {
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 16384,
    };
    return contextLengths[modelId] || 4096;
  }

  private getPricing(modelId: string): { input: number; output: number } {
    const pricing: { [key: string]: { input: number; output: number } } = {
      'gpt-4o': { input: 5, output: 15 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'gpt-4-turbo': { input: 10, output: 30 },
      'gpt-4': { input: 30, output: 60 },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    };
    return pricing[modelId] || { input: 0, output: 0 };
  }

  private getEmbeddingPricing(modelId: string): number {
    const pricing: { [key: string]: number } = {
      'text-embedding-3-large': 0.13,
      'text-embedding-3-small': 0.02,
      'text-embedding-ada-002': 0.1,
    };
    return pricing[modelId] || 0;
  }

  private isRecommended(modelId: string): boolean {
    return ['gpt-4o-mini', 'gpt-4o'].includes(modelId);
  }

  private isRecommendedEmbedding(modelId: string): boolean {
    return ['text-embedding-3-small'].includes(modelId);
  }

  private getFallbackChatModels(): DynamicModelInfo[] {
    return [
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: this.provider,
        type: 'chat',
        isFree: false,
        contextLength: 128000,
        description: 'Fast, cost-effective model with strong reasoning',
        pricing: { input: 0.15, output: 0.6 },
        recommended: true,
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: this.provider,
        type: 'chat',
        isFree: false,
        contextLength: 128000,
        description: 'Latest GPT-4 with multimodal capabilities',
        pricing: { input: 5, output: 15 },
      },
    ];
  }

  private getFallbackEmbeddingModels(): DynamicModelInfo[] {
    return [
      {
        id: 'text-embedding-3-small',
        name: 'Text Embedding 3 Small',
        provider: this.provider,
        type: 'embedding',
        isFree: false,
        description: 'High-quality embeddings with good performance/cost ratio',
        pricing: { input: 0.02 },
        recommended: true,
      },
      {
        id: 'text-embedding-3-large',
        name: 'Text Embedding 3 Large',
        provider: this.provider,
        type: 'embedding',
        isFree: false,
        description: 'Highest quality OpenAI embeddings',
        pricing: { input: 0.13 },
      },
    ];
  }
}