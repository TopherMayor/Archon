// Simple test to demonstrate dynamic model fetching
// Run with: node test-dynamic-models.js

console.log('🧪 Testing Dynamic Model Service');
console.log('================================');

// Simulate the dynamic model service functionality
async function testDynamicModels() {
  console.log('\n📡 Testing OpenRouter API (no auth required)...');
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Successfully fetched ${data.data.length} models from OpenRouter`);
    
    // Count free models
    const freeModels = data.data.filter(model => {
      const pricing = model.pricing;
      if (!pricing) return false;
      const inputCost = parseFloat(pricing.prompt || '0');
      const outputCost = parseFloat(pricing.completion || '0');
      return inputCost === 0 && outputCost === 0;
    });
    
    console.log(`🎁 Found ${freeModels.length} free models`);
    
    // Show some free models
    console.log('\n🆓 Sample free models:');
    freeModels.slice(0, 5).forEach(model => {
      console.log(`   • ${model.name} (${model.id})`);
    });
    
    // Count embedding models
    const embeddingModels = data.data.filter(model => 
      model.id.includes('embedding') || model.id.includes('embed')
    );
    
    console.log(`\n🔍 Found ${embeddingModels.length} embedding models`);
    
    // Test search functionality
    console.log('\n🔎 Testing search for "llama" models...');
    const llamaModels = data.data.filter(model => 
      model.name.toLowerCase().includes('llama') || 
      model.id.toLowerCase().includes('llama')
    );
    
    console.log(`   Found ${llamaModels.length} Llama models`);
    llamaModels.slice(0, 3).forEach(model => {
      const isFree = model.pricing && 
        parseFloat(model.pricing.prompt || '0') === 0 && 
        parseFloat(model.pricing.completion || '0') === 0;
      console.log(`   • ${model.name} ${isFree ? '(FREE)' : '(PAID)'}`);
    });
    
  } catch (error) {
    console.error('❌ OpenRouter test failed:', error.message);
  }
  
  console.log('\n🧪 Testing Ollama local connection...');
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Successfully connected to local Ollama`);
    console.log(`📦 Found ${data.models.length} locally installed models`);
    
    if (data.models.length > 0) {
      console.log('\n💻 Local models:');
      data.models.forEach(model => {
        console.log(`   • ${model.name} (size: ${model.size})`);
      });
    }
    
  } catch (error) {
    console.log('⚠️  Ollama not available (this is normal if not installed)');
    console.log('   Install Ollama from https://ollama.ai to use local models');
  }
}

// Test OpenAI API availability (requires API key)
async function testOpenAI() {
  console.log('\n🧪 Testing OpenAI API availability...');
  
  // This would require an API key from the credentials service
  console.log('⚠️  OpenAI API test requires OPENAI_API_KEY credential');
  console.log('   Configure your OpenAI API key in settings to enable');
}

// Run tests
async function runTests() {
  await testDynamicModels();
  await testOpenAI();
  
  console.log('\n🎉 Dynamic Model Service Test Complete!');
  console.log('\nKey Benefits:');
  console.log('• ✅ Real-time model availability');
  console.log('• 🎁 Automatic free model detection');
  console.log('• 🔍 Live search and filtering');
  console.log('• 💰 Current pricing information');
  console.log('• 🚀 No manual maintenance required');
}

runTests().catch(console.error);