import { useState, useEffect, useMemo } from 'react'
import stationsData from './stations_data.json'
import { 
  getFuelCardNames, 
  formatFuelCardName, 
  filterStationsByFuelCards,
  filterStationsBySearch,
  filterStationsByRadius,
  filterStationsByFeature,
  filterStationsBySurcharge,
  getSurchargeValues,
  getFuelCardsForMustHaveStations,
  filterStationsByPath
} from './utils/dataProcessor'
import { searchLocation } from './utils/geocoding'
import StationCard from './components/StationCard'
import MapView from './components/MapView'
import './App.css'

function App() {
  const [stations, setStations] = useState([])
  const [selectedFuelCards, setSelectedFuelCards] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('list') // 'list' or 'map'
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [radiusMiles, setRadiusMiles] = useState(10)
  const [locationLoading, setLocationLoading] = useState(false)
  const [filterHGV, setFilterHGV] = useState(false)
  const [filter24_7, setFilter24_7] = useState(false)
  const [selectedUKFuelsSurcharge, setSelectedUKFuelsSurcharge] = useState([])
  const [selectedKeyFuelsSurcharge, setSelectedKeyFuelsSurcharge] = useState([])
  const [selectedFastFuelsSurcharge, setSelectedFastFuelsSurcharge] = useState([])
  const [locationSearchQuery, setLocationSearchQuery] = useState('')
  const [locationSearchResults, setLocationSearchResults] = useState([])
  const [locationSearchLoading, setLocationSearchLoading] = useState(false)
  const [locationSearchError, setLocationSearchError] = useState(null)
  const [searchedLocation, setSearchedLocation] = useState(null)
  const [showLocationMessage, setShowLocationMessage] = useState(false)
  const [mustHaveStations, setMustHaveStations] = useState([]) // Array of station indices
  const [drawnArea, setDrawnArea] = useState(null) // { center: [lat, lng], radius: meters }
  const [comparisonView, setComparisonView] = useState(null) // { selectedCard, comparisonCard } or null
  
  // Collapsible sections state - only Search Location and Search Radius open by default
  const [collapsedSections, setCollapsedSections] = useState({
    search: true,           // Collapsed by default
    locationSearch: false, // Open by default
    radius: false,         // Open by default
    features: true,        // Collapsed by default
    fuelCards: true,       // Collapsed by default
    surcharges: true,      // Collapsed by default
    mustHave: true         // Collapsed by default
  })

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  useEffect(() => {
    // Load and clean station data
    const cleanedStations = stationsData
      .filter(station => station.lat && station.lng && station.name)
      .map(station => ({
        ...station,
        lat: parseFloat(station.lat),
        lng: parseFloat(station.lng)
      }))
    
    setStations(cleanedStations)
    setLoading(false)
  }, [])

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      setLocationLoading(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
          setLocationError(null)
          setLocationLoading(false)
          // Show message when location is obtained
          setShowLocationMessage(true)
        },
        (error) => {
          setLocationError(error.message)
          setLocationLoading(false)
          console.error('Geolocation error:', error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    } else {
      setLocationError('Geolocation is not supported by your browser')
      setLocationLoading(false)
    }
  }, [])

  // Hide location message after 2 seconds
  useEffect(() => {
    if (showLocationMessage) {
      const timer = setTimeout(() => {
        setShowLocationMessage(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [showLocationMessage])

  // Handle location search
  const handleLocationSearch = async () => {
    if (!locationSearchQuery.trim()) return

    setLocationSearchLoading(true)
    setLocationSearchError(null)
    setLocationSearchResults([])

    try {
      const results = await searchLocation(locationSearchQuery)
      setLocationSearchResults(results)
      if (results.length === 0) {
        setLocationSearchError('No locations found. Try a different search term.')
      }
    } catch (error) {
      setLocationSearchError(error.message || 'Failed to search location')
      setLocationSearchResults([])
    } finally {
      setLocationSearchLoading(false)
    }
  }

  // Handle location selection
  const handleSelectLocation = (location) => {
    setSearchedLocation(location)
    setUserLocation({
      lat: location.lat,
      lng: location.lng
    })
    setLocationSearchQuery('')
    setLocationSearchResults([])
    setLocationSearchError(null)
  }

  const fuelCardNames = useMemo(() => getFuelCardNames(stations), [stations])
  
  // Calculate fuel cards accepted at all must-have stations
  const mustHaveFuelCards = useMemo(() => {
    if (mustHaveStations.length === 0) return null
    return getFuelCardsForMustHaveStations(stations, mustHaveStations)
  }, [stations, mustHaveStations])

  // Get available surcharge values
  const ukFuelsSurcharges = useMemo(() => getSurchargeValues(stations, 'uk_fuels_surcharge'), [stations])
  const keyFuelsSurcharges = useMemo(() => getSurchargeValues(stations, 'keyfuels_surcharge'), [stations])
  const fastFuelsSurcharges = useMemo(() => getSurchargeValues(stations, 'fastfuels_surcharge'), [stations])

  const filteredStations = useMemo(() => {
    let filtered = stations
    
    // Filter by drawn path areas first (takes priority over user location radius)
    if (drawnArea && Array.isArray(drawnArea) && drawnArea.length > 0) {
      // Filter by any of the drawn paths (OR logic - station in any path)
      filtered = filtered.filter(station => {
        return drawnArea.some(path => {
          if (path.path && path.path.length >= 2) {
            return filterStationsByPath([station], path).length > 0
          }
          return false
        })
      })
    } else if (drawnArea && drawnArea.path && drawnArea.path.length >= 2) {
      // Backward compatibility with single path
      filtered = filterStationsByPath(filtered, drawnArea)
    } else {
      // Filter by radius (if user location or searched location is available)
      const locationToUse = userLocation || (searchedLocation ? { lat: searchedLocation.lat, lng: searchedLocation.lng } : null)
      if (locationToUse && locationToUse.lat && locationToUse.lng && radiusMiles) {
        filtered = filterStationsByRadius(filtered, locationToUse.lat, locationToUse.lng, radiusMiles)
      }
    }
    
    // Filter by must-have stations: only show stations that accept at least one of the fuel cards
    // that are accepted at all must-have stations
    if (mustHaveFuelCards && mustHaveFuelCards.length > 0) {
      filtered = filterStationsByFuelCards(filtered, mustHaveFuelCards)
    }
    
    // Filter by fuel cards (multi-select) - this is separate from must-have filtering
    if (selectedFuelCards.length > 0) {
      filtered = filterStationsByFuelCards(filtered, selectedFuelCards)
    }
    
    if (searchTerm) {
      filtered = filterStationsBySearch(filtered, searchTerm)
    }
    
    // Filter by features
    if (filterHGV) {
      filtered = filterStationsByFeature(filtered, 'hgv', true)
    }
    
    if (filter24_7) {
      filtered = filterStationsByFeature(filtered, '24-7', true)
    }
    
    // Filter by surcharges
    if (selectedUKFuelsSurcharge.length > 0) {
      filtered = filterStationsBySurcharge(filtered, 'uk_fuels_surcharge', selectedUKFuelsSurcharge)
    }
    
    if (selectedKeyFuelsSurcharge.length > 0) {
      filtered = filterStationsBySurcharge(filtered, 'keyfuels_surcharge', selectedKeyFuelsSurcharge)
    }
    
    if (selectedFastFuelsSurcharge.length > 0) {
      filtered = filterStationsBySurcharge(filtered, 'fastfuels_surcharge', selectedFastFuelsSurcharge)
    }
    
    return filtered
  }, [stations, selectedFuelCards, searchTerm, userLocation, searchedLocation, radiusMiles, filterHGV, filter24_7, selectedUKFuelsSurcharge, selectedKeyFuelsSurcharge, selectedFastFuelsSurcharge, mustHaveFuelCards, drawnArea])

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading stations...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🚗 FleetMaxx Site Locator</h1>
        <p>Find petrol stations that accept your fuel card</p>
        {showLocationMessage && (
          <div className="location-toast">
            ✅ Using your location
          </div>
        )}
      </header>

      <div className="app-container">
        <div className="sidebar">
          <div className="search-section">
            <div className="collapsible-section">
              <button 
                className="collapsible-header"
                onClick={() => toggleSection('locationSearch')}
              >
                <span className="collapsible-title">Search Location</span>
                <span className="collapsible-icon">{collapsedSections.locationSearch ? '▶' : '▼'}</span>
              </button>
              {!collapsedSections.locationSearch && (
                <div className="collapsible-content">
                  <div className="location-search-container">
                <input
                  type="text"
                  placeholder="Enter address or place name..."
                  value={locationSearchQuery}
                  onChange={(e) => {
                    setLocationSearchQuery(e.target.value)
                    setLocationSearchError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && locationSearchQuery.trim()) {
                      handleLocationSearch()
                    }
                  }}
                  className="search-input"
                />
                <button
                  onClick={handleLocationSearch}
                  disabled={locationSearchLoading || !locationSearchQuery.trim()}
                  className="search-location-btn"
                >
                  {locationSearchLoading ? '⏳' : '🔍'}
                </button>
              </div>
              {locationSearchLoading && (
                <p className="location-status">Searching...</p>
              )}
              {locationSearchError && (
                <p className="location-error">{locationSearchError}</p>
              )}
              {locationSearchResults.length > 0 && (
                <div className="location-results">
                  <p className="results-label">Select a location:</p>
                  {locationSearchResults.map((result, index) => (
                    <button
                      key={result.place_id || index}
                      onClick={() => handleSelectLocation(result)}
                      className="location-result-item"
                    >
                      <strong>{result.display_name}</strong>
                      <span className="location-coords">
                        {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {searchedLocation && (
                <div className="selected-location">
                  <p className="selected-location-label">📍 Selected:</p>
                  <p className="selected-location-name">{searchedLocation.display_name}</p>
                  <button
                    onClick={() => {
                      setSearchedLocation(null)
                      setUserLocation(null)
                    }}
                    className="clear-location-btn"
                  >
                    Clear Location
                  </button>
                </div>
              )}
                </div>
              )}
            </div>

            <div className="collapsible-section">
              <button 
                className="collapsible-header"
                onClick={() => toggleSection('radius')}
              >
                <span className="collapsible-title">Search Radius</span>
                <span className="collapsible-icon">{collapsedSections.radius ? '▶' : '▼'}</span>
              </button>
              {!collapsedSections.radius && (
                <div className="collapsible-content">
                  <div className="filter-section">
              <div className="radius-control">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={radiusMiles}
                  onChange={(e) => setRadiusMiles(Number(e.target.value))}
                  className="radius-slider"
                />
                <div className="radius-value">{radiusMiles} miles</div>
              </div>
                  </div>
                </div>
              )}
            </div>

            <div className="collapsible-section">
              <button 
                className="collapsible-header"
                onClick={() => toggleSection('features')}
              >
                <span className="collapsible-title">Station Features</span>
                <span className="collapsible-icon">{collapsedSections.features ? '▶' : '▼'}</span>
              </button>
              {!collapsedSections.features && (
                <div className="collapsible-content">
                  <div className="filter-section">
              <div className="feature-filters">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filter24_7}
                    onChange={(e) => setFilter24_7(e.target.checked)}
                    className="feature-checkbox"
                  />
                  <span>24/7 Available</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filterHGV}
                    onChange={(e) => setFilterHGV(e.target.checked)}
                    className="feature-checkbox"
                  />
                  <span>HGV</span>
                </label>
              </div>
                  </div>
                </div>
              )}
            </div>

            <div className="collapsible-section">
              <button 
                className="collapsible-header"
                onClick={() => toggleSection('fuelCards')}
              >
                <span className="collapsible-title">Filter by Fuel Cards</span>
                <span className="collapsible-icon">{collapsedSections.fuelCards ? '▶' : '▼'}</span>
              </button>
              {!collapsedSections.fuelCards && (
                <div className="collapsible-content">
                  <div className="filter-section">
              <div className="fuel-card-filters">
                {fuelCardNames.map((card) => (
                  <label key={card} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedFuelCards.includes(card)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFuelCards([...selectedFuelCards, card])
                        } else {
                          setSelectedFuelCards(selectedFuelCards.filter(c => c !== card))
                        }
                      }}
                      className="feature-checkbox"
                    />
                    <span>{formatFuelCardName(card)}</span>
                  </label>
                ))}
                {selectedFuelCards.length > 0 && (
                  <button
                    className="clear-filters-btn"
                    onClick={() => setSelectedFuelCards([])}
                  >
                    Clear All
                  </button>
                )}
              </div>
                  </div>
                </div>
              )}
            </div>

            <div className="collapsible-section">
              <button 
                className="collapsible-header"
                onClick={() => toggleSection('surcharges')}
              >
                <span className="collapsible-title">Surcharge Filters</span>
                <span className="collapsible-icon">{collapsedSections.surcharges ? '▶' : '▼'}</span>
              </button>
              {!collapsedSections.surcharges && (
                <div className="collapsible-content">
                  <div className="filter-section">
              
              <div className="surcharge-filter-group">
                <label className="surcharge-label">UK Fuels Surcharge:</label>
                <div className="surcharge-options">
                  {ukFuelsSurcharges.map((surcharge) => (
                    <label key={surcharge} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedUKFuelsSurcharge.includes(surcharge)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUKFuelsSurcharge([...selectedUKFuelsSurcharge, surcharge])
                          } else {
                            setSelectedUKFuelsSurcharge(selectedUKFuelsSurcharge.filter(s => s !== surcharge))
                          }
                        }}
                        className="feature-checkbox"
                      />
                      <span>{surcharge}</span>
                    </label>
                  ))}
                  {selectedUKFuelsSurcharge.length > 0 && (
                    <button
                      className="clear-surcharge-btn"
                      onClick={() => setSelectedUKFuelsSurcharge([])}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="surcharge-filter-group">
                <label className="surcharge-label">KeyFuels Surcharge:</label>
                <div className="surcharge-options">
                  {keyFuelsSurcharges.map((surcharge) => (
                    <label key={surcharge} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedKeyFuelsSurcharge.includes(surcharge)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedKeyFuelsSurcharge([...selectedKeyFuelsSurcharge, surcharge])
                          } else {
                            setSelectedKeyFuelsSurcharge(selectedKeyFuelsSurcharge.filter(s => s !== surcharge))
                          }
                        }}
                        className="feature-checkbox"
                      />
                      <span>{surcharge}</span>
                    </label>
                  ))}
                  {selectedKeyFuelsSurcharge.length > 0 && (
                    <button
                      className="clear-surcharge-btn"
                      onClick={() => setSelectedKeyFuelsSurcharge([])}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="surcharge-filter-group">
                <label className="surcharge-label">FastFuels Surcharge:</label>
                <div className="surcharge-options">
                  {fastFuelsSurcharges.map((surcharge) => (
                    <label key={surcharge} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedFastFuelsSurcharge.includes(surcharge)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFastFuelsSurcharge([...selectedFastFuelsSurcharge, surcharge])
                          } else {
                            setSelectedFastFuelsSurcharge(selectedFastFuelsSurcharge.filter(s => s !== surcharge))
                          }
                        }}
                        className="feature-checkbox"
                      />
                      <span>{surcharge}</span>
                    </label>
                  ))}
                  {selectedFastFuelsSurcharge.length > 0 && (
                    <button
                      className="clear-surcharge-btn"
                      onClick={() => setSelectedFastFuelsSurcharge([])}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
                  </div>
                </div>
              )}
            </div>

            <div className="collapsible-section">
              <button 
                className="collapsible-header"
                onClick={() => toggleSection('mustHave')}
              >
                <span className="collapsible-title">Must Have Stations</span>
                <span className="collapsible-icon">{collapsedSections.mustHave ? '▶' : '▼'}</span>
              </button>
              {!collapsedSections.mustHave && (
                <div className="collapsible-content">
                  {mustHaveStations.length > 0 && (
                    <div className="must-have-info">
                      <p className="must-have-description">
                        Showing fuel cards accepted at <strong>all {mustHaveStations.length}</strong> selected station{mustHaveStations.length !== 1 ? 's' : ''}:
                      </p>
                      
                      {/* List of selected stations */}
                      <div className="must-have-stations-list">
                        <strong className="must-have-stations-label">Selected Stations:</strong>
                        <ul className="must-have-stations-ul">
                          {mustHaveStations.map((stationIndex) => {
                            const station = stations[stationIndex]
                            if (!station) return null
                            return (
                              <li key={stationIndex} className="must-have-station-item">
                                <span className="must-have-station-name">{station.name || 'Unnamed Station'}</span>
                                <span className="must-have-station-address">
                                  {station.city || station.postcode || ''}
                                </span>
                                <button
                                  className="must-have-remove-btn"
                                  onClick={() => setMustHaveStations(mustHaveStations.filter(i => i !== stationIndex))}
                                  title="Remove from must-have list"
                                >
                                  ×
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                      
                      {mustHaveFuelCards && mustHaveFuelCards.length > 0 ? (
                        <div className="must-have-cards">
                          <strong className="must-have-cards-label">Accepted Fuel Cards:</strong>
                          <div className="must-have-cards-tags">
                            {mustHaveFuelCards.map(card => (
                              <span key={card} className="must-have-card-tag">
                                {formatFuelCardName(card)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : mustHaveFuelCards && mustHaveFuelCards.length === 0 ? (
                        <p className="must-have-no-cards">No fuel cards accepted at all selected stations.</p>
                      ) : null}
                      <button
                        className="clear-must-have-btn"
                        onClick={() => setMustHaveStations([])}
                      >
                        Clear Selection
                      </button>
                    </div>
                  )}
                  {mustHaveStations.length === 0 && (
                    <p className="must-have-instructions">
                      Select stations from the list or map to find fuel cards accepted at all of them.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="collapsible-section">
              <button 
                className="collapsible-header"
                onClick={() => toggleSection('search')}
              >
                <span className="collapsible-title">Search Stations</span>
                <span className="collapsible-icon">{collapsedSections.search ? '▶' : '▼'}</span>
              </button>
              {!collapsedSections.search && (
                <div className="collapsible-content">
                  <input
                    type="text"
                    placeholder="Search by name, city, or address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
              )}
            </div>

            <div className="results-count">
              <strong>{filteredStations.length}</strong> station{filteredStations.length !== 1 ? 's' : ''} found
            </div>

            <div className="view-toggle">
              <button
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="4" width="14" height="2" fill="black"/>
                  <rect x="3" y="9" width="14" height="2" fill="black"/>
                  <rect x="3" y="14" width="14" height="2" fill="black"/>
                </svg>
                List
              </button>
              <button
                className={`view-btn ${viewMode === 'map' ? 'active' : ''}`}
                onClick={() => setViewMode('map')}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 3L7 2L10 5L13 4L17 6V17L13 18L10 15L7 16L3 14V3Z" stroke="black" strokeWidth="1.5" fill="none"/>
                  <path d="M7 2V16" stroke="black" strokeWidth="1.5"/>
                  <path d="M10 5V15" stroke="black" strokeWidth="1.5"/>
                  <path d="M13 4V18" stroke="black" strokeWidth="1.5"/>
                </svg>
                Map
              </button>
            </div>
          </div>
        </div>

        <div className="main-content">
          {viewMode === 'list' ? (
            <div className="stations-list">
              {filteredStations.length === 0 ? (
                <div className="no-results">
                  <p>No stations found. Try adjusting your filters.</p>
                </div>
              ) : (
                filteredStations.map((station, index) => (
                  <StationCard key={index} station={station} />
                ))
              )}
            </div>
          ) : (
            <MapView 
              stations={filteredStations} 
              userLocation={userLocation || (searchedLocation ? { lat: searchedLocation.lat, lng: searchedLocation.lng } : null)}
              radiusMiles={radiusMiles}
              selectedFuelCards={selectedFuelCards}
              mustHaveStations={mustHaveStations}
              allStations={stations}
              mustHaveFuelCards={mustHaveFuelCards}
              onToggleMustHaveStation={(index) => {
                if (mustHaveStations.includes(index)) {
                  setMustHaveStations(mustHaveStations.filter(i => i !== index))
                } else {
                  setMustHaveStations([...mustHaveStations, index])
                }
              }}
              onDrawAreaChange={(area) => {
                setDrawnArea(area)
              }}
              comparisonView={comparisonView}
              onComparisonViewChange={setComparisonView}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default App
