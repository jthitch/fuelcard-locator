import React, { useMemo, useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, useMap, Polyline, Polygon } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './MapView.css'
import { getFullAddress, formatFuelCardName, stationAcceptsFuelCard, getFuelCardNames } from '../utils/dataProcessor'
import { getLogoPath, createLogoIcon } from '../utils/logoMapper'
import { getFuelCardColor } from '../utils/fuelCardColors'

// Fix for default marker icons in Leaflet with Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Custom icon for user location (blue marker)
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: '<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
})

// Component to update map center only on initial load
function MapUpdater({ center, zoom }) {
  const map = useMap()
  const hasInitialized = useRef(false)
  const userHasPanned = useRef(false)
  
  // Only set initial center/zoom on first load
  useEffect(() => {
    if (!hasInitialized.current && center) {
      map.setView(center, zoom)
      hasInitialized.current = true
    }
  }, [center, zoom, map])
  
  // Track if user has manually panned the map
  useEffect(() => {
    const handleDragStart = () => {
      userHasPanned.current = true
    }
    
    const handleMoveEnd = () => {
      userHasPanned.current = true
    }
    
    map.on('dragstart', handleDragStart)
    map.on('moveend', handleMoveEnd)
    map.on('zoomend', handleMoveEnd)
    
    return () => {
      map.off('dragstart', handleDragStart)
      map.off('moveend', handleMoveEnd)
      map.off('zoomend', handleMoveEnd)
    }
  }, [map])
  
  return null
}

// Component to handle drawing on the map
function DrawingHandler({ isDrawing, onDrawComplete, brushSize = 1000 }) {
  const map = useMap()
  const [tempPath, setTempPath] = useState(null)
  const [tempBuffer, setTempBuffer] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [pathPoints, setPathPoints] = useState([])
  const [brushIndicator, setBrushIndicator] = useState(null)
  const brushIndicatorRef = useRef(null)
  const isDraggingRef = useRef(false)
  const pathPointsRef = useRef([])
  const tempPathRef = useRef(null)
  const tempBufferRef = useRef(null)
  const tempCirclesRef = useRef([]) // Array of circle layers for the worm effect
  
  // Sync refs with state
  useEffect(() => {
    isDraggingRef.current = isDragging
  }, [isDragging])
  
  useEffect(() => {
    pathPointsRef.current = pathPoints
  }, [pathPoints])
  
  useEffect(() => {
    tempPathRef.current = tempPath
  }, [tempPath])
  
  useEffect(() => {
    tempBufferRef.current = tempBuffer
  }, [tempBuffer])
  
  useEffect(() => {
    if (!isDrawing) {
      // Clean up
      if (tempPathRef.current) {
        map.removeLayer(tempPathRef.current)
        setTempPath(null)
        tempPathRef.current = null
      }
      if (tempBufferRef.current) {
        map.removeLayer(tempBufferRef.current)
        setTempBuffer(null)
        tempBufferRef.current = null
      }
      setPathPoints([])
      pathPointsRef.current = []
      setIsDragging(false)
      isDraggingRef.current = false
      // Re-enable map dragging
      map.dragging.enable()
      map.getContainer().style.cursor = ''
      // Remove brush indicator
      if (brushIndicatorRef.current) {
        map.removeLayer(brushIndicatorRef.current)
        brushIndicatorRef.current = null
        setBrushIndicator(null)
      }
      return
    }
    
    // Disable map dragging when in drawing mode
    map.dragging.disable()
    
    // Change cursor to crosshair when drawing
    map.getContainer().style.cursor = 'crosshair'
    
    // Create brush indicator (circle that follows mouse)
    const updateBrushIndicator = (latlng) => {
      // Ensure brushSize is a valid number
      const validBrushSize = brushSize && !isNaN(brushSize) && brushSize > 0 ? brushSize : 1000
      
      // Update existing circle position instead of recreating
      if (brushIndicatorRef.current) {
        brushIndicatorRef.current.setLatLng(latlng)
        brushIndicatorRef.current.setRadius(validBrushSize)
      } else {
        const circle = L.circle(latlng, {
          radius: validBrushSize,
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.3,
          weight: 2,
          dashArray: '5, 5',
          interactive: false
        })
        circle.addTo(map)
        brushIndicatorRef.current = circle
        setBrushIndicator(circle)
      }
    }
    
    const handleMouseDown = (e) => {
      // Only start drawing on left mouse button
      if (e.originalEvent.button === 0) {
        e.originalEvent.preventDefault()
        e.originalEvent.stopPropagation()
        setIsDragging(true)
        isDraggingRef.current = true
        const point = [e.latlng.lat, e.latlng.lng]
        setPathPoints([point])
        pathPointsRef.current = [point]
      }
    }
    
    const handleMouseMove = (e) => {
      // Update brush indicator position directly (don't update state on every move)
      if (!isDraggingRef.current) {
        updateBrushIndicator(e.latlng)
      }
      
      if (isDraggingRef.current && pathPointsRef.current.length > 0) {
        e.originalEvent.preventDefault()
        e.originalEvent.stopPropagation()
        const point = [e.latlng.lat, e.latlng.lng]
        // Only add point if it's significantly different from last point (to avoid too many points)
        const lastPoint = pathPointsRef.current[pathPointsRef.current.length - 1]
        const distance = L.latLng(lastPoint[0], lastPoint[1]).distanceTo(e.latlng)
        
        // Add point if it's more than 50 meters away from last point
        if (distance > 50 || pathPointsRef.current.length === 1) {
          const newPath = [...pathPointsRef.current, point]
          setPathPoints(newPath)
          pathPointsRef.current = newPath
          
          // Remove old circles
          if (tempCirclesRef.current && tempCirclesRef.current.length > 0) {
            tempCirclesRef.current.forEach(circle => {
              if (circle) map.removeLayer(circle)
            })
            tempCirclesRef.current = []
          }
          if (tempPathRef.current) {
            map.removeLayer(tempPathRef.current)
            tempPathRef.current = null
          }
          if (tempBufferRef.current) {
            map.removeLayer(tempBufferRef.current)
            tempBufferRef.current = null
          }
          
          // Create series of circles along the path for smooth "worm" effect
          const validBrushSize = brushSize && !isNaN(brushSize) && brushSize > 0 ? brushSize : 1000
          const circles = []
          
          // Create circles at each point, with additional circles between points for smoothness
          for (let i = 0; i < newPath.length; i++) {
            const point = newPath[i]
            const circle = L.circle([point[0], point[1]], {
              radius: validBrushSize,
              fillColor: '#10b981',
              fillOpacity: 0.05,
              weight: 0
            })
            circle.addTo(map)
            circles.push(circle)
            
            // Add intermediate circles between points for smoother appearance
            if (i < newPath.length - 1) {
              const nextPoint = newPath[i + 1]
              const distance = L.latLng(point[0], point[1]).distanceTo([nextPoint[0], nextPoint[1]])
              // Increase spacing to reduce overlap - one circle every 0.8x brush radius (was 0.5x)
              const numIntermediate = Math.floor(distance / (validBrushSize * 0.8))
              
              for (let j = 1; j < numIntermediate; j++) {
                const t = j / numIntermediate
                const interLat = point[0] + (nextPoint[0] - point[0]) * t
                const interLng = point[1] + (nextPoint[1] - point[1]) * t
                const interCircle = L.circle([interLat, interLng], {
                  radius: validBrushSize,
                  fillColor: '#10b981',
                  fillOpacity: 0.05,
                  weight: 0
                })
                interCircle.addTo(map)
                circles.push(interCircle)
              }
            }
          }
          
          tempCirclesRef.current = circles
        }
      }
    }
    
    const handleMouseUp = (e) => {
      if (isDraggingRef.current && pathPointsRef.current.length > 0) {
        e.originalEvent.preventDefault()
        e.originalEvent.stopPropagation()
        setIsDragging(false)
        isDraggingRef.current = false
        const point = [e.latlng.lat, e.latlng.lng]
        
        // Add final point if it's different from last point
        let finalPath = pathPointsRef.current
        const lastPoint = pathPointsRef.current[pathPointsRef.current.length - 1]
        const distance = L.latLng(lastPoint[0], lastPoint[1]).distanceTo(e.latlng)
        if (distance > 10) { // Add if more than 10 meters away
          finalPath = [...pathPointsRef.current, point]
        }
        
        if (finalPath.length >= 2) {
          const validBrushSize = brushSize && !isNaN(brushSize) && brushSize > 0 ? brushSize : 1000
          onDrawComplete({
            path: finalPath,
            bufferMeters: validBrushSize
          })
        }
        
        // Clean up temp layers
        if (tempPathRef.current) {
          map.removeLayer(tempPathRef.current)
          setTempPath(null)
          tempPathRef.current = null
        }
        if (tempBufferRef.current) {
          map.removeLayer(tempBufferRef.current)
          setTempBuffer(null)
          tempBufferRef.current = null
        }
        // Remove all circle layers
        if (tempCirclesRef.current && tempCirclesRef.current.length > 0) {
          tempCirclesRef.current.forEach(circle => {
            if (circle) map.removeLayer(circle)
          })
          tempCirclesRef.current = []
        }
        setPathPoints([])
        pathPointsRef.current = []
        map.getContainer().style.cursor = 'crosshair'
      }
    }
    
    map.on('mousedown', handleMouseDown)
    map.on('mousemove', handleMouseMove)
    map.on('mouseup', handleMouseUp)
    
    return () => {
      map.off('mousedown', handleMouseDown)
      map.off('mousemove', handleMouseMove)
      map.off('mouseup', handleMouseUp)
      map.dragging.enable() // Re-enable dragging when component unmounts
      map.getContainer().style.cursor = ''
      if (tempPath) {
        map.removeLayer(tempPath)
      }
      if (tempBuffer) {
        map.removeLayer(tempBuffer)
      }
      // Remove all circle layers
      if (tempCirclesRef.current && tempCirclesRef.current.length > 0) {
        tempCirclesRef.current.forEach(circle => {
          if (circle) map.removeLayer(circle)
        })
        tempCirclesRef.current = []
      }
      if (brushIndicatorRef.current) {
        map.removeLayer(brushIndicatorRef.current)
        brushIndicatorRef.current = null
        setBrushIndicator(null)
      }
    }
  }, [isDrawing, map, onDrawComplete, brushSize])
  
  // Separate effect to update brush indicator radius when brush size changes
  useEffect(() => {
    if (isDrawing && !isDragging && brushIndicatorRef.current) {
      // Just update the radius of existing circle
      const validBrushSize = brushSize && !isNaN(brushSize) && brushSize > 0 ? brushSize : 1000
      brushIndicatorRef.current.setRadius(validBrushSize)
    }
  }, [brushSize, isDrawing, isDragging])
  
  return null
}

// Component to render circles along a drawn path for smooth "worm" effect
function DrawnPathCircles({ path, radius }) {
  const map = useMap()
  const circlesRef = useRef([])
  
  useEffect(() => {
    if (!path || path.length < 1) return
    
    const validRadius = radius && !isNaN(radius) && radius > 0 ? radius : 1000
    const circles = []
    
    // Create circles at each point, with additional circles between points for smoothness
    for (let i = 0; i < path.length; i++) {
      const point = path[i]
      const circle = L.circle([point[0], point[1]], {
        radius: validRadius,
        fillColor: '#10b981',
        fillOpacity: 0.05,
        weight: 0
      })
      circle.addTo(map)
      circles.push(circle)
      
      // Add intermediate circles between points for smoother appearance
      if (i < path.length - 1) {
        const nextPoint = path[i + 1]
        const distance = L.latLng(point[0], point[1]).distanceTo([nextPoint[0], nextPoint[1]])
        // Increase spacing to reduce overlap - one circle every 0.8x brush radius (was 0.5x)
        const numIntermediate = Math.floor(distance / (validRadius * 0.8))
        
        for (let j = 1; j < numIntermediate; j++) {
          const t = j / numIntermediate
          const interLat = point[0] + (nextPoint[0] - point[0]) * t
          const interLng = point[1] + (nextPoint[1] - point[1]) * t
          const interCircle = L.circle([interLat, interLng], {
            radius: validRadius,
            fillColor: '#10b981',
            fillOpacity: 0.05,
            weight: 0
          })
          interCircle.addTo(map)
          circles.push(interCircle)
        }
      }
    }
    
    circlesRef.current = circles
    
    return () => {
      // Cleanup on unmount
      circles.forEach(circle => {
        if (circle) map.removeLayer(circle)
      })
      circlesRef.current = []
    }
  }, [path, radius, map])
  
  return null
}

// Helper function to create a buffer polygon around a path
function createBufferPolygon(path, bufferMeters) {
  if (!path || path.length < 2) return null
  
  // Simple buffer: create perpendicular offsets for each segment
  const bufferPoints = []
  
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]
    const p2 = path[i + 1]
    
    // Calculate bearing
    const dLng = (p2[1] - p1[1]) * Math.PI / 180
    const lat1 = p1[0] * Math.PI / 180
    const lat2 = p2[0] * Math.PI / 180
    
    const y = Math.sin(dLng) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
    const bearing = Math.atan2(y, x)
    
    // Perpendicular angle (90 degrees)
    const perpAngle1 = bearing + Math.PI / 2
    const perpAngle2 = bearing - Math.PI / 2
    
    // Calculate offset points
    const offset1 = calculateOffset(p1, perpAngle1, bufferMeters)
    const offset2 = calculateOffset(p1, perpAngle2, bufferMeters)
    
    if (i === 0) {
      bufferPoints.push(offset1, offset2)
    } else {
      bufferPoints.push(offset1)
    }
  }
  
  // Add points for last segment
  const lastIdx = path.length - 1
  const p1 = path[lastIdx - 1]
  const p2 = path[lastIdx]
  
  const dLng = (p2[1] - p1[1]) * Math.PI / 180
  const lat1 = p1[0] * Math.PI / 180
  const lat2 = p2[0] * Math.PI / 180
  
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  const bearing = Math.atan2(y, x)
  
  const perpAngle1 = bearing + Math.PI / 2
  const perpAngle2 = bearing - Math.PI / 2
  
  const offset1 = calculateOffset(p2, perpAngle1, bufferMeters)
  const offset2 = calculateOffset(p2, perpAngle2, bufferMeters)
  
  bufferPoints.push(offset1, offset2)
  
  // Close the polygon by reversing the first side
  const reversedFirst = [...bufferPoints.slice(0, 2)].reverse()
  return [...bufferPoints, ...reversedFirst]
}

// Helper to calculate offset point
function calculateOffset(point, bearing, distanceMeters) {
  const R = 6371000 // Earth radius in meters
  const lat1 = point[0] * Math.PI / 180
  const lng1 = point[1] * Math.PI / 180
  
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceMeters / R) +
    Math.cos(lat1) * Math.sin(distanceMeters / R) * Math.cos(bearing)
  )
  
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(distanceMeters / R) * Math.cos(lat1),
    Math.cos(distanceMeters / R) - Math.sin(lat1) * Math.sin(lat2)
  )
  
  return [lat2 * 180 / Math.PI, lng2 * 180 / Math.PI]
}

// Helper function to get surcharge field name for a fuel card
const getSurchargeField = (fuelCard) => {
  const surchargeMap = {
    'uk-fuels': 'uk_fuels_surcharge',
    'keyfuels': 'keyfuels_surcharge',
    'fastfuels': 'fastfuels_surcharge'
  }
  return surchargeMap[fuelCard] || null
}

// Helper function to get surcharge value for a fuel card
const getSurchargeForCard = (station, fuelCard) => {
  const surchargeField = getSurchargeField(fuelCard)
  if (!surchargeField) return null
  const surcharge = station[surchargeField]
  return surcharge ? String(surcharge).trim() : null
}

// Component to calculate ring radius based on zoom level
// Logo is 36px, rings should scale to be visible around it at all zoom levels
function RingRadiusCalculator({ logoSizePx = 36, children }) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  
  useEffect(() => {
    const updateZoom = () => setZoom(map.getZoom())
    map.on('zoomend', updateZoom)
    map.on('zoom', updateZoom)
    return () => {
      map.off('zoomend', updateZoom)
      map.off('zoom', updateZoom)
    }
  }, [map])
  
  // Calculate base radius: logo size * multiplier
  // At zoom 13 (typical default), we want rings to be ~4-5x logo size in meters
  // Scale inversely with zoom: higher zoom = smaller radius, lower zoom = larger radius
  const baseRadius = logoSizePx * 4 // Base radius in meters at zoom 13
  const zoomFactor = Math.pow(2, Math.max(0, 13 - zoom)) // Scale based on zoom
  const scaledRadius = baseRadius * zoomFactor
  
  return children(scaledRadius)
}

// Component to calculate ring radius based on zoom level and logo size
function useScaledRingRadius(logoSizePx = 36, baseMultiplier = 4) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  
  useEffect(() => {
    const updateZoom = () => setZoom(map.getZoom())
    map.on('zoomend', updateZoom)
    return () => {
      map.off('zoomend', updateZoom)
    }
  }, [map])
  
  // Calculate meters per pixel at current zoom level
  // At zoom level z, meters per pixel ≈ 156543.03392 * cos(lat) / 2^z
  // We'll use a simplified calculation: base radius scales inversely with zoom
  // Higher zoom = smaller radius needed, lower zoom = larger radius needed
  const baseRadius = logoSizePx * baseMultiplier // Base radius in meters
  const zoomFactor = Math.pow(2, 13 - zoom) // Normalize to zoom 13
  return baseRadius * zoomFactor
}

function MapView({ stations, userLocation, radiusMiles, selectedFuelCards = [], mustHaveStations = [], allStations = [], mustHaveFuelCards = null, onToggleMustHaveStation, onDrawAreaChange, comparisonView = null, onComparisonViewChange }) {
  const [showAllFuelCards, setShowAllFuelCards] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawnPaths, setDrawnPaths] = useState([]) // Array of { path: [[lat, lng], ...], bufferMeters: number }
  const [brushSize, setBrushSize] = useState(1000) // Buffer radius in meters, default 1km
  const [comparisonModal, setComparisonModal] = useState(null) // { selectedCard, comparisonCard }
  
  // Debug: Log selected fuel cards
  useEffect(() => {
    if (selectedFuelCards.length > 0) {
      console.log('Selected fuel cards:', selectedFuelCards)
    }
  }, [selectedFuelCards])
  // Cache icons by network to avoid recreating them
  // Note: When in comparison view, icons are created dynamically per station
  const iconCache = useMemo(() => {
    if (comparisonView) return null // Don't use cache in comparison view
    
    const cache = new Map()
    const networks = [...new Set(stations.map(s => s.network).filter(Boolean))]
    networks.forEach(network => {
      const logoPath = getLogoPath(network)
      cache.set(network, createLogoIcon(logoPath, null, 36))
    })
    // Add default icon for stations without network
    cache.set(null, createLogoIcon('/logos/GENERIC.png', null, 36))
    return cache
  }, [stations, comparisonView])

  // Calculate center of map - prioritize user location
  const center = useMemo(() => {
    if (userLocation && userLocation.lat && userLocation.lng) {
      return [userLocation.lat, userLocation.lng]
    }
    
    if (stations.length === 0) {
      return [51.5074, -0.1278] // Default to London
    }
    
    const avgLat = stations.reduce((sum, s) => sum + s.lat, 0) / stations.length
    const avgLng = stations.reduce((sum, s) => sum + s.lng, 0) / stations.length
    return [avgLat, avgLng]
  }, [stations, userLocation])

  // Calculate zoom level based on radius or stations
  const zoom = useMemo(() => {
    if (userLocation && radiusMiles) {
      // Zoom based on radius: 1 mile = zoom 13, 20 miles = zoom 10
      const zoomLevel = Math.max(10, 14 - Math.log2(radiusMiles))
      return Math.round(zoomLevel)
    }
    return stations.length === 1 ? 13 : 6
  }, [userLocation, radiusMiles, stations.length])

  // Calculate bounds for all stations
  const bounds = useMemo(() => {
    if (stations.length === 0) return null
    
    const lats = stations.map(s => s.lat)
    const lngs = stations.map(s => s.lng)
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    ]
  }, [stations])

  // Calculate percentage coverage for each fuel card
  const fuelCardCoverage = useMemo(() => {
    if (stations.length === 0) return []
    
    // If must-have stations are selected, only show cards accepted at all of them
    const cardsToShow = mustHaveFuelCards && mustHaveFuelCards.length > 0 
      ? mustHaveFuelCards 
      : getFuelCardNames(stations)
    
    const totalStations = stations.length
    
    return cardsToShow
      .map(card => {
        const acceptingStations = stations.filter(station => 
          stationAcceptsFuelCard(station, card)
        )
        const percentage = (acceptingStations.length / totalStations) * 100
        return {
          card,
          count: acceptingStations.length,
          total: totalStations,
          percentage: Math.round(percentage * 10) / 10 // Round to 1 decimal place
        }
      })
      .filter(item => item.count > 0) // Only show cards that have at least one station
      .sort((a, b) => b.percentage - a.percentage) // Sort by percentage descending
  }, [stations, mustHaveFuelCards])

  if (stations.length === 0) {
    return (
      <div className="map-container">
        <div className="map-placeholder">
          <h3>🗺️ Map View</h3>
          <p>No stations to display. Try adjusting your filters.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="map-container">
      {/* Comparison View Legend */}
      {comparisonView && (
        <div className="fuel-card-coverage-legend">
          <h4 className="legend-title">
            Comparison View
            <button 
              className="legend-close-btn"
              onClick={() => onComparisonViewChange && onComparisonViewChange(null)}
              title="Exit comparison view"
            >
              ×
            </button>
          </h4>
          <div className="comparison-legend-items">
            <div className="comparison-legend-item">
              <div className="comparison-legend-indicator selected-only"></div>
              <span className="comparison-legend-label">
                {formatFuelCardName(comparisonView.selectedCard)} Only
              </span>
            </div>
            <div className="comparison-legend-item">
              <div className="comparison-legend-indicator comparison-only"></div>
              <span className="comparison-legend-label">
                {formatFuelCardName(comparisonView.comparisonCard)} Only
              </span>
            </div>
            <div className="comparison-legend-item">
              <div className="comparison-legend-indicator both-cards"></div>
              <span className="comparison-legend-label">Both Cards</span>
            </div>
            <div className="comparison-legend-note">
              Stations not accepting either card are hidden
            </div>
          </div>
        </div>
      )}
      
      {/* Fuel Card Coverage Legend */}
      {!comparisonView && fuelCardCoverage.length > 0 && (
        <div className="fuel-card-coverage-legend">
          <h4 className="legend-title">
            Fuel Card Coverage
            {mustHaveFuelCards && mustHaveFuelCards.length > 0 && (
              <span className="legend-subtitle">(Accepted at all selected stations)</span>
            )}
          </h4>
          <div className="legend-stats">
            <div className="legend-stat-item">
              <span className="legend-stat-label">Total Stations:</span>
              <span className="legend-stat-value">{stations.length}</span>
            </div>
          </div>
          <div className="legend-list">
            {(showAllFuelCards ? fuelCardCoverage : fuelCardCoverage.slice(0, 6)).map(({ card, count, percentage }) => {
              const color = getFuelCardColor(card)
              const leadingCard = fuelCardCoverage.length > 0 ? fuelCardCoverage[0].card : null
              const isClickable = fuelCardCoverage.length > 1 && card !== leadingCard
              
              return (
                <div 
                  key={card} 
                  className={`legend-item ${isClickable ? 'clickable' : ''}`}
                  onClick={() => {
                    // Open modal comparing this card to the leading card
                    if (isClickable && leadingCard) {
                      setComparisonModal({ selectedCard: card, comparisonCard: leadingCard })
                    }
                  }}
                  style={{ cursor: isClickable ? 'pointer' : 'default' }}
                  title={isClickable ? `Click to see stations missing compared to ${formatFuelCardName(leadingCard)}` : ''}
                >
                  <div className="legend-item-header">
                    <div 
                      className="legend-color-indicator" 
                      style={{ backgroundColor: color }}
                    />
                    <span className="legend-card-name">{formatFuelCardName(card)}</span>
                    {isClickable && (
                      <span className="legend-click-hint">👆</span>
                    )}
                  </div>
                  <div className="legend-item-stats">
                    <span className="legend-percentage">{percentage}%</span>
                    <span className="legend-count">({count} stations)</span>
                  </div>
                  <div className="legend-bar-container">
                    <div 
                      className="legend-bar" 
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: color
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          {fuelCardCoverage.length > 6 && (
            <button 
              className="legend-expand-btn"
              onClick={() => setShowAllFuelCards(!showAllFuelCards)}
            >
              {showAllFuelCards ? 'Show Less' : `Show All (${fuelCardCoverage.length})`}
            </button>
          )}
        </div>
      )}
      
      {/* Comparison Modal */}
      {comparisonModal && (
        <ComparisonModal
          selectedCard={comparisonModal.selectedCard}
          comparisonCard={comparisonModal.comparisonCard}
          stations={stations}
          allStations={allStations}
          onClose={() => setComparisonModal(null)}
          onViewOnMap={(selectedCard, comparisonCard) => {
            setComparisonModal(null)
            if (onComparisonViewChange) {
              onComparisonViewChange({ selectedCard, comparisonCard })
            }
          }}
        />
      )}
      
      {/* Draw Button and Brush Controls */}
      <div className="map-draw-controls">
        <button
          className={`draw-btn ${isDrawing ? 'active' : ''}`}
          onClick={() => {
            setIsDrawing(!isDrawing)
            // When canceling, just exit drawing mode - don't clear drawn paths
            // User can still navigate and move the map
          }}
        >
          {isDrawing ? '✕ Cancel' : '✏️ Draw'}
        </button>
        {isDrawing && (
          <div className="brush-controls">
            <label className="brush-label">
              Brush Size: {(brushSize / 1000).toFixed(1)} km
            </label>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="brush-slider"
            />
            <div className="brush-size-buttons">
              <button
                className="brush-size-btn"
                onClick={() => setBrushSize(Math.max(100, brushSize - 500))}
              >
                −
              </button>
              <button
                className="brush-size-btn"
                onClick={() => setBrushSize(Math.min(5000, brushSize + 500))}
              >
                +
              </button>
            </div>
          </div>
        )}
        {drawnPaths && drawnPaths.length > 0 && (
          <button
            className="clear-draw-btn"
            onClick={() => {
              setDrawnPaths([])
              setIsDrawing(false)
              if (onDrawAreaChange) {
                onDrawAreaChange(null)
              }
            }}
          >
            Clear All Areas
          </button>
        )}
      </div>

      <MapContainer
        center={center}
        zoom={zoom}
        bounds={bounds && !userLocation ? bounds : undefined}
        boundsOptions={{ padding: [50, 50] }}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={!isDrawing}
      >
        <MapUpdater center={center} zoom={zoom} />
        <DrawingHandler 
          isDrawing={isDrawing}
          brushSize={brushSize}
          onDrawComplete={(path) => {
            // Add new path to the collection
            setDrawnPaths(prev => {
              const newPaths = [...prev, path]
              // Keep drawing mode active - don't call setIsDrawing(false)
              if (onDrawAreaChange) {
                // Send all paths including the new one
                onDrawAreaChange(newPaths.length > 0 ? newPaths : null)
              }
              return newPaths
            })
          }}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Drawn search areas - show as series of circles for smooth "worm" effect */}
        {drawnPaths && drawnPaths.length > 0 && drawnPaths.map((drawnPath, index) => (
          drawnPath.path && drawnPath.path.length > 0 && (
            <DrawnPathCircles key={`path-${index}`} path={drawnPath.path} radius={drawnPath.bufferMeters || 1000} />
          )
        ))}
        
        {/* User location marker and radius circle */}
        {userLocation && userLocation.lat && userLocation.lng && (
          <>
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={userLocationIcon}
            >
              <Popup>
                <div className="map-popup">
                  <h4 className="popup-title">📍 Your Location</h4>
                  <p>Searching within {radiusMiles || 10} mile{radiusMiles !== 1 ? 's' : ''}</p>
                </div>
              </Popup>
            </Marker>
            {radiusMiles && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={radiusMiles * 1609.34} // Convert miles to meters
                pathOptions={{
                  color: '#667eea',
                  fillColor: '#667eea',
                  fillOpacity: 0.1,
                  weight: 2
                }}
              />
            )}
          </>
        )}
        
        {stations.map((station, index) => {
          if (!station.lat || !station.lng) return null
          
          // Find the actual index in the allStations array
          const stationIndex = allStations.findIndex(s => 
            s.name === station.name && 
            s.lat === station.lat && 
            s.lng === station.lng
          )
          const actualIndex = stationIndex !== -1 ? stationIndex : index
          const isMustHave = mustHaveStations.includes(actualIndex)
          
          const fuelCardNames = getFuelCardNames([station])
          const acceptedFuelCards = fuelCardNames.filter(card => 
            stationAcceptsFuelCard(station, card)
          )
          
          // Get which selected fuel cards this station accepts
          const matchingSelectedCards = selectedFuelCards.length > 0
            ? selectedFuelCards.filter(card => stationAcceptsFuelCard(station, card))
            : []
          
          // Determine comparison status if in comparison view
          let comparisonStatus = null
          if (comparisonView) {
            const acceptsSelected = stationAcceptsFuelCard(station, comparisonView.selectedCard)
            const acceptsComparison = stationAcceptsFuelCard(station, comparisonView.comparisonCard)
            
            // Skip stations that don't accept either card
            if (!acceptsSelected && !acceptsComparison) {
              return null
            }
            
            if (acceptsSelected && acceptsComparison) {
              comparisonStatus = 'both' // Higher opacity
            } else if (acceptsSelected && !acceptsComparison) {
              comparisonStatus = 'selected-only' // Green indicator
            } else if (!acceptsSelected && acceptsComparison) {
              comparisonStatus = 'comparison-only' // Blue indicator
            }
          }
          
          // Get icon - use cache if not in comparison view, otherwise create dynamically
          const stationIcon = comparisonView
            ? createLogoIcon(getLogoPath(station.network), comparisonStatus, 36)
            : (iconCache?.get(station.network) || iconCache?.get(null) || createLogoIcon(getLogoPath(station.network), null, 36))
          
          // Create rings or dots based on number of matches
          const showRings = matchingSelectedCards.length > 0 && matchingSelectedCards.length <= 3
          const showDots = matchingSelectedCards.length > 3
          
          // Debug: Log first few stations with matches
          if (index < 3 && matchingSelectedCards.length > 0) {
            console.log(`Station ${station.name}: ${matchingSelectedCards.length} matching cards`, {
              showRings,
              showDots,
              cards: matchingSelectedCards
            })
          }
          
          // Use a unique key for the fragment - combine lat/lng for uniqueness
          const stationKey = `station-${station.lat}-${station.lng}-${index}`
          
          return (
            <React.Fragment key={stationKey}>
              {/* Station marker */}
              <Marker
                position={[station.lat, station.lng]}
                icon={stationIcon}
              >
              <Popup>
                <div className="map-popup">
                  <div className="popup-header-with-checkbox">
                    <label 
                      className="popup-must-have-checkbox-label"
                      title={isMustHave ? "Remove from Must have station list" : "Add to Must have station list"}
                    >
                      <input
                        type="checkbox"
                        checked={isMustHave}
                        onChange={() => {
                          if (onToggleMustHaveStation) {
                            onToggleMustHaveStation(actualIndex)
                          }
                        }}
                        className="popup-must-have-checkbox"
                        onClick={(e) => e.stopPropagation()}
                        title={isMustHave ? "Remove from Must have station list" : "Add to Must have station list"}
                      />
                      <h4 className="popup-title">{station.name || 'Unnamed Station'}</h4>
                    </label>
                  </div>
                  <p className="popup-address">{getFullAddress(station)}</p>
                  {station.distance !== undefined && (
                    <p className="popup-distance">📍 {station.distance.toFixed(1)} miles away</p>
                  )}
                  {acceptedFuelCards.length > 0 && (
                    <div className="popup-fuel-cards">
                      <strong>Fuel Cards:</strong>
                      <div className="popup-tags">
                        {acceptedFuelCards.map((card) => {
                          const surcharge = getSurchargeForCard(station, card)
                          return (
                            <span key={card} className="popup-tag">
                              {formatFuelCardName(card)}
                              {surcharge && (
                                <span className="popup-surcharge-inline">
                                  {' '}(Surcharge: {surcharge})
                                </span>
                              )}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {(station['24-7'] || station.hgv) && (
                    <div className="popup-features">
                      {station['24-7'] && (
                        <div className="popup-badge">24/7 Available</div>
                      )}
                      {station.hgv && (
                        <div className="popup-badge">HGV</div>
                      )}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
            
            {/* Colored rings for 3 or fewer matches - scale with zoom */}
            {showRings && (
              <RingRadiusCalculator>
                {(baseRadius) => matchingSelectedCards.map((card, cardIndex) => {
                  const color = getFuelCardColor(card)
                  // Stagger rings: each ring is progressively larger
                  const radius = baseRadius + (cardIndex * (baseRadius * 0.3))
                  return (
                    <Circle
                      key={`ring-${index}-${card}`}
                      center={[station.lat, station.lng]}
                      radius={radius}
                      pathOptions={{
                        color: color,
                        fillColor: 'transparent',
                        fillOpacity: 0,
                        weight: 6,
                        opacity: 0.9,
                        dashArray: cardIndex > 0 ? '10, 5' : undefined // Dashed for outer rings
                      }}
                    />
                  )
                })}
              </RingRadiusCalculator>
            )}
            
            {/* Dots in circle pattern for more than 3 matches - scale with zoom */}
            {showDots && (
              <RingRadiusCalculator>
                {(baseRadius) => {
                  const dotCount = matchingSelectedCards.length
                  // Position dots at ~1.3x base radius from center
                  const radiusMeters = baseRadius * 1.3
                  const angleStep = (2 * Math.PI) / dotCount
                  
                  return matchingSelectedCards.map((card, dotIndex) => {
                    const angle = dotIndex * angleStep - (Math.PI / 2) // Start from top
                    // Convert angle and radius to lat/lng offset
                    // Approximate: 1 degree lat ≈ 111km, 1 degree lng ≈ 111km * cos(lat)
                    const latOffset = (radiusMeters / 111000) * Math.cos(angle)
                    const lngOffset = (radiusMeters / (111000 * Math.cos(station.lat * Math.PI / 180))) * Math.sin(angle)
                    const dotLat = station.lat + latOffset
                    const dotLng = station.lng + lngOffset
                    const color = getFuelCardColor(card)
                    
                    return (
                      <CircleMarker
                        key={`dot-${index}-${card}`}
                        center={[dotLat, dotLng]}
                        radius={12}
                        pathOptions={{
                          color: '#ffffff',
                          fillColor: color,
                          fillOpacity: 1,
                          weight: 3
                        }}
                      />
                    )
                  })
                }}
              </RingRadiusCalculator>
            )}
          </React.Fragment>
        )
      })}
      </MapContainer>
    </div>
  )
}

// Modal component to show stations missing when comparing two fuel cards
function ComparisonModal({ selectedCard, comparisonCard: initialComparisonCard, stations, allStations, onClose, onViewOnMap }) {
  const [comparisonCard, setComparisonCard] = useState(initialComparisonCard)
  
  // Get all available fuel cards from stations
  const availableCards = useMemo(() => {
    return getFuelCardNames(allStations || stations).filter(card => card !== selectedCard)
  }, [allStations, stations, selectedCard])
  
  // Calculate missing stations: stations that accept comparisonCard but not selectedCard
  const missingStations = useMemo(() => {
    if (!selectedCard || !comparisonCard || !stations) return []
    
    return stations.filter(station => {
      const acceptsComparison = stationAcceptsFuelCard(station, comparisonCard)
      const acceptsSelected = stationAcceptsFuelCard(station, selectedCard)
      // Station is missing if it accepts comparison card but not selected card
      return acceptsComparison && !acceptsSelected
    })
  }, [selectedCard, comparisonCard, stations])
  
  // Calculate coverage statistics
  const coverageStats = useMemo(() => {
    if (!selectedCard || !comparisonCard || !stations) return null
    
    let bothCards = 0
    let selectedOnly = 0
    let comparisonOnly = 0
    
    stations.forEach(station => {
      const acceptsSelected = stationAcceptsFuelCard(station, selectedCard)
      const acceptsComparison = stationAcceptsFuelCard(station, comparisonCard)
      
      if (acceptsSelected && acceptsComparison) {
        bothCards++
      } else if (acceptsSelected && !acceptsComparison) {
        selectedOnly++
      } else if (!acceptsSelected && acceptsComparison) {
        comparisonOnly++
      }
    })
    
    return { bothCards, selectedOnly, comparisonOnly }
  }, [selectedCard, comparisonCard, stations])
  
  return (
    <div className="comparison-modal-overlay" onClick={onClose}>
      <div className="comparison-modal" onClick={(e) => e.stopPropagation()}>
        <div className="comparison-modal-header">
          <h3 className="comparison-modal-title">
            Stations Missing {formatFuelCardName(selectedCard)}
          </h3>
          <button className="comparison-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="comparison-modal-subtitle">
          <label className="comparison-select-label">
            Compare to:{' '}
            <select 
              className="comparison-select"
              value={comparisonCard}
              onChange={(e) => setComparisonCard(e.target.value)}
            >
              {availableCards.map(card => (
                <option key={card} value={card}>
                  {formatFuelCardName(card)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="comparison-modal-content">
          {/* Coverage Statistics */}
          {coverageStats && (
            <div className="comparison-stats-grid">
              <div className="comparison-stat-card both-cards">
                <div className="stat-value">{coverageStats.bothCards}</div>
                <div className="stat-label">Both Cards</div>
              </div>
              <div className="comparison-stat-card selected-only">
                <div className="stat-value">{coverageStats.selectedOnly}</div>
                <div className="stat-label">{formatFuelCardName(selectedCard)} Only</div>
              </div>
              <div className="comparison-stat-card comparison-only">
                <div className="stat-value">{coverageStats.comparisonOnly}</div>
                <div className="stat-label">{formatFuelCardName(comparisonCard)} Only</div>
              </div>
            </div>
          )}
          
          {/* View on Map Button */}
          <button 
            className="view-on-map-btn"
            onClick={() => onViewOnMap && onViewOnMap(selectedCard, comparisonCard)}
          >
            <svg className="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            View Coverage on Map
          </button>
          
          {missingStations.length === 0 ? (
            <p className="comparison-modal-empty">
              All stations that accept {formatFuelCardName(comparisonCard)} also accept {formatFuelCardName(selectedCard)}.
            </p>
          ) : (
            <>
              <div className="comparison-modal-count">
                <strong>{missingStations.length}</strong> station{missingStations.length !== 1 ? 's' : ''} missing on {formatFuelCardName(selectedCard)}
              </div>
              <div className="comparison-modal-stations">
                {missingStations.map((station, index) => (
                  <div key={index} className="comparison-station-item">
                    <div className="comparison-station-name">{station.name || 'Unnamed Station'}</div>
                    <div className="comparison-station-address">{getFullAddress(station)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default MapView
