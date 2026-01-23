import { LOCATIONIQ_URL, LOCATIONIQ_API_KEY } from '../config/api'

/**
 * Check if a query looks like a UK postcode
 * @param {string} query - Search query
 * @returns {boolean} True if query matches UK postcode pattern
 */
const isUKPostcode = (query) => {
  // UK postcode pattern: 1-2 letters, 1-2 numbers, optional letter, space, number, 2 letters
  // Examples: SW1A 1AA, M1 1AA, B33 8TH, W1A 0AX
  const postcodePattern = /^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\s?[0-9][A-Z]{2}$/i
  return postcodePattern.test(query.trim())
}

/**
 * Check if a result has a postcode that matches the search query
 * @param {Object} result - Location result
 * @param {string} query - Original search query
 * @returns {boolean} True if postcode matches
 */
const hasMatchingPostcode = (result, query) => {
  const normalizedQuery = query.trim().toUpperCase().replace(/\s+/g, ' ')
  const resultPostcode = result.address?.postcode?.toUpperCase()
  
  if (!resultPostcode) return false
  
  // Check exact match or partial match (e.g., "SW1A" matches "SW1A 1AA")
  return resultPostcode === normalizedQuery || 
         resultPostcode.startsWith(normalizedQuery.split(' ')[0])
}

/**
 * Forward Geocoding - Convert address/place name to coordinates
 * @param {string} query - Address or place name to search for
 * @returns {Promise<Array>} Array of location results, sorted with postcode matches first
 */
export const searchLocation = async (query) => {
  if (!query || query.trim() === '') {
    return []
  }

  if (!LOCATIONIQ_API_KEY || LOCATIONIQ_API_KEY === '') {
    throw new Error('Please configure your LocationIQ API key in the .env file as VITE_LOCATIONIQ_API_KEY')
  }

  try {
    const encodedQuery = encodeURIComponent(query)
    const isPostcodeQuery = isUKPostcode(query)
    
    // LocationIQ Search API endpoint (forward geocoding)
    // Restrict to UK only using countrycodes=gb
    // Increase limit if searching for postcode to get more results
    const limit = isPostcodeQuery ? 20 : 10
    const url = `${LOCATIONIQ_URL}/search.php?key=${LOCATIONIQ_API_KEY}&q=${encodedQuery}&format=json&limit=${limit}&addressdetails=1&normalizeaddress=1&countrycodes=gb`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your LocationIQ API key.')
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.')
      }
      throw new Error(`Geocoding API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Handle both single result and array of results
    const results = Array.isArray(data) ? data : [data]
    
    const mappedResults = results.map(result => ({
      place_id: result.place_id,
      display_name: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      address: result.address || {},
      importance: result.importance || 0,
      hasPostcode: hasMatchingPostcode({ address: result.address || {} }, query)
    }))
    
    // Sort results: postcode matches first, then by importance
    mappedResults.sort((a, b) => {
      // Prioritize results with matching postcodes
      if (a.hasPostcode && !b.hasPostcode) return -1
      if (!a.hasPostcode && b.hasPostcode) return 1
      
      // If both or neither have postcodes, sort by importance (higher first)
      return (b.importance || 0) - (a.importance || 0)
    })
    
    // Return top 10 results (or all if less than 10)
    return mappedResults.slice(0, 10)
  } catch (error) {
    console.error('Geocoding error:', error)
    throw error
  }
}

/**
 * Reverse Geocoding - Convert coordinates to address
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} Location details with address
 */
export const reverseGeocode = async (lat, lng) => {
  if (!LOCATIONIQ_API_KEY || LOCATIONIQ_API_KEY === '') {
    throw new Error('Please configure your LocationIQ API key in the .env file as VITE_LOCATIONIQ_API_KEY')
  }

  try {
    const url = `${LOCATIONIQ_URL}/reverse.php?key=${LOCATIONIQ_API_KEY}&lat=${lat}&lon=${lng}&format=json&addressdetails=1`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your LocationIQ API key.')
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.')
      }
      throw new Error(`Reverse geocoding API error: ${response.status}`)
    }

    const data = await response.json()
    
    return {
      place_id: data.place_id,
      display_name: data.display_name,
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lon),
      address: data.address || {}
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    throw error
  }
}
