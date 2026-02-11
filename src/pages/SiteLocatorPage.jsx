import React, { useState, useEffect, useMemo } from 'react'
import L from 'leaflet'
import StationCard from '../components/StationCard'
import MapView from '../components/MapView'
import stationsData from '../stations_data.json'
import defaultReportAnswers from '../../default_report_answers.json'
import companyDetails from '../../company-details.json'
import { 
  getFuelCardNames, 
  filterStationsByFuelCards, 
  filterStationsBySearch, 
  filterStationsByRadius,
  filterStationsByFeature,
  filterStationsBySurcharge,
  getSurchargeValues,
  getFuelCardsForMustHaveStations,
  filterStationsByPath,
  formatFuelCardName,
  stationAcceptsFuelCard
} from '../utils/dataProcessor'
import { getFuelCardColor } from '../utils/fuelCardColors'
import { searchLocation } from '../utils/geocoding'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
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
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false)
  const [radiusMiles, setRadiusMiles] = useState(10)
  const [filterHGV, setFilterHGV] = useState(false)
  const [filter24_7, setFilter24_7] = useState(false)
  const [selectedUKFuelsSurcharge, setSelectedUKFuelsSurcharge] = useState([])
  const [selectedKeyFuelsSurcharge, setSelectedKeyFuelsSurcharge] = useState([])
  const [selectedFastFuelsSurcharge, setSelectedFastFuelsSurcharge] = useState([])
  const [selectedShellCRTSurcharge, setSelectedShellCRTSurcharge] = useState([])
  const [searchedLocation, setSearchedLocation] = useState(null)
  const [locationSearchTerm, setLocationSearchTerm] = useState('')
  const [locationSearchResults, setLocationSearchResults] = useState([])
  const [locationSearchLoading, setLocationSearchLoading] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState({
    radius: false,
    search: true,
    features: true,
    fuelCards: true,
    surcharges: true,
    mustHave: true
  })
  const [showLocationMessage, setShowLocationMessage] = useState(false)
  const [mustHaveStations, setMustHaveStations] = useState([]) // Array of station indices
  const [openModal, setOpenModal] = useState(null) // 'features', 'fuelCards', 'surcharges', 'mustHave', or null
  const [activeSurchargeTab, setActiveSurchargeTab] = useState('ukFuels') // 'ukFuels', 'keyFuels', 'fastFuels'
  const [drawnArea, setDrawnArea] = useState(null) // { center: [lat, lng], radius: meters }
  const [comparisonView, setComparisonView] = useState(null) // { selectedCard, comparisonCard }
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportData, setReportData] = useState({
    companyName: '',
    introduction: defaultReportAnswers.introduction || '',
    notes: {
      features: '',
      fuelCards: '',
      surcharges: '',
      mustHaveStations: ''
    }
  })
  const [mainMapCenter, setMainMapCenter] = useState(null)
  const [mainMapZoom, setMainMapZoom] = useState(null)
  const [isSelectingRectangle, setIsSelectingRectangle] = useState(false)
  const [mapSelections, setMapSelections] = useState([]) // Array of { id, bounds, screenshot, notes }
  const [reportComparisons, setReportComparisons] = useState([]) // Array of { selectedCard, comparisonCard, missingStations, stats }
  
  // Collapsible sections state - only Search Location and Search Radius open by default
  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Load and clean station data - but don't set loading to false yet
  useEffect(() => {
    const cleanedStations = stationsData
      .filter(station => station.lat && station.lng && station.name)
      .map(station => ({
        ...station,
        lat: parseFloat(station.lat),
        lng: parseFloat(station.lng)
      }))
    
    setStations(cleanedStations)
    // Don't set loading to false here - wait for location or postcode
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
          setLocationPermissionDenied(false)
          // Show location message for 2 seconds
          setShowLocationMessage(true)
          setTimeout(() => {
            setShowLocationMessage(false)
          }, 2000)
        },
        (error) => {
          setLocationError('Unable to get your location')
          setLocationLoading(false)
          setLocationPermissionDenied(true)
          console.error('Geolocation error:', error)
        }
      )
    } else {
      setLocationError('Geolocation is not supported by your browser')
      setLocationPermissionDenied(true)
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
    if (!location) {
      setSearchedLocation(null)
      setLocationSearchTerm('')
      setLocationSearchResults([])
      return
    }
    setSearchedLocation({
      lat: parseFloat(location.lat),
      lng: parseFloat(location.lon),
      displayName: location.display_name
    })
    setLocationSearchTerm(location.display_name)
    setLocationSearchResults([])
  }

  // Load stations when we have a location (user location or searched location)
  // Also allow UI to show if location permission is denied (so user can enter postcode)
  useEffect(() => {
    if (loading && (userLocation || searchedLocation || (locationPermissionDenied && !locationLoading))) {
      setLoading(false)
    }
  }, [userLocation, searchedLocation, locationPermissionDenied, locationLoading, loading])

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && openModal) {
        setOpenModal(null)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [openModal])

  // Get fuel card names
  const fuelCardNames = useMemo(() => getFuelCardNames(stations), [stations])

  // Get available surcharge values
  const ukFuelsSurcharges = useMemo(() => getSurchargeValues(stations, 'uk_fuels_surcharge'), [stations])
  const keyFuelsSurcharges = useMemo(() => getSurchargeValues(stations, 'keyfuels_surcharge'), [stations])
  const fastFuelsSurcharges = useMemo(() => getSurchargeValues(stations, 'fastfuels_surcharge'), [stations])
  const shellCRTSurcharges = useMemo(() => getSurchargeValues(stations, 'shell_crt_core_non_core'), [stations])

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
      'fastfuels_surcharge': setSelectedFastFuelsSurcharge,
      'shell_crt_core_non_core': setSelectedShellCRTSurcharge
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

  const handleSelectAllSurcharges = (surchargeType, values) => {
    const setters = {
      'uk_fuels_surcharge': setSelectedUKFuelsSurcharge,
      'keyfuels_surcharge': setSelectedKeyFuelsSurcharge,
      'fastfuels_surcharge': setSelectedFastFuelsSurcharge,
      'shell_crt_core_non_core': setSelectedShellCRTSurcharge
    }
    
    const setter = setters[surchargeType]
    if (setter && values.length > 0) {
      setter(prev => {
        // If all are selected, deselect all. Otherwise, select all.
        const allSelected = values.every(v => prev.includes(v))
        return allSelected ? [] : [...new Set([...prev, ...values])]
      })
    }
  }

  // Reset active tab when modal opens
  useEffect(() => {
    if (openModal === 'surcharges') {
      // Set active tab to first available surcharge type
      if (ukFuelsSurcharges.length > 0) {
        setActiveSurchargeTab('ukFuels')
      } else if (keyFuelsSurcharges.length > 0) {
        setActiveSurchargeTab('keyFuels')
      } else if (fastFuelsSurcharges.length > 0) {
        setActiveSurchargeTab('fastFuels')
      } else if (shellCRTSurcharges.length > 0) {
        setActiveSurchargeTab('shellCRT')
      }
    }
  }, [openModal, ukFuelsSurcharges.length, keyFuelsSurcharges.length, fastFuelsSurcharges.length, shellCRTSurcharges.length])

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

  // Calculate active filter counts
  const activeFilters = useMemo(() => {
    const filters = {
      features: (filterHGV ? 1 : 0) + (filter24_7 ? 1 : 0),
      fuelCards: selectedFuelCards.length,
      surcharges: selectedUKFuelsSurcharge.length + 
                  selectedKeyFuelsSurcharge.length + 
                  selectedFastFuelsSurcharge.length + 
                  selectedShellCRTSurcharge.length,
      mustHave: mustHaveStations.length,
      search: searchTerm.trim().length > 0 ? 1 : 0
    }
    return filters
  }, [filterHGV, filter24_7, selectedFuelCards, selectedUKFuelsSurcharge, selectedKeyFuelsSurcharge, selectedFastFuelsSurcharge, selectedShellCRTSurcharge, mustHaveStations, searchTerm])

  const filteredStations = useMemo(() => {
    // Don't show any stations until we have a location (user location, searched location, or drawn area)
    const hasLocation = userLocation || searchedLocation || (drawnArea && ((Array.isArray(drawnArea) && drawnArea.length > 0) || (drawnArea.path && drawnArea.path.length >= 2)))
    
    if (!hasLocation) {
      return []
    }
    
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
      } else {
        // No location and no drawn area - return empty
        return []
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
    
    if (selectedShellCRTSurcharge.length > 0) {
      filtered = filterStationsBySurcharge(filtered, 'shell_crt_core_non_core', selectedShellCRTSurcharge)
    }
    
    // Limit to 100 stations
    return filtered.slice(0, 100)
  }, [stations, selectedFuelCards, searchTerm, userLocation, searchedLocation, radiusMiles, filterHGV, filter24_7, selectedUKFuelsSurcharge, selectedKeyFuelsSurcharge, selectedFastFuelsSurcharge, selectedShellCRTSurcharge, mustHaveFuelCards, drawnArea])

  // Calculate top 5 fuel cards by coverage
  const topFuelCardsByCoverage = useMemo(() => {
    const allFuelCards = getFuelCardNames(filteredStations)
    const coverage = allFuelCards.map(card => {
      const count = filteredStations.filter(station => 
        stationAcceptsFuelCard(station, card)
      ).length
      return { card, count, percentage: filteredStations.length > 0 ? (count / filteredStations.length * 100).toFixed(1) : 0 }
    })
    return coverage
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [filteredStations])

  // Helper function to convert hex color to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 107, g: 114, b: 128 } // Default gray
  }

  // Generate PDF Report
  const generatePDFReport = async () => {
    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPosition = 20
    const margin = 20
    const lineHeight = 7
    const sectionSpacing = 10

    let pageNumber = 1

    // Helper function to add page header
    const addPageHeader = (doc, pageWidth, pageHeight, margin, pageNum) => {
      // Header background
      doc.setFillColor(8, 75, 131) // #084B83
      doc.rect(0, 0, pageWidth, 30, 'F')
      
      // Company name in header
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(companyDetails.company_name || 'Fleetmaxx Solutions', margin, 15)
      
      // Report title in header
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text('Fuel Card Suitability Report', pageWidth - margin - doc.getTextWidth('Fuel Card Suitability Report'), 15)
      
    }

    // Helper function to add page footer
    const addPageFooter = (doc, pageWidth, pageHeight, margin, pageNum) => {
      // Footer line
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25)
      
      // Company contact info in footer
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      const address = `${companyDetails.company_address || ''}, ${companyDetails.company_city || ''}, ${companyDetails.company_postcode || ''}`
      const contact = `${companyDetails.company_phone || ''} | ${companyDetails.company_email || ''}`
      doc.text(address, margin, pageHeight - 18)
      if (companyDetails.company_website) {
        doc.text(companyDetails.company_website, pageWidth - margin - doc.getTextWidth(companyDetails.company_website), pageHeight - 18)
      }
      
      // Employee details in footer
      if (companyDetails.company_employees_details) {
        const employee = companyDetails.company_employees_details
        const employeeInfo = `${employee.name || ''}${employee.email ? ` | ${employee.email}` : ''}${employee.phone ? ` | ${employee.phone}` : ''}`
        if (employeeInfo.trim() !== '|') {
          doc.setFontSize(8)
          doc.setTextColor(100, 100, 100)
          doc.text(employeeInfo, margin, pageHeight - 10)
        }
      }
      
      // Page number
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text(`Page ${pageNum}`, pageWidth - margin - 10, pageHeight - 10)
    }

    // Helper function to add a new page if needed
    const checkPageBreak = (requiredSpace) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        // Add footer to current page
        addPageFooter(doc, pageWidth, pageHeight, margin, pageNumber)
        doc.addPage()
        pageNumber++
        yPosition = 20
        // Add header to new page
        addPageHeader(doc, pageWidth, pageHeight, margin, pageNumber)
      }
    }

    // Add header to first page
    addPageHeader(doc, pageWidth, pageHeight, margin, pageNumber)

    // Map screenshots are already captured in mapSelections, no need to capture here

    // Title section with logo area
    yPosition = 40 // Start below header
    
    // Try to add company logo
    if (companyDetails.company_logo) {
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = companyDetails.company_logo
        })
        
        // Add logo (max 20mm height)
        const logoHeight = 20
        const logoWidth = (img.width / img.height) * logoHeight
        doc.addImage(img, 'PNG', margin, yPosition, logoWidth, logoHeight)
        yPosition += logoHeight + lineHeight
      } catch (error) {
        console.error('Error loading company logo:', error)
        // Continue without logo
      }
    }
    
    // Main title
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(26, 32, 44) // #1a202c
    doc.text('Fuel Card Suitability Report', margin, yPosition)
    yPosition += lineHeight * 2
    
    // Date
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    const reportDate = new Date().toLocaleDateString('en-GB', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    doc.text(`Generated: ${reportDate}`, margin, yPosition)
    yPosition += lineHeight * 1.5
    
    // Add a decorative line
    doc.setDrawColor(102, 126, 234)
    doc.setLineWidth(0.5)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += lineHeight * 1.5

    // Company Name with styling
    if (reportData.companyName) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(26, 32, 44) // #1a202c
      doc.text('Company:', margin, yPosition)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(27, 34, 33) // #1B2221
      doc.text(reportData.companyName, margin + 30, yPosition)
      yPosition += lineHeight * 1.5
    }

    // Introduction with styling
    if (reportData.introduction) {
      checkPageBreak(lineHeight * 4)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(26, 32, 44) // #1a202c
      doc.text('Introduction', margin, yPosition)
      yPosition += lineHeight * 1.2
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(27, 34, 33) // #1B2221
      const introLines = doc.splitTextToSize(reportData.introduction, pageWidth - 2 * margin)
      doc.text(introLines, margin, yPosition)
      yPosition += introLines.length * lineHeight + sectionSpacing
    }

    // Map View Screenshots
    if (mapSelections.length > 0) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Map Views', margin, yPosition)
      yPosition += lineHeight * 1.5
      
      mapSelections.forEach((selection, index) => {
        checkPageBreak(100) // Space for map image
        if (index > 0) {
          yPosition += lineHeight // Add spacing between views
        }
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(`Map View ${index + 1}`, margin, yPosition)
        yPosition += lineHeight
        
        // Add map image
        if (selection.screenshot) {
          try {
            // Calculate image dimensions maintaining aspect ratio
            const maxImgWidth = pageWidth - 2 * margin
            // Assume a reasonable aspect ratio for map screenshots (16:9 or similar)
            const imgWidth = maxImgWidth
            const imgHeight = imgWidth * 0.6 // Approximate aspect ratio
            
            // Ensure image doesn't exceed page height
            const maxImgHeight = pageHeight - yPosition - margin - lineHeight * 5
            let finalImgWidth = imgWidth
            let finalImgHeight = imgHeight
            if (imgHeight > maxImgHeight) {
              finalImgHeight = maxImgHeight
              finalImgWidth = finalImgHeight / 0.6
            }
            
            doc.addImage(selection.screenshot, 'PNG', margin, yPosition, finalImgWidth, finalImgHeight)
            yPosition += finalImgHeight + lineHeight
          } catch (error) {
            console.error('Error adding map image to PDF:', error)
          }
        }
        
        // Add notes if any
        if (selection.notes) {
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(9)
          doc.text('Notes:', margin, yPosition)
          yPosition += lineHeight
          doc.setFont('helvetica', 'normal')
          const noteLines = doc.splitTextToSize(selection.notes, pageWidth - 2 * margin)
          doc.text(noteLines, margin, yPosition)
          yPosition += noteLines.length * lineHeight
        }
        
        yPosition += sectionSpacing
      })
    }

    // Summary Statistics with styling
    checkPageBreak(lineHeight * 5)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(26, 32, 44) // #1a202c
    doc.text('Summary', margin, yPosition)
    yPosition += lineHeight * 1.2
    
    // Add background box for summary
    const summaryBoxHeight = lineHeight * (2 + (userLocation || searchedLocation ? 1 : 0) + (radiusMiles ? 1 : 0)) + 4
    doc.setFillColor(240, 246, 246) // #F0F6F6
    doc.setDrawColor(226, 232, 240) // #e2e8f0
    doc.roundedRect(margin, yPosition - 2, pageWidth - 2 * margin, summaryBoxHeight, 2, 2, 'FD')
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(45, 55, 72) // #2d3748
    doc.text(`Total Stations Found: ${filteredStations.length}`, margin + 3, yPosition + 2)
    yPosition += lineHeight
    if (userLocation || searchedLocation) {
      const location = userLocation || searchedLocation
      doc.text(`Search Location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`, margin + 3, yPosition + 2)
      yPosition += lineHeight
    }
    if (radiusMiles) {
      doc.text(`Search Radius: ${radiusMiles} miles`, margin + 3, yPosition + 2)
      yPosition += lineHeight
    }
    yPosition += sectionSpacing + 2

    // Must Have Stations with styling
    if (mustHaveStations.length > 0) {
      checkPageBreak(lineHeight * (mustHaveStations.length + 3))
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(26, 32, 44) // #1a202c
      doc.text(`Must Have Stations (${mustHaveStations.length})`, margin, yPosition)
      yPosition += lineHeight * 1.2
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(27, 34, 33) // #1B2221
      mustHaveStations.forEach((stationIndex) => {
        const station = stations[stationIndex]
        if (station) {
          checkPageBreak(lineHeight * 2)
          doc.text(`${station.name || 'Unnamed Station'}`, margin + 5, yPosition)
          yPosition += lineHeight * 0.7
          const address = station.address || station.city || station.postcode || ''
          if (address) {
            doc.text(address, margin + 5, yPosition)
            yPosition += lineHeight
          } else {
            yPosition += lineHeight * 0.3
          }
        }
      })
      if (reportData.notes.mustHaveStations) {
        checkPageBreak(lineHeight * 3)
        yPosition += lineHeight * 0.5
        doc.setFont('helvetica', 'italic')
        doc.text('Notes:', margin + 5, yPosition)
        yPosition += lineHeight
        doc.setFont('helvetica', 'normal')
        const noteLines = doc.splitTextToSize(reportData.notes.mustHaveStations, pageWidth - 2 * margin - 10)
        doc.text(noteLines, margin + 5, yPosition)
        yPosition += noteLines.length * lineHeight
      }
      yPosition += sectionSpacing
    }

    // Feature Requirements with styling
    if (filterHGV || filter24_7) {
      checkPageBreak(lineHeight * 5)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(26, 32, 44) // #1a202c
      doc.text('Feature Requirements', margin, yPosition)
      yPosition += lineHeight * 1.2
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(27, 34, 33) // #1B2221
      if (filterHGV) {
        doc.text('✓ HGV Access', margin + 5, yPosition)
        yPosition += lineHeight
      }
      if (filter24_7) {
        doc.text('✓ 24/7 Access', margin + 5, yPosition)
        yPosition += lineHeight
      }
      if (reportData.notes.features) {
        yPosition += lineHeight * 0.5
        doc.setFont('helvetica', 'italic')
        doc.text('Notes:', margin + 5, yPosition)
        yPosition += lineHeight
        doc.setFont('helvetica', 'normal')
        const noteLines = doc.splitTextToSize(reportData.notes.features, pageWidth - 2 * margin - 10)
        doc.text(noteLines, margin + 5, yPosition)
        yPosition += noteLines.length * lineHeight
      }
      yPosition += sectionSpacing
    }

    // Fuel Card Filters with styling
    if (selectedFuelCards.length > 0) {
      checkPageBreak(lineHeight * (selectedFuelCards.length + 3))
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(26, 32, 44) // #1a202c
      doc.text(`Fuel Card Filters (${selectedFuelCards.length})`, margin, yPosition)
      yPosition += lineHeight * 1.2
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(27, 34, 33) // #1B2221
      selectedFuelCards.forEach(card => {
        doc.text(`• ${formatFuelCardName(card)}`, margin + 5, yPosition)
        yPosition += lineHeight
      })
      if (reportData.notes.fuelCards) {
        yPosition += lineHeight * 0.5
        doc.setFont('helvetica', 'italic')
        doc.text('Notes:', margin + 5, yPosition)
        yPosition += lineHeight
        doc.setFont('helvetica', 'normal')
        const noteLines = doc.splitTextToSize(reportData.notes.fuelCards, pageWidth - 2 * margin - 10)
        doc.text(noteLines, margin + 5, yPosition)
        yPosition += noteLines.length * lineHeight
      }
      yPosition += sectionSpacing
    }

    // Surcharges with styling
    const totalSurcharges = selectedUKFuelsSurcharge.length + selectedKeyFuelsSurcharge.length + 
                           selectedFastFuelsSurcharge.length + selectedShellCRTSurcharge.length
    if (totalSurcharges > 0) {
      checkPageBreak(lineHeight * (totalSurcharges + 5))
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(26, 32, 44) // #1a202c
      doc.text('Surcharges', margin, yPosition)
      yPosition += lineHeight * 1.2
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(27, 34, 33) // #1B2221
      if (selectedUKFuelsSurcharge.length > 0) {
        doc.text(`UK Fuels: ${selectedUKFuelsSurcharge.join(', ')}`, margin + 5, yPosition)
        yPosition += lineHeight
      }
      if (selectedKeyFuelsSurcharge.length > 0) {
        doc.text(`KeyFuels: ${selectedKeyFuelsSurcharge.join(', ')}`, margin + 5, yPosition)
        yPosition += lineHeight
      }
      if (selectedFastFuelsSurcharge.length > 0) {
        doc.text(`FastFuels: ${selectedFastFuelsSurcharge.join(', ')}`, margin + 5, yPosition)
        yPosition += lineHeight
      }
      if (selectedShellCRTSurcharge.length > 0) {
        doc.text(`Shell Surcharge: ${selectedShellCRTSurcharge.join(', ')}`, margin + 5, yPosition)
        yPosition += lineHeight
      }
      if (reportData.notes.surcharges) {
        yPosition += lineHeight * 0.5
        doc.setFont('helvetica', 'italic')
        doc.text('Notes:', margin + 5, yPosition)
        yPosition += lineHeight
        doc.setFont('helvetica', 'normal')
        const noteLines = doc.splitTextToSize(reportData.notes.surcharges, pageWidth - 2 * margin - 10)
        doc.text(noteLines, margin + 5, yPosition)
        yPosition += noteLines.length * lineHeight
      }
      yPosition += sectionSpacing
    }

    // Top 5 Fuel Cards by Coverage with Bar Chart
    if (topFuelCardsByCoverage.length > 0) {
      checkPageBreak(80) // Space for chart
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(26, 32, 44) // #1a202c
      doc.text('Top 5 Fuel Cards by Coverage', margin, yPosition)
      yPosition += lineHeight * 1.5
      
      // Create bar chart
      const chartWidth = pageWidth - 2 * margin
      const chartHeight = 60
      const chartX = margin
      const chartY = yPosition
      const barSpacing = 8
      const barHeight = (chartHeight - (topFuelCardsByCoverage.length - 1) * barSpacing) / topFuelCardsByCoverage.length
      const maxCount = Math.max(...topFuelCardsByCoverage.map(c => c.count))
      
      // Draw chart background
      doc.setDrawColor(230, 230, 230)
      doc.setFillColor(250, 250, 250)
      doc.roundedRect(chartX, chartY, chartWidth, chartHeight, 2, 2, 'FD')
      
      // Draw bars
      topFuelCardsByCoverage.forEach(({ card, count, percentage }, index) => {
        const barY = chartY + index * (barHeight + barSpacing) + 4
        const barWidth = maxCount > 0 ? (count / maxCount * (chartWidth - 40)) : 0
        const color = getFuelCardColor(card)
        
        // Convert hex color to RGB
        const rgb = hexToRgb(color)
        const r = rgb.r
        const g = rgb.g
        const b = rgb.b
        
        // Draw bar
        doc.setFillColor(r, g, b)
        doc.setDrawColor(r, g, b)
        doc.roundedRect(chartX + 35, barY, barWidth, barHeight - 2, 2, 2, 'FD')
        
        // Draw label
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(50, 50, 50)
        const labelY = barY + barHeight / 2 - 2
        doc.text(`${index + 1}.`, chartX + 5, labelY)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        const cardName = formatFuelCardName(card)
        const nameWidth = doc.getTextWidth(cardName)
        if (nameWidth < 25) {
          doc.text(cardName, chartX + 12, labelY)
        } else {
          doc.text(cardName.substring(0, 15) + '...', chartX + 12, labelY)
        }
        
        // Draw value
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text(`${count} (${percentage}%)`, chartX + 38 + barWidth, labelY)
      })
      
      yPosition += chartHeight + lineHeight * 1.5
      
      yPosition += sectionSpacing
    }

    // Fuel Card Comparisons
    if (reportComparisons.length > 0) {
      reportComparisons.forEach((comparison, compIndex) => {
        checkPageBreak(lineHeight * 8)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 32, 44) // #1a202c
        doc.text(`Fuel Card Comparison: ${formatFuelCardName(comparison.selectedCard)} vs ${formatFuelCardName(comparison.comparisonCard)}`, margin, yPosition)
        yPosition += lineHeight * 1.5
        
        // Statistics
        if (comparison.stats) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(10)
          doc.setTextColor(27, 34, 33) // #1B2221
          doc.text(`Stations on both cards: ${comparison.stats.bothCards}`, margin + 5, yPosition)
          yPosition += lineHeight
          doc.text(`${formatFuelCardName(comparison.selectedCard)} only: ${comparison.stats.selectedOnly}`, margin + 5, yPosition)
          yPosition += lineHeight
          doc.text(`${formatFuelCardName(comparison.comparisonCard)} only: ${comparison.stats.comparisonOnly}`, margin + 5, yPosition)
          yPosition += lineHeight * 1.2
        }
        
        // Missing stations
        if (comparison.missingStations && comparison.missingStations.length > 0) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(12)
          doc.text(`Stations Missing on ${formatFuelCardName(comparison.selectedCard)} (${comparison.missingStations.length}):`, margin, yPosition)
          yPosition += lineHeight * 1.2
          
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(10)
          comparison.missingStations.slice(0, 20).forEach((station, index) => {
            checkPageBreak(lineHeight * 2)
            doc.text(`${index + 1}. ${station.name || 'Unnamed Station'}`, margin + 5, yPosition)
            yPosition += lineHeight * 0.7
            const address = station.address || station.city || station.postcode || ''
            if (address) {
              doc.text(`   ${address}`, margin + 5, yPosition)
              yPosition += lineHeight
            } else {
              yPosition += lineHeight * 0.3
            }
          })
          if (comparison.missingStations.length > 20) {
            doc.text(`... and ${comparison.missingStations.length - 20} more stations`, margin + 5, yPosition)
            yPosition += lineHeight
          }
        }
        
        yPosition += sectionSpacing
      })
    }

    // Add footer to last page if needed
    if (yPosition < pageHeight - 20) {
      // Footer line
      doc.setDrawColor(8, 75, 131) // #084B83
      doc.setLineWidth(0.3)
      doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25)
      
      // Company contact info in footer
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      const footerText = `${companyDetails.company_address || ''}, ${companyDetails.company_city || ''}, ${companyDetails.company_postcode || ''} | ${companyDetails.company_phone || ''} | ${companyDetails.company_email || ''}`
      doc.text(footerText, margin, pageHeight - 18)
      
      // Employee details in footer
      if (companyDetails.company_employees_details) {
        const employee = companyDetails.company_employees_details
        const employeeInfo = `${employee.name || ''}${employee.email ? ` | ${employee.email}` : ''}${employee.phone ? ` | ${employee.phone}` : ''}`
        if (employeeInfo.trim() !== '|') {
          doc.setFontSize(8)
          doc.setTextColor(100, 100, 100)
          doc.text(employeeInfo, margin, pageHeight - 10)
        }
      }
      
      // Page number
      doc.setFontSize(9)
      doc.text(`Page ${pageNumber}`, pageWidth - margin - 10, pageHeight - 10)
    }

    // Add footer to last page
    addPageFooter(doc, pageWidth, pageHeight, margin, pageNumber)

    // Generate filename
    const companyName = reportData.companyName || 'Client'
    const date = new Date().toISOString().split('T')[0]
    const filename = `${companyName}_Report_${date}.pdf`

    // Save PDF
    doc.save(filename)
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>
          {locationLoading 
            ? 'Requesting location permission...' 
            : locationPermissionDenied 
              ? 'Please enter a postcode or location to search' 
              : 'Waiting for location...'}
        </p>
      </div>
    )
  }

  return (
    <div className="site-locator-page">
      {showLocationMessage && (
        <div className="location-toast">
          ✅ Using your location
        </div>
      )}

      <div className="site-locator-container">
        {/* Filters Sidebar - Floating on Left */}
        <aside className="filters-sidebar floating-filters">
          {/* View Controls - Results Count and Toggle */}
          <div className="view-controls-sidebar">
            <div className="results-count-sidebar">
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

          {/* Search Stations Section */}
          <div className="collapsible-section">
            <button 
              className="collapsible-header"
              onClick={() => toggleSection('search')}
            >
              <span className="collapsible-title">
                Search Stations
                {activeFilters.search > 0 && (
                  <span className="filter-badge">{activeFilters.search}</span>
                )}
              </span>
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

          {/* Must Have Stations Section */}
          <div className="collapsible-section">
            <button 
              className="collapsible-header"
              onClick={() => setOpenModal('mustHave')}
            >
              <span className="collapsible-title">
                Must Have Stations
                {activeFilters.mustHave > 0 && (
                  <span className="filter-badge">{activeFilters.mustHave}</span>
                )}
              </span>
              <span className="collapsible-icon">→</span>
            </button>
          </div>

          {/* Features Section */}
          <div className="collapsible-section">
            <button 
              className="collapsible-header"
              onClick={() => setOpenModal('features')}
            >
              <span className="collapsible-title">
                Features
                {activeFilters.features > 0 && (
                  <span className="filter-badge">{activeFilters.features}</span>
                )}
              </span>
              <span className="collapsible-icon">→</span>
            </button>
          </div>

          {/* Fuel Cards Section */}
          <div className="collapsible-section">
            <button 
              className="collapsible-header"
              onClick={() => setOpenModal('fuelCards')}
            >
              <span className="collapsible-title">
                Fuel Cards
                {activeFilters.fuelCards > 0 && (
                  <span className="filter-badge">{activeFilters.fuelCards}</span>
                )}
              </span>
              <span className="collapsible-icon">→</span>
            </button>
          </div>

          {/* Surcharges Section */}
          <div className="collapsible-section">
            <button 
              className="collapsible-header"
              onClick={() => setOpenModal('surcharges')}
            >
              <span className="collapsible-title">
                Surcharges
                {activeFilters.surcharges > 0 && (
                  <span className="filter-badge">{activeFilters.surcharges}</span>
                )}
              </span>
              <span className="collapsible-icon">→</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
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
              onAddComparisonToReport={(comparisonData) => {
                setReportComparisons(prev => {
                  // Check if this comparison already exists
                  const exists = prev.some(c => 
                    c.selectedCard === comparisonData.selectedCard && 
                    c.comparisonCard === comparisonData.comparisonCard
                  )
                  if (exists) return prev
                  return [...prev, comparisonData]
                })
              }}
              locationSearchTerm={locationSearchTerm}
              onLocationSearchTermChange={setLocationSearchTerm}
              onLocationSearch={handleLocationSearch}
              locationSearchResults={locationSearchResults}
              locationSearchLoading={locationSearchLoading}
              onLocationSelect={handleLocationSelect}
              searchedLocation={searchedLocation}
              onMapViewChange={(view) => {
                setMainMapCenter(view.center)
                setMainMapZoom(view.zoom)
              }}
              isSelectingRectangle={isSelectingRectangle}
              onRectangleSelect={async (selection) => {
                // Capture screenshot of only the selected region
                try {
                  const mainMapContainer = document.querySelector('.map-container .leaflet-container')
                  if (!mainMapContainer) {
                    console.error('Map container not found')
                    setIsSelectingRectangle(false)
                    return
                  }
                  
                  // Get the map instance (passed from RectangleSelector or find it)
                  const mapInstance = selection.mapInstance || 
                    (mainMapContainer._leaflet) ||
                    (L.Map && L.Map._instances && Object.values(L.Map._instances).find(m => m.getContainer() === mainMapContainer))
                  
                  if (!mapInstance || typeof mapInstance.latLngToContainerPoint !== 'function') {
                    console.error('Map instance not found or invalid')
                    setIsSelectingRectangle(false)
                    return
                  }
                  
                  // Hide UI overlays before capturing (but keep station markers)
                  const overlayPane = mainMapContainer.querySelector('.leaflet-overlay-pane')
                  const shadowPane = mainMapContainer.querySelector('.leaflet-shadow-pane')
                  const controlContainer = mainMapContainer.querySelector('.leaflet-control-container')
                  
                  // Store original styles
                  const originalOverlayDisplay = overlayPane ? overlayPane.style.display : null
                  const originalShadowDisplay = shadowPane ? shadowPane.style.display : null
                  const originalControlDisplay = controlContainer ? controlContainer.style.display : null
                  
                  // Hide overlays (rectangles, circles) and controls, but keep markers
                  if (overlayPane) overlayPane.style.display = 'none'
                  if (shadowPane) shadowPane.style.display = 'none'
                  if (controlContainer) controlContainer.style.display = 'none'
                  
                  // Wait a moment for the DOM to update
                  await new Promise(resolve => setTimeout(resolve, 100))
                  
                  // Capture the full map first
                  const canvas = await html2canvas(mainMapContainer, {
                    backgroundColor: '#F0F6F6',
                    scale: 2,
                    logging: false,
                    useCORS: true
                  })
                  
                  // Restore overlays
                  if (overlayPane) overlayPane.style.display = originalOverlayDisplay || ''
                  if (shadowPane) shadowPane.style.display = originalShadowDisplay || ''
                  if (controlContainer) controlContainer.style.display = originalControlDisplay || ''
                  
                  try {
                    // Create bounds from selection
                    const mapBounds = L.latLngBounds(selection.bounds)
                    
                    // Convert lat/lng bounds to pixel coordinates
                    const topLeft = mapInstance.latLngToContainerPoint(mapBounds.getNorthWest())
                    const bottomRight = mapInstance.latLngToContainerPoint(mapBounds.getSouthEast())
                    
                    // Calculate crop coordinates (accounting for scale)
                    const scale = 2
                    const containerRect = mainMapContainer.getBoundingClientRect()
                    
                    // Get the actual pixel positions within the container
                    const x = Math.max(0, Math.round(topLeft.x * scale))
                    const y = Math.max(0, Math.round(topLeft.y * scale))
                    const width = Math.min(
                      canvas.width - x, 
                      Math.max(1, Math.round((bottomRight.x - topLeft.x) * scale))
                    )
                    const height = Math.min(
                      canvas.height - y, 
                      Math.max(1, Math.round((bottomRight.y - topLeft.y) * scale))
                    )
                    
                    // Ensure we have valid dimensions
                    if (width > 0 && height > 0 && x < canvas.width && y < canvas.height) {
                      // Create a new canvas with only the selected region
                      const croppedCanvas = document.createElement('canvas')
                      croppedCanvas.width = width
                      croppedCanvas.height = height
                      const ctx = croppedCanvas.getContext('2d')
                      
                      // Draw the cropped region
                      ctx.drawImage(
                        canvas,
                        x, y, width, height,
                        0, 0, width, height
                      )
                      
                      const screenshot = croppedCanvas.toDataURL('image/png')
                      
                      // Add selection to list
                      const newSelection = {
                        id: Date.now(),
                        bounds: selection.bounds,
                        center: selection.center,
                        screenshot: screenshot,
                        notes: ''
                      }
                      setMapSelections(prev => [...prev, newSelection])
                      setIsSelectingRectangle(false)
                      return
                    } else {
                      console.error('Invalid crop dimensions:', { x, y, width, height, canvasWidth: canvas.width, canvasHeight: canvas.height })
                    }
                  } catch (cropError) {
                    console.error('Error cropping map selection:', cropError)
                  }
                  
                  // Fallback: use full screenshot if crop fails
                  console.warn('Using full screenshot as fallback')
                  const screenshot = canvas.toDataURL('image/png')
                  const newSelection = {
                    id: Date.now(),
                    bounds: selection.bounds,
                    center: selection.center,
                    screenshot: screenshot,
                    notes: ''
                  }
                  setMapSelections(prev => [...prev, newSelection])
                  setIsSelectingRectangle(false)
                } catch (error) {
                  console.error('Error capturing map selection:', error)
                  setIsSelectingRectangle(false)
                }
              }}
            />
          )}
        </main>
      </div>

      {/* Features Modal */}
      {openModal === 'features' && (
        <div className="filter-modal-overlay" onClick={() => setOpenModal(null)}>
          <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h3 className="filter-modal-title">Features</h3>
              <button className="filter-modal-close" onClick={() => setOpenModal(null)}>×</button>
            </div>
            <div className="filter-modal-content">
              <div className="features-grid">
                <label className="feature-option">
                  <input
                    type="checkbox"
                    checked={filterHGV}
                    onChange={(e) => setFilterHGV(e.target.checked)}
                  />
                  <div className="feature-option-content">
                    <span className="feature-icon">🚛</span>
                    <span className="feature-label">HGV Access</span>
                  </div>
                </label>
                <label className="feature-option">
                  <input
                    type="checkbox"
                    checked={filter24_7}
                    onChange={(e) => setFilter24_7(e.target.checked)}
                  />
                  <div className="feature-option-content">
                    <span className="feature-icon">🕐</span>
                    <span className="feature-label">24/7 Open</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fuel Cards Modal */}
      {openModal === 'fuelCards' && (
        <div className="filter-modal-overlay" onClick={() => setOpenModal(null)}>
          <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h3 className="filter-modal-title">Fuel Cards</h3>
              <button className="filter-modal-close" onClick={() => setOpenModal(null)}>×</button>
            </div>
            <div className="filter-modal-content">
              <div className="fuel-cards-grid">
                {fuelCardNames.map(card => {
                  const color = getFuelCardColor(card)
                  const isSelected = selectedFuelCards.includes(card)
                  return (
                    <label key={card} className="fuel-card-option">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleFuelCard(card)}
                      />
                      <div className="fuel-card-option-content">
                        <div 
                          className="fuel-card-color-indicator"
                          style={{ backgroundColor: color }}
                        />
                        <span className="fuel-card-label">{formatFuelCardName(card)}</span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Surcharges Modal */}
      {openModal === 'surcharges' && (
        <div className="filter-modal-overlay" onClick={() => setOpenModal(null)}>
          <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h3 className="filter-modal-title">Surcharges</h3>
              <button className="filter-modal-close" onClick={() => setOpenModal(null)}>×</button>
            </div>
            <div className="filter-modal-content">
              {/* Tabs */}
              <div className="surcharge-tabs">
                {ukFuelsSurcharges.length > 0 && (
                  <button
                    className={`surcharge-tab ${activeSurchargeTab === 'ukFuels' ? 'active' : ''}`}
                    onClick={() => setActiveSurchargeTab('ukFuels')}
                  >
                    <span className="surcharge-tab-indicator" style={{ backgroundColor: '#EF4444' }} />
                    UK Fuels
                  </button>
                )}
                {keyFuelsSurcharges.length > 0 && (
                  <button
                    className={`surcharge-tab ${activeSurchargeTab === 'keyFuels' ? 'active' : ''}`}
                    onClick={() => setActiveSurchargeTab('keyFuels')}
                  >
                    <span className="surcharge-tab-indicator" style={{ backgroundColor: '#10B981' }} />
                    KeyFuels
                  </button>
                )}
                {fastFuelsSurcharges.length > 0 && (
                  <button
                    className={`surcharge-tab ${activeSurchargeTab === 'fastFuels' ? 'active' : ''}`}
                    onClick={() => setActiveSurchargeTab('fastFuels')}
                  >
                    <span className="surcharge-tab-indicator" style={{ backgroundColor: '#00A8E8' }} />
                    FastFuels
                  </button>
                )}
                {shellCRTSurcharges.length > 0 && (
                  <button
                    className={`surcharge-tab ${activeSurchargeTab === 'shellCRT' ? 'active' : ''}`}
                    onClick={() => setActiveSurchargeTab('shellCRT')}
                  >
                    <span className="surcharge-tab-indicator" style={{ backgroundColor: '#FFD700' }} />
                    Shell Surcharge
                  </button>
                )}
              </div>

              {/* Tab Content */}
              <div className="surcharge-tab-content">
                {/* UK Fuels Tab */}
                {activeSurchargeTab === 'ukFuels' && ukFuelsSurcharges.length > 0 && (
                  <div className="surcharge-tab-panel">
                    <div className="surcharge-tab-header">
                      <h4 className="surcharge-tab-title">
                        <span className="surcharge-type-indicator" style={{ backgroundColor: '#EF4444' }} />
                        UK Fuels Surcharges
                      </h4>
                      <button
                        className="select-all-btn"
                        onClick={() => handleSelectAllSurcharges('uk_fuels_surcharge', ukFuelsSurcharges)}
                      >
                        {ukFuelsSurcharges.every(v => selectedUKFuelsSurcharge.includes(v)) ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="surcharge-options-grid">
                      {ukFuelsSurcharges.map(value => {
                        const isSelected = selectedUKFuelsSurcharge.includes(value)
                        return (
                          <label key={value} className="surcharge-option">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSurcharge('uk_fuels_surcharge', value)}
                            />
                            <div className="surcharge-option-content">
                              <span className="surcharge-value">{value}</span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* KeyFuels Tab */}
                {activeSurchargeTab === 'keyFuels' && keyFuelsSurcharges.length > 0 && (
                  <div className="surcharge-tab-panel">
                    <div className="surcharge-tab-header">
                      <h4 className="surcharge-tab-title">
                        <span className="surcharge-type-indicator" style={{ backgroundColor: '#10B981' }} />
                        KeyFuels Surcharges
                      </h4>
                      <button
                        className="select-all-btn"
                        onClick={() => handleSelectAllSurcharges('keyfuels_surcharge', keyFuelsSurcharges)}
                      >
                        {keyFuelsSurcharges.every(v => selectedKeyFuelsSurcharge.includes(v)) ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="surcharge-options-grid">
                      {keyFuelsSurcharges.map(value => {
                        const isSelected = selectedKeyFuelsSurcharge.includes(value)
                        return (
                          <label key={value} className="surcharge-option">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSurcharge('keyfuels_surcharge', value)}
                            />
                            <div className="surcharge-option-content">
                              <span className="surcharge-value">{value}</span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* FastFuels Tab */}
                {activeSurchargeTab === 'fastFuels' && fastFuelsSurcharges.length > 0 && (
                  <div className="surcharge-tab-panel">
                    <div className="surcharge-tab-header">
                      <h4 className="surcharge-tab-title">
                        <span className="surcharge-type-indicator" style={{ backgroundColor: '#00A8E8' }} />
                        FastFuels Surcharges
                      </h4>
                      <button
                        className="select-all-btn"
                        onClick={() => handleSelectAllSurcharges('fastfuels_surcharge', fastFuelsSurcharges)}
                      >
                        {fastFuelsSurcharges.every(v => selectedFastFuelsSurcharge.includes(v)) ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="surcharge-options-grid">
                      {fastFuelsSurcharges.map(value => {
                        const isSelected = selectedFastFuelsSurcharge.includes(value)
                        return (
                          <label key={value} className="surcharge-option">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSurcharge('fastfuels_surcharge', value)}
                            />
                            <div className="surcharge-option-content">
                              <span className="surcharge-value">{value}</span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Shell CRT Tab */}
                {activeSurchargeTab === 'shellCRT' && shellCRTSurcharges.length > 0 && (
                  <div className="surcharge-tab-panel">
                    <div className="surcharge-tab-header">
                      <h4 className="surcharge-tab-title">
                        <span className="surcharge-type-indicator" style={{ backgroundColor: '#FFD700' }} />
                        Shell Surcharge
                      </h4>
                      <button
                        className="select-all-btn"
                        onClick={() => handleSelectAllSurcharges('shell_crt_core_non_core', shellCRTSurcharges)}
                      >
                        {shellCRTSurcharges.every(v => selectedShellCRTSurcharge.includes(v)) ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="surcharge-options-grid">
                      {shellCRTSurcharges.map(value => {
                        const isSelected = selectedShellCRTSurcharge.includes(value)
                        return (
                          <label key={value} className="surcharge-option">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSurcharge('shell_crt_core_non_core', value)}
                            />
                            <div className="surcharge-option-content">
                              <span className="surcharge-value">{value}</span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Must Have Stations Modal */}
      {openModal === 'mustHave' && (
        <div className="filter-modal-overlay" onClick={() => setOpenModal(null)}>
          <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h3 className="filter-modal-title">Must Have Stations</h3>
              <button className="filter-modal-close" onClick={() => setOpenModal(null)}>×</button>
            </div>
            <div className="filter-modal-content">
              {mustHaveStations.length > 0 ? (
                <div className="must-have-modal-content">
                  <div className="must-have-description">
                    Showing stations that accept cards common to all selected stations:
                  </div>
                  
                  <div className="must-have-stations-list-modal">
                    {mustHaveStations.map((stationIndex) => {
                      const station = stations[stationIndex]
                      return station ? (
                        <div key={stationIndex} className="must-have-station-item-modal">
                          <div className="must-have-station-info">
                            <span className="must-have-station-name-modal">
                              {station.name}
                            </span>
                            <span className="must-have-station-location-modal">
                              {station.city || station.postcode}
                            </span>
                          </div>
                          <button
                            className="must-have-station-remove-btn-modal"
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
                    <div className="must-have-cards-modal">
                      <h4 className="must-have-cards-title">Common Fuel Cards:</h4>
                      <div className="must-have-cards-tags-modal">
                        {mustHaveFuelCards.map(card => {
                          const color = getFuelCardColor(card)
                          return (
                            <span 
                              key={card} 
                              className="must-have-card-tag-modal"
                              style={{ borderLeftColor: color }}
                            >
                              {formatFuelCardName(card)}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="must-have-no-cards-modal">
                      <p>No common fuel cards found</p>
                    </div>
                  )}

                  <button
                    className="clear-must-have-btn-modal"
                    onClick={() => setMustHaveStations([])}
                  >
                    Clear Selection
                  </button>
                </div>
              ) : (
                <div className="must-have-empty-state">
                  <p className="must-have-instructions-modal">
                    Select stations from the list or map to find fuel cards accepted at all of them.
                  </p>
                  <p className="must-have-hint">
                    Click the checkbox next to any station to add it to your must-have list.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Buttons */}
      <div className="report-buttons-container">
        <button
          className="screengrab-btn"
          onClick={() => setIsSelectingRectangle(!isSelectingRectangle)}
        >
          {isSelectingRectangle ? (
            <>
              <span>✕</span> Cancel
            </>
          ) : (
            <>
              <img src="/screengrab.png" alt="Take Screen Grab" />
              Take Screen Grab
            </>
          )}
        </button>
        <button
          className="report-btn"
          onClick={() => setShowReportModal(true)}
        >
          Generate Report
        </button>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-header">
              <h2 className="report-modal-title">Fuel Card Suitability Report</h2>
              <button className="report-modal-close" onClick={() => setShowReportModal(false)}>×</button>
            </div>
            <div className="report-modal-content">
              {/* Company Name */}
              <div className="report-section">
                <label className="report-label">Company Name</label>
                <input
                  type="text"
                  className="report-input"
                  placeholder="Enter company name..."
                  value={reportData.companyName}
                  onChange={(e) => setReportData({...reportData, companyName: e.target.value})}
                />
              </div>

              {/* Introduction */}
              <div className="report-section">
                <label className="report-label">Introduction</label>
                <textarea
                  className="report-textarea"
                  placeholder="Enter introduction text..."
                  rows="4"
                  value={reportData.introduction}
                  onChange={(e) => setReportData({...reportData, introduction: e.target.value})}
                />
              </div>

              {/* Map Selections */}
              <div className="report-section">
                <div className="report-section-header">
                  <h3 className="report-section-title">Map Views</h3>
                  <button
                    className="add-map-selection-btn"
                    onClick={() => {
                      setShowReportModal(false)
                      setIsSelectingRectangle(true)
                      setTimeout(() => {
                        // Scroll to map
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }, 100)
                    }}
                  >
                    + Add Map View
                  </button>
                </div>
                {mapSelections.length === 0 ? (
                  <div className="no-map-selections">
                    <p>No map views selected. Click "Add Map View" to select a region from the map.</p>
                  </div>
                ) : (
                  <div className="map-selections-list">
                    {mapSelections.map((selection) => (
                      <div key={selection.id} className="map-selection-item">
                        <div className="map-selection-image">
                          <img src={selection.screenshot} alt="Map selection" />
                          <button
                            className="remove-map-selection-btn"
                            onClick={() => {
                              setMapSelections(prev => prev.filter(s => s.id !== selection.id))
                            }}
                            title="Remove this map view"
                          >
                            ×
                          </button>
                        </div>
                        <div className="map-selection-notes">
                          <label className="report-label">Notes for this view:</label>
                          <textarea
                            className="report-textarea"
                            placeholder="Add notes about this map view..."
                            rows="2"
                            value={selection.notes}
                            onChange={(e) => {
                              setMapSelections(prev => prev.map(s => 
                                s.id === selection.id ? { ...s, notes: e.target.value } : s
                              ))
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Must Have Stations */}
              {mustHaveStations.length > 0 && (
                <div className="report-section">
                  <h3 className="report-section-title">Must Have Stations ({mustHaveStations.length})</h3>
                  <div className="report-stations-list">
                    {mustHaveStations.map((stationIndex) => {
                      const station = stations[stationIndex]
                      return station ? (
                        <div key={stationIndex} className="report-station-item">
                          <strong>{station.name || 'Unnamed Station'}</strong>
                          <span>{station.address || station.city || station.postcode || ''}</span>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              )}

              {/* Feature Requirements */}
              {(filterHGV || filter24_7) && (
                <div className="report-section">
                  <h3 className="report-section-title">Feature Requirements</h3>
                  <div className="report-features-list">
                    {filterHGV && <div className="report-feature-item">✓ HGV Access</div>}
                    {filter24_7 && <div className="report-feature-item">✓ 24/7 Access</div>}
                  </div>
                  <div className="report-notes-section">
                    <label className="report-label">Notes for Features</label>
                    <textarea
                      className="report-textarea"
                      placeholder="Add notes about feature requirements..."
                      rows="3"
                      value={reportData.notes.features}
                      onChange={(e) => setReportData({
                        ...reportData,
                        notes: {...reportData.notes, features: e.target.value}
                      })}
                    />
                  </div>
                </div>
              )}

              {/* Fuel Card Filters */}
              {selectedFuelCards.length > 0 && (
                <div className="report-section">
                  <h3 className="report-section-title">Fuel Card Filters ({selectedFuelCards.length})</h3>
                  <div className="report-fuel-cards-list">
                    {selectedFuelCards.map(card => {
                      const color = getFuelCardColor(card)
                      return (
                        <span
                          key={card}
                          className="report-fuel-card-tag"
                          style={{ borderLeftColor: color }}
                        >
                          {formatFuelCardName(card)}
                        </span>
                      )
                    })}
                  </div>
                  <div className="report-notes-section">
                    <label className="report-label">Notes for Fuel Cards</label>
                    <textarea
                      className="report-textarea"
                      placeholder="Add notes about fuel card filters..."
                      rows="3"
                      value={reportData.notes.fuelCards}
                      onChange={(e) => setReportData({
                        ...reportData,
                        notes: {...reportData.notes, fuelCards: e.target.value}
                      })}
                    />
                  </div>
                </div>
              )}

              {/* Surcharges */}
              {(selectedUKFuelsSurcharge.length > 0 || selectedKeyFuelsSurcharge.length > 0 || 
                selectedFastFuelsSurcharge.length > 0 || selectedShellCRTSurcharge.length > 0) && (
                <div className="report-section">
                  <h3 className="report-section-title">Surcharges</h3>
                  <div className="report-surcharges-list">
                    {selectedUKFuelsSurcharge.length > 0 && (
                      <div className="report-surcharge-group">
                        <strong>UK Fuels:</strong> {selectedUKFuelsSurcharge.join(', ')}
                      </div>
                    )}
                    {selectedKeyFuelsSurcharge.length > 0 && (
                      <div className="report-surcharge-group">
                        <strong>KeyFuels:</strong> {selectedKeyFuelsSurcharge.join(', ')}
                      </div>
                    )}
                    {selectedFastFuelsSurcharge.length > 0 && (
                      <div className="report-surcharge-group">
                        <strong>FastFuels:</strong> {selectedFastFuelsSurcharge.join(', ')}
                      </div>
                    )}
                    {selectedShellCRTSurcharge.length > 0 && (
                      <div className="report-surcharge-group">
                        <strong>Shell Surcharge:</strong> {selectedShellCRTSurcharge.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="report-notes-section">
                    <label className="report-label">Notes for Surcharges</label>
                    <textarea
                      className="report-textarea"
                      placeholder="Add notes about surcharges..."
                      rows="3"
                      value={reportData.notes.surcharges}
                      onChange={(e) => setReportData({
                        ...reportData,
                        notes: {...reportData.notes, surcharges: e.target.value}
                      })}
                    />
                  </div>
                </div>
              )}

              {/* Fuel Card Comparisons */}
              {reportComparisons.length > 0 && (
                <div className="report-section">
                  <h3 className="report-section-title">Fuel Card Comparisons</h3>
                  {reportComparisons.map((comparison, index) => (
                    <div key={index} className="report-comparison-item">
                      <h4 className="report-comparison-title">
                        {formatFuelCardName(comparison.selectedCard)} vs {formatFuelCardName(comparison.comparisonCard)}
                      </h4>
                      {comparison.stats && (
                        <div className="report-comparison-stats">
                          <div className="report-comparison-stat">
                            <strong>Both cards:</strong> {comparison.stats.bothCards} stations
                          </div>
                          <div className="report-comparison-stat">
                            <strong>{formatFuelCardName(comparison.selectedCard)} only:</strong> {comparison.stats.selectedOnly} stations
                          </div>
                          <div className="report-comparison-stat">
                            <strong>{formatFuelCardName(comparison.comparisonCard)} only:</strong> {comparison.stats.comparisonOnly} stations
                          </div>
                        </div>
                      )}
                      {comparison.missingStations && comparison.missingStations.length > 0 && (
                        <div className="report-comparison-missing">
                          <strong>Stations Missing on {formatFuelCardName(comparison.selectedCard)} ({comparison.missingStations.length}):</strong>
                          <ul className="report-comparison-stations-list">
                            {comparison.missingStations.slice(0, 10).map((station, idx) => (
                              <li key={idx}>
                                {station.name || 'Unnamed Station'} - {station.address || station.city || station.postcode || ''}
                              </li>
                            ))}
                            {comparison.missingStations.length > 10 && (
                              <li>... and {comparison.missingStations.length - 10} more stations</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Top 5 Fuel Cards by Coverage */}
              {topFuelCardsByCoverage.length > 0 && (
                <div className="report-section">
                  <h3 className="report-section-title">Top 5 Fuel Cards by Coverage</h3>
                  
                  {/* Bar Chart */}
                  <div className="report-chart-container">
                    <div className="report-bar-chart">
                      {topFuelCardsByCoverage.map(({ card, count, percentage }, index) => {
                        const color = getFuelCardColor(card)
                        const maxCount = Math.max(...topFuelCardsByCoverage.map(c => c.count))
                        const barWidth = maxCount > 0 ? (count / maxCount * 100) : 0
                        
                        return (
                          <div key={card} className="report-bar-item">
                            <div className="report-bar-label">
                              <span className="report-bar-rank">#{index + 1}</span>
                              <span className="report-bar-name" style={{ color: color }}>
                                {formatFuelCardName(card)}
                              </span>
                              <span className="report-bar-value">{count} ({percentage}%)</span>
                            </div>
                            <div className="report-bar-track">
                              <div 
                                className="report-bar-fill" 
                                style={{ 
                                  width: `${barWidth}%`,
                                  backgroundColor: color,
                                  boxShadow: `0 2px 8px ${color}40`
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* List View */}
                  <div className="report-coverage-list">
                    {topFuelCardsByCoverage.map(({ card, count, percentage }, index) => {
                      const color = getFuelCardColor(card)
                      return (
                        <div key={card} className="report-coverage-item">
                          <div className="report-coverage-rank">#{index + 1}</div>
                          <div className="report-coverage-info">
                            <div className="report-coverage-name" style={{ borderLeftColor: color }}>
                              {formatFuelCardName(card)}
                            </div>
                            <div className="report-coverage-stats">
                              {count} stations ({percentage}%)
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="report-actions">
                <button
                  className="report-btn-primary"
                  onClick={generatePDFReport}
                >
                  Generate Report
                </button>
                <button
                  className="report-btn-secondary"
                  onClick={() => setShowReportModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SiteLocatorPage
