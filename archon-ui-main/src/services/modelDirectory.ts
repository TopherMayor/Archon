export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  type: 'chat' | 'embedding';
  isFree: boolean;
  contextLength?: number;
  description: string;
  pricing?: {
    input?: number;  // per 1M tokens
    output?: number; // per 1M tokens
  };
  recommended?: boolean;
}

// Chat Models
export const CHAT_MODELS: ModelInfo[] = [
  // OpenAI
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    type: 'chat',
    isFree: false,
    contextLength: 128000,
    description: 'Fast, cost-effective model with strong reasoning',
    pricing: { input: 0.15, output: 0.6 },
    recommended: true
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    type: 'chat',
    isFree: false,
    contextLength: 128000,
    description: 'Latest GPT-4 with multimodal capabilities',
    pricing: { input: 5, output: 15 }
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    type: 'chat',
    isFree: false,
    contextLength: 16384,
    description: 'Fast and affordable model for basic tasks',
    pricing: { input: 0.5, output: 1.5 }
  },

  // OpenRouter - Free Options
  {
    id: 'microsoft/wizardlm-2-8x22b',
    name: 'WizardLM-2 8x22B (Free)',
    provider: 'openrouter',
    type: 'chat',
    isFree: true,
    contextLength: 65536,
    description: 'High-quality free model with excellent reasoning',
    recommended: true
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    name: 'Llama 3.1 8B (Free)',
    provider: 'openrouter',
    type: 'chat',
    isFree: true,
    contextLength: 131072,
    description: 'Meta\'s latest Llama model, free tier available',
    recommended: true
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'Mistral 7B (Free)',
    provider: 'openrouter',
    type: 'chat',
    isFree: true,
    contextLength: 32768,
    description: 'Efficient French AI model, good for code and reasoning'
  },
  {
    id: 'google/gemma-7b-it:free',
    name: 'Gemma 7B (Free)',
    provider: 'openrouter',
    type: 'chat',
    isFree: true,
    contextLength: 8192,
    description: 'Google\'s open model family'
  },

  // OpenRouter - Premium
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    type: 'chat',
    isFree: false,
    contextLength: 200000,
    description: 'Anthropic\'s most capable model with excellent code understanding',
    pricing: { input: 3, output: 15 },
    recommended: true
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (via OpenRouter)',
    provider: 'openrouter',
    type: 'chat',
    isFree: false,
    contextLength: 128000,
    description: 'OpenAI model via OpenRouter with unified billing',
    pricing: { input: 0.15, output: 0.6 }
  },

  // Google
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    type: 'chat',
    isFree: false,
    contextLength: 1000000,
    description: 'Fast model with huge context window',
    pricing: { input: 0.075, output: 0.3 },
    recommended: true
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    type: 'chat',
    isFree: false,
    contextLength: 2000000,
    description: 'Google\'s most capable model with massive context',
    pricing: { input: 1.25, output: 5 }
  },

  // Qwen
  {
    id: 'qwen2.5-72b-instruct',
    name: 'Qwen2.5 72B Instruct',
    provider: 'qwen',
    type: 'chat',
    isFree: false,
    contextLength: 131072,
    description: 'Large multilingual model with strong reasoning',
    recommended: true
  },
  {
    id: 'qwen2.5-coder-32b-instruct',
    name: 'Qwen2.5 Coder 32B',
    provider: 'qwen',
    type: 'chat',
    isFree: false,
    contextLength: 131072,
    description: 'Specialized coding model with excellent performance'
  },

  // Ollama (Local - Free)
  {
    id: 'llama3.1:8b',
    name: 'Llama 3.1 8B (Local)',
    provider: 'ollama',
    type: 'chat',
    isFree: true,
    contextLength: 131072,
    description: 'Run locally on your hardware - completely free',
    recommended: true
  },
  {
    id: 'mistral:7b',
    name: 'Mistral 7B (Local)',
    provider: 'ollama',
    type: 'chat',
    isFree: true,
    contextLength: 32768,
    description: 'Efficient model for local deployment'
  },
  {
    id: 'codellama:13b',
    name: 'Code Llama 13B (Local)',
    provider: 'ollama',
    type: 'chat',
    isFree: true,
    contextLength: 16384,
    description: 'Specialized for code generation and understanding'
  }
];

// Embedding Models
export const EMBEDDING_MODELS: ModelInfo[] = [
  // OpenAI
  {
    id: 'text-embedding-3-small',
    name: 'Text Embedding 3 Small',
    provider: 'openai',
    type: 'embedding',
    isFree: false,
    description: 'High-quality embeddings with good performance/cost ratio',
    pricing: { input: 0.02 },
    recommended: true
  },
  {
    id: 'text-embedding-3-large',
    name: 'Text Embedding 3 Large',
    provider: 'openai',
    type: 'embedding',
    isFree: false,
    description: 'Highest quality OpenAI embeddings',
    pricing: { input: 0.13 }
  },
  {
    id: 'text-embedding-ada-002',
    name: 'Text Embedding Ada 002',
    provider: 'openai',
    type: 'embedding',
    isFree: false,
    description: 'Previous generation, still reliable',
    pricing: { input: 0.1 }
  },

  // OpenRouter - Free and Paid
  {
    id: 'sentence-transformers/all-mpnet-base-v2',
    name: 'All-MiniLM-L6-v2 (Free)',
    provider: 'openrouter',
    type: 'embedding',
    isFree: true,
    description: 'Free sentence transformer model with good quality',
    recommended: true
  },
  {
    id: 'thenlper/gte-large',
    name: 'GTE Large (Free)',
    provider: 'openrouter',
    type: 'embedding',
    isFree: true,
    description: 'High-quality free embedding model'
  },
  {
    id: 'openai/text-embedding-3-small',
    name: 'OpenAI Embedding 3 Small (via OpenRouter)',
    provider: 'openrouter',
    type: 'embedding',
    isFree: false,
    description: 'OpenAI embeddings via OpenRouter',
    pricing: { input: 0.02 }
  },

  // Google
  {
    id: 'text-embedding-004',
    name: 'Text Embedding 004',
    provider: 'google',
    type: 'embedding',
    isFree: false,
    description: 'Google\'s latest embedding model with strong performance',
    pricing: { input: 0.025 },
    recommended: true
  },
  {
    id: 'textembedding-gecko@003',
    name: 'Text Embedding Gecko 003',
    provider: 'google',
    type: 'embedding',
    isFree: false,
    description: 'Previous generation Google embeddings',
    pricing: { input: 0.025 }
  },

  // Qwen
  {
    id: 'text-embedding-v1',
    name: 'Qwen Text Embedding v1',
    provider: 'qwen',
    type: 'embedding',
    isFree: false,
    description: 'Qwen\'s multilingual embedding model',
    recommended: true
  },

  // Ollama (Local - Free)
  {
    id: 'nomic-embed-text',
    name: 'Nomic Embed Text (Local)',
    provider: 'ollama',
    type: 'embedding',
    isFree: true,
    description: 'High-quality local embeddings - completely free',
    recommended: true
  },
  {
    id: 'mxbai-embed-large',
    name: 'MxBai Embed Large (Local)',
    provider: 'ollama',
    type: 'embedding',
    isFree: true,
    description: 'Large embedding model for local deployment'
  },
  {
    id: 'all-minilm',
    name: 'All-MiniLM (Local)',
    provider: 'ollama',
    type: 'embedding',
    isFree: true,
    description: 'Lightweight embedding model for local use'
  }
];

export class ModelDirectory {
  static getChatModels(provider?: string): ModelInfo[] {
    const models = provider 
      ? CHAT_MODELS.filter(m => m.provider === provider)
      : CHAT_MODELS;
    
    // Sort by: recommended first, then free models, then by name
    return models.sort((a, b) => {
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  static getEmbeddingModels(provider?: string): ModelInfo[] {
    const models = provider 
      ? EMBEDDING_MODELS.filter(m => m.provider === provider)
      : EMBEDDING_MODELS;
    
    // Sort by: recommended first, then free models, then by name
    return models.sort((a, b) => {
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  static searchModels(query: string, type: 'chat' | 'embedding', provider?: string): ModelInfo[] {
    const models = type === 'chat' 
      ? this.getChatModels(provider) 
      : this.getEmbeddingModels(provider);
    
    if (!query.trim()) return models;
    
    const searchTerm = query.toLowerCase();
    return models.filter(model => 
      model.name.toLowerCase().includes(searchTerm) ||
      model.id.toLowerCase().includes(searchTerm) ||
      model.description.toLowerCase().includes(searchTerm)
    );
  }

  static getModelById(modelId: string, type: 'chat' | 'embedding'): ModelInfo | undefined {
    const models = type === 'chat' ? CHAT_MODELS : EMBEDDING_MODELS;
    return models.find(m => m.id === modelId);
  }

  static getFreeModels(type: 'chat' | 'embedding'): ModelInfo[] {
    const models = type === 'chat' ? CHAT_MODELS : EMBEDDING_MODELS;
    return models.filter(m => m.isFree);
  }

  static getRecommendedModels(type: 'chat' | 'embedding'): ModelInfo[] {
    const models = type === 'chat' ? CHAT_MODELS : EMBEDDING_MODELS;
    return models.filter(m => m.recommended);
  }
}