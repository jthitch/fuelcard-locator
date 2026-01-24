import L from 'leaflet'

// Map network names to logo filenames
const networkToLogoMap = {
  'ESSO': 'ESSO.png',
  'SHELL': 'SHELL.png',
  'BP': 'BP.png',
  'JET': 'JET.png',
  'TEXACO': 'TEXACO.png',
  'TOTAL': 'TOTAL.png',
  'GULF': 'GULF.png',
  'MURCO': 'MURCO.png',
  'VALERO': 'VALERO.png',
  'ESSAR': 'ESSAR.png',
  'MAXOL': 'MAXOL.png',
  'APPLEGREEN': 'APPLEGREEN.png',
  'ASDA': 'ASDA.png',
  'TESCO': 'TESCO.png',
  'TESCO EXPRESS': 'TESCO_EXPRESS.png',
  'TESCO EXTRA': 'TESCO_EXTRA.png',
  'SAINSBURYS': 'SAINSBURYS.png',
  'MORRISONS': 'MORRISONS.png',
  'CO-OP': 'CO_OP.png',
  'SPAR': 'SPAR.png',
  'NISA': 'NISA.png',
  'MACE': 'MACE.png',
  'CENTRA': 'CENTRA.png',
  'CIRCLEK': 'CIRCLEK.png',
  'PACE': 'PACE.png',
  'COSTCUTTER': 'COSTCUTTER.png',
  'COSTCO': 'COSTCO.png',
  'GLEANER': 'GLEANER.png',
  'HARVEST ENERGY': 'HARVEST_ENERGY.png',
  'EG ON THE MOVE': 'EG_ON_THE_MOVE.png',
  'EG': 'EG_ON_THE_MOVE.png',
  'ON THE MOVE': 'EG_ON_THE_MOVE.png'
};

// Get logo path for a network name
export const getLogoPath = (network) => {
  if (!network) return '/logos/GENERIC.png';
  
  // Normalize network name (uppercase, trim)
  const normalizedNetwork = network.toUpperCase().trim();
  
  // Check direct match
  if (networkToLogoMap[normalizedNetwork]) {
    return `/logos/${networkToLogoMap[normalizedNetwork]}`;
  }
  
  // Check for partial matches (e.g., "TESCO EXPRESS" contains "TESCO")
  for (const [key, logo] of Object.entries(networkToLogoMap)) {
    if (normalizedNetwork.includes(key) || key.includes(normalizedNetwork)) {
      return `/logos/${logo}`;
    }
  }
  
  // Default to generic logo
  return '/logos/GENERIC.png';
};

// Create a Leaflet icon from a logo with optional comparison status
export const createLogoIcon = (logoPath, comparisonStatus = null, size = 32) => {
  // Determine styling based on comparison status
  let borderStyle = ''
  let opacity = 1
  let indicator = ''
  
  if (comparisonStatus === 'both') {
    // Higher opacity for stations that accept both cards
    opacity = 0.7
  } else if (comparisonStatus === 'selected-only') {
    // Green border for stations only on selected card
    borderStyle = 'border: 3px solid #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);'
    indicator = '<div style="position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; background: #10b981; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>'
  } else if (comparisonStatus === 'comparison-only') {
    // Blue border for stations only on comparison card
    borderStyle = 'border: 3px solid #3b82f6; box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);'
    indicator = '<div style="position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; background: #3b82f6; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>'
  }
  
  return L.divIcon({
    className: 'custom-logo-marker',
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        <img 
          src="${logoPath}" 
          alt="Station logo" 
          style="width: ${size}px; height: ${size}px; object-fit: contain; border-radius: 50%; background: white; padding: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); opacity: ${opacity}; ${borderStyle}" 
        />
        ${indicator}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};
