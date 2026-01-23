import { useMemo } from 'react'
import { formatFuelCardName, stationAcceptsFuelCard, getFuelCardNames } from '../utils/dataProcessor'
import { getFullAddress } from '../utils/dataProcessor'
import './StationCard.css'

function StationCard({ station, isMustHave = false, onToggleMustHave }) {
  const fuelCardNames = useMemo(() => getFuelCardNames([station]), [station])
  
  const acceptedFuelCards = useMemo(() => {
    return fuelCardNames.filter(card => stationAcceptsFuelCard(station, card))
  }, [station, fuelCardNames])

  const fullAddress = useMemo(() => getFullAddress(station), [station])

  return (
    <div className={`station-card ${isMustHave ? 'must-have-selected' : ''}`}>
      <div className="station-header">
        <div className="station-header-left">
          <label className="must-have-checkbox-label" title={isMustHave ? "Remove from Must have station list" : "Add to Must have station list"}>
            <input
              type="checkbox"
              checked={isMustHave}
              onChange={onToggleMustHave || (() => {})}
              className="must-have-checkbox"
              title={isMustHave ? "Remove from Must have station list" : "Add to Must have station list"}
            />
            <h3 className="station-name">{station.name || 'Unnamed Station'}</h3>
          </label>
        </div>
        {station.network && (
          <span className="network-badge">{station.network}</span>
        )}
      </div>
      
      <div className="station-info">
        <div className="address-section">
          <p className="address">{fullAddress}</p>
        </div>

        {station.distance !== undefined && (
          <div className="distance">
            <span className="distance-label">📍</span>
            <span>{station.distance.toFixed(1)} miles away</span>
          </div>
        )}
        {!station.distance && station.lat && station.lng && (
          <div className="coordinates">
            <span className="coord-label">📍</span>
            <span>{station.lat.toFixed(6)}, {station.lng.toFixed(6)}</span>
          </div>
        )}
      </div>

      {acceptedFuelCards.length > 0 && (
        <div className="fuel-cards-section">
          <p className="fuel-cards-label">Accepted Fuel Cards:</p>
          <div className="fuel-cards-tags">
            {acceptedFuelCards.map((card) => (
              <span key={card} className="fuel-card-tag">
                {formatFuelCardName(card)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="station-features">
        {station['24-7'] && (
          <div className="feature-badge">24/7 Available</div>
        )}
        {station.hgv && (
          <div className="feature-badge">HGV</div>
        )}
      </div>
    </div>
  )
}

export default StationCard
