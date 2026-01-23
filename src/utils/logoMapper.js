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

// Create a Leaflet icon from a logo
export const createLogoIcon = (logoPath, size = 32) => {
  return L.divIcon({
    className: 'custom-logo-marker',
    html: `<img src="${logoPath}" alt="Station logo" style="width: ${size}px; height: ${size}px; object-fit: contain; border-radius: 50%; background: white; padding: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);" />`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};
