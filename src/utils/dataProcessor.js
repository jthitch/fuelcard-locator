// Utility to extract fuel card names from station data
export const getFuelCardNames = (stations) => {
  const fuelCardColumns = [
    'esso-fleet',
    'esso-maxx',
    'fastfuels',
    'fuelgenie',
    'keyfuels',
    'shell-crt',
    'shell-fleet',
    'uk-fuels',
    'shell-crt-ev',
    'shell-fleet-ev',
    'shell-adblue-sites',
    'maxx-control-pre-pay'
  ];

  return fuelCardColumns;
};

// Format fuel card name for display
export const formatFuelCardName = (name) => {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Check if station accepts a fuel card
export const stationAcceptsFuelCard = (station, fuelCard) => {
  const value = station[fuelCard];
  return value === 1 || value === 1.0 || value === '1';
};

// Filter stations by fuel card
export const filterStationsByFuelCard = (stations, fuelCard) => {
  if (!fuelCard) return stations;
  return stations.filter(station => stationAcceptsFuelCard(station, fuelCard));
};

// Filter stations by multiple fuel cards (stations that accept ANY of the selected cards)
export const filterStationsByFuelCards = (stations, selectedFuelCards) => {
  if (!selectedFuelCards || selectedFuelCards.length === 0) return stations;
  return stations.filter(station => 
    selectedFuelCards.some(card => stationAcceptsFuelCard(station, card))
  );
};

// Filter stations by search term
export const filterStationsBySearch = (stations, searchTerm) => {
  if (!searchTerm) return stations;
  const term = searchTerm.toLowerCase();
  return stations.filter(station => {
    const name = (station.name || '').toLowerCase();
    const address = (station.address1 || '').toLowerCase();
    const city = (station.city || '').toLowerCase();
    const region = (station.region || '').toLowerCase();
    return name.includes(term) || address.includes(term) || city.includes(term) || region.includes(term);
  });
};

// Get full address string
export const getFullAddress = (station) => {
  const parts = [
    station.address1,
    station.address2,
    station.city,
    station.region,
    station.zip
  ].filter(Boolean);
  return parts.join(', ');
};

// Calculate distance between two coordinates using Haversine formula
// Returns distance in miles
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Filter stations by radius from user location
export const filterStationsByRadius = (stations, userLat, userLng, radiusMiles) => {
  if (!userLat || !userLng || !radiusMiles) return stations;
  
  return stations.filter(station => {
    if (!station.lat || !station.lng) return false;
    const distance = calculateDistance(userLat, userLng, station.lat, station.lng);
    station.distance = distance; // Store distance for sorting/display
    return distance <= radiusMiles;
  }).sort((a, b) => (a.distance || 0) - (b.distance || 0)); // Sort by distance
};

// Check if station has a feature
export const stationHasFeature = (station, feature) => {
  const value = station[feature];
  return value === 1 || value === 1.0 || value === '1';
};

// Filter stations by feature
export const filterStationsByFeature = (stations, feature, enabled) => {
  if (!enabled) return stations;
  return stations.filter(station => stationHasFeature(station, feature));
};

// Filter stations by surcharge
export const filterStationsBySurcharge = (stations, surchargeField, selectedSurcharges) => {
  if (!selectedSurcharges || selectedSurcharges.length === 0) return stations;
  return stations.filter(station => {
    const stationSurcharge = station[surchargeField];
    if (!stationSurcharge) return false;
    // Convert to string for comparison
    const surchargeStr = String(stationSurcharge).trim();
    return selectedSurcharges.includes(surchargeStr);
  });
};

// Get unique surcharge values for a field
export const getSurchargeValues = (stations, surchargeField) => {
  const values = stations
    .map(s => s[surchargeField])
    .filter(Boolean)
    .map(v => String(v).trim())
    .filter((v, i, arr) => arr.indexOf(v) === i) // Remove duplicates
    .sort();
  return values;
};

// Get fuel cards accepted at ALL selected stations
export const getFuelCardsForMustHaveStations = (stations, mustHaveStationIndices) => {
  if (!mustHaveStationIndices || mustHaveStationIndices.length === 0) {
    return getFuelCardNames(stations); // Return all cards if no stations selected
  }
  
  // Get the selected stations
  const selectedStations = mustHaveStationIndices
    .map(index => stations[index])
    .filter(Boolean);
  
  if (selectedStations.length === 0) {
    return [];
  }
  
  // Get all fuel card names
  const allFuelCards = getFuelCardNames(stations);
  
  // Find cards accepted at ALL selected stations
  return allFuelCards.filter(card => {
    return selectedStations.every(station => 
      stationAcceptsFuelCard(station, card)
    );
  });
};

// Calculate distance from a point to a line segment (in meters)
function pointToLineDistance(point, lineStart, lineEnd) {
  const R = 6371000; // Earth radius in meters
  
  const lat1 = point[0] * Math.PI / 180;
  const lng1 = point[1] * Math.PI / 180;
  const lat2 = lineStart[0] * Math.PI / 180;
  const lng2 = lineStart[1] * Math.PI / 180;
  const lat3 = lineEnd[0] * Math.PI / 180;
  const lng3 = lineEnd[1] * Math.PI / 180;
  
  // Calculate distance from point to line segment
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distToStart = R * c;
  
  const dLat2 = lat3 - lat1;
  const dLng2 = lng3 - lng1;
  const a2 = Math.sin(dLat2 / 2) * Math.sin(dLat2 / 2) +
             Math.cos(lat1) * Math.cos(lat3) *
             Math.sin(dLng2 / 2) * Math.sin(dLng2 / 2);
  const c2 = 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
  const distToEnd = R * c2;
  
  // Simple approximation: use minimum distance to endpoints
  // For more accuracy, could calculate perpendicular distance to line segment
  return Math.min(distToStart, distToEnd);
}

// Check if a point is within a buffered path
function isPointInBufferedPath(point, path, bufferMeters) {
  if (!path || path.length < 2) return false;
  
  // Check distance to each segment
  for (let i = 0; i < path.length - 1; i++) {
    const distance = pointToLineDistance(point, path[i], path[i + 1]);
    if (distance <= bufferMeters) {
      return true;
    }
  }
  
  return false;
}

// Filter stations by drawn path with buffer
export const filterStationsByPath = (stations, drawnPath) => {
  if (!drawnPath || !drawnPath.path || drawnPath.path.length < 2) {
    return stations;
  }
  
  const bufferMeters = drawnPath.bufferMeters || 1000; // Default 1km buffer
  
  return stations.filter(station => {
    if (!station.lat || !station.lng) return false;
    return isPointInBufferedPath([station.lat, station.lng], drawnPath.path, bufferMeters);
  });
};
