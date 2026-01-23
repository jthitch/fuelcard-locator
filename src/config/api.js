// LocationIQ API Configuration
// API key is loaded from environment variables
// Create a .env file in the root directory with: VITE_LOCATIONIQ_API_KEY=your_key_here
export const LOCATIONIQ_API_KEY = import.meta.env.VITE_LOCATIONIQ_API_KEY || ''

// Debug: Log if API key is loaded (remove in production)
if (import.meta.env.DEV) {
  const envValue = import.meta.env.VITE_LOCATIONIQ_API_KEY
  console.log('LocationIQ API Key check:', {
    hasEnvValue: !!envValue,
    envValueLength: envValue?.length || 0,
    finalKeyLength: LOCATIONIQ_API_KEY?.length || 0,
    allEnvKeys: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
  })
}

// LocationIQ API endpoints
export const LOCATIONIQ_BASE_URL = 'https://us1.locationiq.com/v1'
export const LOCATIONIQ_EU_URL = 'https://eu1.locationiq.com/v1'

// Use EU endpoint if you're in Europe for better performance
export const LOCATIONIQ_URL = LOCATIONIQ_BASE_URL
