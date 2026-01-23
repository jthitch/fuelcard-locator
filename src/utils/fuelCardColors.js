// Color mapping for fuel cards
export const fuelCardColors = {
  'esso-fleet': '#FF6B35',
  'esso-maxx': '#F7931E',
  'fastfuels': '#00A8E8',
  'fuelgenie': '#8B5CF6',
  'keyfuels': '#10B981',
  'shell-crt': '#FFD700',
  'shell-fleet': '#FFA500',
  'uk-fuels': '#EF4444',
  'shell-crt-ev': '#22C55E',
  'shell-fleet-ev': '#3B82F6',
  'shell-adblue-sites': '#06B6D4',
  'maxx-control-pre-pay': '#EC4899'
}

// Get color for a fuel card
export const getFuelCardColor = (fuelCard) => {
  return fuelCardColors[fuelCard] || '#6B7280'
}

// Get all colors for selected fuel cards
export const getSelectedFuelCardColors = (selectedFuelCards) => {
  return selectedFuelCards.map(card => ({
    card,
    color: getFuelCardColor(card)
  }))
}
