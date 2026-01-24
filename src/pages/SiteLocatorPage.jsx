import React, { useState, useEffect, useMemo } from 'react'
import StationCard from '../components/StationCard'
import MapView from '../components/MapView'
import stationsData from '../stations_data.json'
import { 
  getFuelCardNames, 
  filterStationsByFuelCards, 
  filterStationsBySearch, 
  filterStationsByRadius,
  filterStationsByFeature,
  filterStationsBySurcharge,
  getSurchargeValues,
  getFuelCardsForMustHaveStations,
  filterStationsByPath
} from '../utils/dataProcessor'
import { searchLocation } from '../utils/geocoding'
import './SiteLocatorPage.css'

function SiteLocatorPage() {
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedFuelCards, setSelectedFuelCards] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('map')
  const [userLocation, setUserLocation] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState(null)
  const [radiusMiles, setRadiusMiles] = useState(10)
  const [filterHGV, setFilterHGV] = useState(false)
  const [filter24_7, setFilter24_7] = useState(false)
  const [selectedUKFuelsSurcharge, setSelectedUKFuelsSurcharge] = useState([])
  const [selectedKeyFuelsSurcharge, setSelectedKeyFuelsSurcharge] = useState([])
  const [selectedFastFuelsSurcharge, setSelectedFastFuelsSurcharge] = useState([])
  const [searchedLocation, setSearchedLocation] = useState(null)
  const [locationSearchTerm, setLocationSearchTerm] = useState('')
  const [locationSearchResults, setLocationSearchResults] = useState([])
  const [locationSearchLoading, setLocationSearchLoading] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState({
    locationSearch: false,
    radius: false,
    search: true,
    features: true,
    fuelCards: true,
    surcharges: true,
    mustHave: true
  })
  const [showLocationMessage, setShowLocationMessage] = useState(false)
  const [mustHaveStations, setMustHaveStations] = useState([]) // Array of station indices
  const [drawnArea, setDrawnArea] = useState(null) // { center: [lat, lng], radius: meters }
  const [comparisonView, setComparisonView] = useState(null) // { selectedCard, comparisonCard } or null
  
  // Collapsible sections state - only Search Location and Search Radius open by default
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
          setLocationLoading(false)
          setLocationError(null)
          // Show location message for 2 seconds
          setShowLocationMessage(true)
          setTimeout(() => {
            setShowLocationMessage(false)
          }, 2000)
        },
        (error) => {
          setLocationError('Unable to get your location')
          setLocationLoading(false)
          console.error('Geolocation error:', error)
        }
      )
    } else {
      setLocationError('Geolocation is not supported by your browser')
    }
  }, [])

  // Handle location search
  const handleLocationSearch = async (query) => {
    if (!query || query.trim().length < 3) {
      setLocationSearchResults([])
      return
    }

    setLocationSearchLoading(true)
    try {
      const results = await searchLocation(query)
      setLocationSearchResults(results)
    } catch (error) {
      console.error('Location search error:', error)
      setLocationSearchResults([])
    } finally {
      setLocationSearchLoading(false)
    }
  }

  const handleLocationSelect = (location) => {
    setSearchedLocation({
      lat: parseFloat(location.lat),
      lng: parseFloat(location.lon),
      displayName: location.display_name
    })
    setLocationSearchTerm(location.display_name)
    setLocationSearchResults([])
  }

  // Get fuel card names
  const fuelCardNames = useMemo(() => getFuelCardNames(stations), [stations])

  const toggleFuelCard = (card) => {
    setSelectedFuelCards(prev => 
      prev.includes(card) 
        ? prev.filter(c => c !== card)
        : [...prev, card]
    )
  }

  const toggleSurcharge = (surchargeType, value) => {
    const setters = {
      'uk_fuels_surcharge': setSelectedUKFuelsSurcharge,
      'keyfuels_surcharge': setSelectedKeyFuelsSurcharge,
      'fastfuels_surcharge': setSelectedFastFuelsSurcharge
    }
    
    const setter = setters[surchargeType]
    if (setter) {
      setter(prev => 
        prev.includes(value)
          ? prev.filter(v => v !== value)
          : [...prev, value]
      )
    }
  }

  const onToggleMustHaveStation = (index) => {
    if (mustHaveStations.includes(index)) {
      setMustHaveStations(mustHaveStations.filter(i => i !== index))
    } else {
      setMustHaveStations([...mustHaveStations, index])
    }
  }

  // Calculate common fuel cards for must-have stations
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
    <div className="site-locator-page">
      <header className="site-locator-header">
        <h1>🚗 Fuel Card Site Locator</h1>
        <p>Find petrol stations that accept your fuel card</p>
        {showLocationMessage && (
          <div className="location-toast">
            ✅ Using your location
          </div>
        )}
      </header>

      <div className="site-locator-container">
        {/* Filters Sidebar */}
        <aside className="filters-sidebar">
          {/* Location Search Section */}
          <div className="collapsible-section">
            <button 
              className="collapsible-header"
              onClick={() => toggleSection('locationSearch')}
            >
              <span className="collapsible-title">Search Location</span>
              <span className={`collapsible-icon ${collapsedSections.locationSearch ? 'collapsed' : ''}`}>▼</span>
            </button>
            {!collapsedSections.locationSearch && (
              <div className="collapsible-content">
                <div className="location-search">
                  <input
                    type="text"
                    placeholder="Enter postcode or location..."
                    value={locationSearchTerm}
                    onChange={(e) => {
                      setLocationSearchTerm(e.target.value)
                      handleLocationSearch(e.target.value)
                    }}
                    className="location-search-input"
                  />
                  {locationSearchLoading && <p className="search-status">Searching...</p>}
                  {locationSearchResults.length > 0 && (
                    <div className="location-results">
                      {locationSearchResults.map((result, index) => (
                        <button
                          key={index}
                          className="location-result-item"
                          onClick={() => handleLocationSelect(result)}
                        >
                          {result.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                  {searchedLocation && (
                    <div className="selected-location">
                      <p>📍 {searchedLocation.displayName}</p>
                      <button 
                        onClick={() => {
                          setSearchedLocation(null)
                          setLocationSearchTerm('')
                        }}
                        className="clear-location-btn"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Search Radius Section */}
          <div className="collapsible-section">
            <button 
              className="collapsible-header"
              onClick={() => toggleSection('radius')}
            >
              <span className="collapsible-title">Search Radius</span>
              <span className={`collapsible-icon ${collapsedSections.radius ? 'collapsed' : ''}`}>▼</span>
            </button>
            {!collapsedSections.radius && (
              <div className="collapsible-content">
                <div className="radius-control">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={radiusMiles}
                    onChange={(e) => setRadiusMiles(Number(e.target.value))}
                    className="radius-slider"
                  />
                  <span className="radius-value">{radiusMiles} miles</span>
                </div>
              </div>
            )}
          </div>

          {/* Must Have Stations Section */}
          <div className="collapsible-section">
            <button 
              className="collapsible-header"
              onClick={() => toggleSection('mustHave')}
            >
              <span className="collapsible-title">Must Have Stations</span>
              <span className={`collapsible-icon ${collapsedSections.mustHave ? 'collapsed' : ''}`}>▼</span>
            </button>
            {!collapsedSections.mustHave && (
              <div className="collapsible-content">
                {mustHaveStations.length > 0 && (
                  <div className="must-have-info">
                    <p className="must-have-description">
                      Showing stations that accept cards common to all selected stations:
                    </p>
                    <div className="must-have-stations-list">
                      {mustHaveStations.map((stationIndex) => {
                        const station = stations[stationIndex]
                        return station ? (
                          <div key={stationIndex} className="must-have-station-item">
                            <span className="must-have-station-name">
                              {station.name} - {station.city || station.postcode}
                            </span>
                            <button
                              className="must-have-station-remove-btn"
                              onClick={() => onToggleMustHaveStation(stationIndex)}
                              title="Remove from must have list"
                            >
                              ×
                            </button>
                          </div>
                        ) : null
                      })}
                    </div>
                    {mustHaveFuelCards && mustHaveFuelCards.length > 0 ? (
                      <div className="must-have-cards">
                        <strong>Common Cards:</strong>
                        {mustHaveFuelCards.map(card => (
                          <span key={card} className="must-have-card-tag">{card}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="must-have-no-cards">No common fuel cards found</p>
                    )}
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

          {/* Search Stations Section */}
          <div className="collapsible-section">
            <button 
              className="collapsible-header"
              onClick={() => toggleSection('search')}
            >
              <span className="collapsible-title">Search Stations</span>
              <span className={`collapsible-icon ${collapsedSections.search ? 'collapsed' : ''}`}>▼</span>
            </button>
            {!collapsedSections.search && (
              <div className="collapsible-content">
                <input
                  type="text"
                  placeholder="Search by name, address, city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            )}
          </div>

          {/* Features Section */}
          <div className="collapsible-section">
            <button 
              className="collapsible-header"
              onClick={() => toggleSection('features')}
            >
              <span className="collapsible-title">Features</span>
              <span className={`collapsible-icon ${collapsedSections.features ? 'collapsed' : ''}`}>▼</span>
            </button>
            {!collapsedSections.features && (
              <div className="collapsible-content">
                <div className="filter-group">
                  <label className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={filterHGV}
                      onChange={(e) => setFilterHGV(e.target.checked)}
                    />
                    <span>HGV Access</span>
                  </label>
                  <label className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={filter24_7}
                      onChange={(e) => setFilter24_7(e.target.checked)}
                    />
                    <span>24/7 Open</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Fuel Cards Section */}
          <div className="collapsible-section">
            <button 
              className="collapsible-header"
              onClick={() => toggleSection('fuelCards')}
            >
              <span className="collapsible-title">Fuel Cards</span>
              <span className={`collapsible-icon ${collapsedSections.fuelCards ? 'collapsed' : ''}`}>▼</span>
            </button>
            {!collapsedSections.fuelCards && (
              <div className="collapsible-content">
                <div className="filter-group">
                  {fuelCardNames.map(card => (
                    <label key={card} className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedFuelCards.includes(card)}
                        onChange={() => toggleFuelCard(card)}
                      />
                      <span>{card}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Surcharges Section */}
          <div className="collapsible-section">
            <button 
              className="collapsible-header"
              onClick={() => toggleSection('surcharges')}
            >
              <span className="collapsible-title">Surcharges</span>
              <span className={`collapsible-icon ${collapsedSections.surcharges ? 'collapsed' : ''}`}>▼</span>
            </button>
            {!collapsedSections.surcharges && (
              <div className="collapsible-content">
                {/* UK Fuels Surcharges */}
                {ukFuelsSurcharges.length > 0 && (
                  <div className="surcharge-group">
                    <h4 className="surcharge-title">UK Fuels</h4>
                    {ukFuelsSurcharges.map(value => (
                      <label key={value} className="filter-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedUKFuelsSurcharge.includes(value)}
                          onChange={() => toggleSurcharge('uk_fuels_surcharge', value)}
                        />
                        <span>{value}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* KeyFuels Surcharges */}
                {keyFuelsSurcharges.length > 0 && (
                  <div className="surcharge-group">
                    <h4 className="surcharge-title">KeyFuels</h4>
                    {keyFuelsSurcharges.map(value => (
                      <label key={value} className="filter-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedKeyFuelsSurcharge.includes(value)}
                          onChange={() => toggleSurcharge('keyfuels_surcharge', value)}
                        />
                        <span>{value}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* FastFuels Surcharges */}
                {fastFuelsSurcharges.length > 0 && (
                  <div className="surcharge-group">
                    <h4 className="surcharge-title">FastFuels</h4>
                    {fastFuelsSurcharges.map(value => (
                      <label key={value} className="filter-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedFastFuelsSurcharge.includes(value)}
                          onChange={() => toggleSurcharge('fastfuels_surcharge', value)}
                        />
                        <span>{value}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <div className="view-controls">
            <div className="results-count">
              Found {filteredStations.length} station{filteredStations.length !== 1 ? 's' : ''}
            </div>
            <div className="view-toggle">
              <button
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <svg className="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5H21V7H3V5ZM3 11H21V13H3V11ZM3 17H21V19H3V17Z"></path></svg>
                List
              </button>
              <button
                className={`view-btn ${viewMode === 'map' ? 'active' : ''}`}
                onClick={() => setViewMode('map')}
              >
                <svg className="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                Map
              </button>
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="stations-list">
              {filteredStations.map((station, index) => {
                const actualIndex = stations.findIndex(s => 
                  s.name === station.name && 
                  s.lat === station.lat && 
                  s.lng === station.lng
                )
                const isMustHave = mustHaveStations.includes(actualIndex)
                
                return (
                  <StationCard 
                    key={`${station.lat}-${station.lng}-${index}`} 
                    station={station}
                    isMustHave={isMustHave}
                    onToggleMustHave={() => onToggleMustHaveStation(actualIndex)}
                  />
                )
              })}
            </div>
          ) : (
            <MapView 
              stations={filteredStations}
              userLocation={userLocation}
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
        </main>
      </div>
    </div>
  )
}

export default SiteLocatorPage
