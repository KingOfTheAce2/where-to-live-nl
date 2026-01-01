# PDOK Flood Services - API Examples & Quick Reference

**Quick access guide for developers integrating PDOK flood data**

---

## 🚀 Quick Start

### Most Useful Endpoints

```bash
# 1. Get flood risk zones near Utrecht (OGC API - RECOMMENDED)
curl "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?bbox=5.0,52.0,5.2,52.2&f=json"

# 2. Get all risk zones (paginated)
curl "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?limit=100&f=json"

# 3. Get historical flood events
curl "https://api.pdok.nl/rws/overstromingen-gebeurtenis/ogc/v1/collections/observed_event/items?f=json"
```

---

## 📊 1. OGC API Features (Recommended)

### Base URLs
```
Risk Zones:  https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1
Events:      https://api.pdok.nl/rws/overstromingen-gebeurtenis/ogc/v1
```

### Common Requests

#### Get Landing Page
```bash
curl "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1?f=json"
```

#### List Collections
```bash
curl "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections?f=json"
```

#### Get Collection Metadata
```bash
curl "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone?f=json"
```

#### Get Features (All)
```bash
curl "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?f=json"
```

#### Get Features (Limited)
```bash
curl "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?limit=10&f=json"
```

#### Get Features (Pagination)
```bash
# Get first page
curl "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?limit=100&f=json"

# Get next page (use 'next' link from previous response)
curl "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?limit=100&offset=100&f=json"
```

#### Spatial Filter (Bounding Box)
```bash
# WGS84 coordinates (Amsterdam area)
curl "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?bbox=4.7,52.3,5.0,52.4&f=json"

# RD coordinates (Dutch grid - Utrecht area)
curl "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?bbox=120000,450000,140000,470000&bbox-crs=EPSG:28992&f=json"
```

#### Get Single Feature
```bash
# Replace {featureId} with actual ID
curl "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items/{featureId}?f=json"
```

---

## 🗺️ 2. WMS (Web Map Service)

### GetCapabilities
```bash
curl "https://service.pdok.nl/rws/overstromingen-risicogebied/wms/v1_0?request=GetCapabilities&service=WMS"
```

### GetMap (Image Tile)

#### Basic GetMap
```
https://service.pdok.nl/rws/overstromingen-risicogebied/wms/v1_0?
  SERVICE=WMS&
  VERSION=1.3.0&
  REQUEST=GetMap&
  LAYERS=NZ.RiskZone&
  CRS=EPSG:28992&
  BBOX=10000,305000,280000,625000&
  WIDTH=800&
  HEIGHT=600&
  FORMAT=image/png&
  TRANSPARENT=TRUE
```

#### GetMap for Web Mercator (Web Apps)
```
https://service.pdok.nl/rws/overstromingen-risicogebied/wms/v1_0?
  SERVICE=WMS&
  VERSION=1.3.0&
  REQUEST=GetMap&
  LAYERS=NZ.RiskZone&
  CRS=EPSG:3857&
  BBOX=520000,6780000,560000,6820000&
  WIDTH=1024&
  HEIGHT=1024&
  FORMAT=image/png&
  TRANSPARENT=TRUE
```

#### GetMap for WGS84 (Amsterdam)
```
https://service.pdok.nl/rws/overstromingen-risicogebied/wms/v1_0?
  SERVICE=WMS&
  VERSION=1.3.0&
  REQUEST=GetMap&
  LAYERS=NZ.RiskZone&
  CRS=EPSG:4326&
  BBOX=52.3,4.7,52.4,5.0&
  WIDTH=800&
  HEIGHT=600&
  FORMAT=image/png&
  TRANSPARENT=TRUE
```

### GetFeatureInfo (Point Query)
```
https://service.pdok.nl/rws/overstromingen-risicogebied/wms/v1_0?
  SERVICE=WMS&
  VERSION=1.3.0&
  REQUEST=GetFeatureInfo&
  LAYERS=NZ.RiskZone&
  QUERY_LAYERS=NZ.RiskZone&
  CRS=EPSG:28992&
  BBOX=120000,450000,140000,470000&
  WIDTH=800&
  HEIGHT=600&
  I=400&
  J=300&
  INFO_FORMAT=application/json
```

---

## 🔍 3. WFS (Web Feature Service)

### GetCapabilities
```bash
curl "https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0?request=GetCapabilities&service=WFS"
```

### GetFeature (All Features)
```bash
curl "https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0?
  SERVICE=WFS&
  VERSION=2.0.0&
  REQUEST=GetFeature&
  TYPENAMES=overstromingen-risicogebied:risk_zone&
  OUTPUTFORMAT=application/json"
```

### GetFeature (Limited)
```bash
curl "https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0?
  SERVICE=WFS&
  VERSION=2.0.0&
  REQUEST=GetFeature&
  TYPENAMES=overstromingen-risicogebied:risk_zone&
  COUNT=10&
  OUTPUTFORMAT=application/json"
```

### GetFeature (Bounding Box Filter)
```xml
<!-- POST request with XML filter -->
<?xml version="1.0"?>
<wfs:GetFeature
  service="WFS"
  version="2.0.0"
  xmlns:wfs="http://www.opengis.net/wfs/2.0"
  xmlns:fes="http://www.opengis.net/fes/2.0"
  xmlns:gml="http://www.opengis.net/gml/3.2"
  xmlns:overstromingen-risicogebied="http://pdok.nl/rws/overstromingen-risicogebied">
  <wfs:Query typeNames="overstromingen-risicogebied:risk_zone">
    <fes:Filter>
      <fes:BBOX>
        <gml:Envelope srsName="EPSG:28992">
          <gml:lowerCorner>120000 450000</gml:lowerCorner>
          <gml:upperCorner>140000 470000</gml:upperCorner>
        </gml:Envelope>
      </fes:BBOX>
    </fes:Filter>
  </wfs:Query>
</wfs:GetFeature>
```

---

## 📥 4. ATOM Feed (Bulk Download)

### Download Full Dataset
```bash
# Get ATOM feed
curl "https://service.pdok.nl/rws/overstromingen-risicogebied/atom/index.xml"

# Download specific file (check ATOM feed for URLs)
# Example (URL from ATOM feed):
curl -O "https://service.pdok.nl/rws/overstromingen-risicogebied/atom/downloads/risk_zone.gml"
```

---

## 💻 5. JavaScript Examples

### Fetch API (Browser/Node.js)

#### Get Features Near Location
```javascript
async function getFloodRiskZones(lat, lon, bufferKm = 5) {
  const buffer = bufferKm / 111; // Rough conversion to degrees
  const bbox = `${lon-buffer},${lat-buffer},${lon+buffer},${lat+buffer}`;

  const url = `https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?bbox=${bbox}&f=json`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.features;
  } catch (error) {
    console.error('Error fetching flood risk zones:', error);
    return [];
  }
}

// Usage
const zones = await getFloodRiskZones(52.0907, 5.1214, 10);
console.log(`Found ${zones.length} risk zones`);
```

#### Get Features with RD Coordinates
```javascript
async function getFloodRiskZonesRD(x, y, bufferMeters = 5000) {
  const bbox = `${x-bufferMeters},${y-bufferMeters},${x+bufferMeters},${y+bufferMeters}`;
  const bboxCrs = 'EPSG:28992';

  const url = `https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?bbox=${bbox}&bbox-crs=${bboxCrs}&f=json`;

  const response = await fetch(url);
  return await response.json();
}

// Usage (Utrecht center in RD)
const data = await getFloodRiskZonesRD(136000, 455000, 10000);
```

#### Pagination Handler
```javascript
async function getAllFloodRiskZones() {
  const features = [];
  let url = 'https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?limit=100&f=json';

  while (url) {
    const response = await fetch(url);
    const data = await response.json();

    features.push(...data.features);

    // Check for next page link
    const nextLink = data.links?.find(link => link.rel === 'next');
    url = nextLink?.href;

    console.log(`Fetched ${features.length} features so far...`);
  }

  return features;
}
```

---

## 🐍 6. Python Examples

### Using Requests Library

#### Basic Feature Retrieval
```python
import requests

def get_flood_risk_zones(lat, lon, buffer_km=5):
    """Get flood risk zones near a location."""
    buffer = buffer_km / 111  # Rough conversion to degrees
    bbox = f"{lon-buffer},{lat-buffer},{lon+buffer},{lat+buffer}"

    url = "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items"
    params = {
        'bbox': bbox,
        'f': 'json',
        'limit': 1000
    }

    response = requests.get(url, params=params)
    response.raise_for_status()

    return response.json()

# Usage
data = get_flood_risk_zones(52.0907, 5.1214, 10)
print(f"Found {len(data['features'])} risk zones")
```

#### With RD Coordinates
```python
def get_flood_risk_zones_rd(x, y, buffer_meters=5000):
    """Get flood risk zones using Dutch RD coordinates."""
    bbox = f"{x-buffer_meters},{y-buffer_meters},{x+buffer_meters},{y+buffer_meters}"

    url = "https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items"
    params = {
        'bbox': bbox,
        'bbox-crs': 'EPSG:28992',
        'f': 'json'
    }

    response = requests.get(url, params=params)
    return response.json()

# Utrecht center
data = get_flood_risk_zones_rd(136000, 455000, 10000)
```

### Using GeoPandas

```python
import geopandas as gpd
from shapely.geometry import Point, box

def get_flood_risk_gdf(lat, lon, buffer_km=5):
    """Get flood risk zones as GeoDataFrame."""
    buffer = buffer_km / 111
    bbox = f"{lon-buffer},{lat-buffer},{lon+buffer},{lat+buffer}"

    url = f"https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?bbox={bbox}&f=json"

    # Read directly into GeoDataFrame
    gdf = gpd.read_file(url)

    return gdf

# Usage
gdf = get_flood_risk_gdf(52.0907, 5.1214, 10)
print(gdf.head())
print(f"CRS: {gdf.crs}")
```

### WFS with OWSLib
```python
from owslib.wfs import WebFeatureService

# Connect to WFS
wfs = WebFeatureService(
    url='https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0',
    version='2.0.0'
)

# List available layers
print(list(wfs.contents))

# Get features
response = wfs.getfeature(
    typename='overstromingen-risicogebied:risk_zone',
    maxfeatures=10,
    outputFormat='json'
)

import json
data = json.loads(response.read())
```

---

## 🗺️ 7. Leaflet Integration

### Add WMS Layer
```javascript
// Add flood risk WMS overlay to Leaflet map
const floodWMS = L.tileLayer.wms(
  'https://service.pdok.nl/rws/overstromingen-risicogebied/wms/v1_0',
  {
    layers: 'NZ.RiskZone',
    format: 'image/png',
    transparent: true,
    crs: L.CRS.EPSG28992, // or L.CRS.EPSG3857 for Web Mercator
    attribution: 'Flood risk data: Rijkswaterstaat / PDOK'
  }
);

// Add to map
floodWMS.addTo(map);

// Or add to layer control
L.control.layers(null, {
  'Flood Risk Zones': floodWMS
}).addTo(map);
```

### Query Features on Click
```javascript
map.on('click', async function(e) {
  const lat = e.latlng.lat;
  const lon = e.latlng.lng;
  const buffer = 0.01; // Small buffer for point query

  const bbox = `${lon-buffer},${lat-buffer},${lon+buffer},${lat+buffer}`;
  const url = `https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?bbox=${bbox}&f=json`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.features.length > 0) {
      const zone = data.features[0];
      const popup = L.popup()
        .setLatLng(e.latlng)
        .setContent(`
          <strong>Flood Risk Zone</strong><br>
          ${zone.properties.description}<br>
          Category: ${zone.properties.natural_hazard_category}
        `)
        .openOn(map);
    }
  } catch (error) {
    console.error('Error querying flood zones:', error);
  }
});
```

---

## 🎯 8. Common Use Cases

### Use Case 1: Check if Address is in Flood Zone

```javascript
async function isAddressInFloodZone(lat, lon) {
  const buffer = 0.001; // Very small buffer (~100m)
  const bbox = `${lon-buffer},${lat-buffer},${lon+buffer},${lat+buffer}`;

  const url = `https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?bbox=${bbox}&f=json`;

  const response = await fetch(url);
  const data = await response.json();

  return {
    inFloodZone: data.features.length > 0,
    zones: data.features.map(f => ({
      description: f.properties.description,
      category: f.properties.natural_hazard_category
    }))
  };
}

// Usage
const result = await isAddressInFloodZone(52.0907, 5.1214);
if (result.inFloodZone) {
  console.log('Warning: Address is in flood risk zone!');
  console.log('Zones:', result.zones);
}
```

### Use Case 2: Find Nearest Flood Risk Zones

```python
import geopandas as gpd
from shapely.geometry import Point

def find_nearest_flood_zones(lat, lon, max_distance_km=20):
    """Find flood zones within max distance."""
    # Create point
    point = Point(lon, lat)

    # Get zones in bounding box
    buffer = max_distance_km / 111
    bbox = f"{lon-buffer},{lat-buffer},{lon+buffer},{lat+buffer}"
    url = f"https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?bbox={bbox}&f=json"

    gdf = gpd.read_file(url)

    if len(gdf) == 0:
        return None

    # Calculate distances
    gdf = gdf.to_crs('EPSG:28992')  # Dutch projection for accurate distances
    point_rd = gpd.GeoSeries([point], crs='EPSG:4326').to_crs('EPSG:28992')[0]

    gdf['distance_m'] = gdf.geometry.distance(point_rd)
    gdf['distance_km'] = gdf['distance_m'] / 1000

    # Filter and sort
    gdf = gdf[gdf['distance_km'] <= max_distance_km]
    gdf = gdf.sort_values('distance_km')

    return gdf[['description', 'natural_hazard_category', 'distance_km']]

# Usage
zones = find_nearest_flood_zones(52.0907, 5.1214, 10)
print(zones)
```

### Use Case 3: Generate Flood Risk Report

```javascript
async function generateFloodRiskReport(municipality) {
  // This would require geocoding the municipality first
  // Then querying flood zones within municipality bounds

  const zones = await getFloodRiskZones(lat, lon, radius);

  const report = {
    municipality,
    totalZones: zones.length,
    riskCategories: {},
    descriptions: []
  };

  zones.forEach(zone => {
    const category = zone.properties.natural_hazard_category;
    report.riskCategories[category] = (report.riskCategories[category] || 0) + 1;
    report.descriptions.push(zone.properties.description);
  });

  return report;
}
```

---

## 🔧 9. Error Handling

### Handle Common Errors

```javascript
async function robustFloodQuery(lat, lon) {
  const buffer = 0.05;
  const bbox = `${lon-buffer},${lat-buffer},${lon+buffer},${lat+buffer}`;
  const url = `https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1/collections/risk_zone/items?bbox=${bbox}&f=json`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.features) {
      throw new Error('Invalid response format');
    }

    return {
      success: true,
      features: data.features
    };

  } catch (error) {
    console.error('Flood query error:', error);

    return {
      success: false,
      error: error.message,
      features: []
    };
  }
}
```

---

## 📝 10. Best Practices

### ✅ DO:
- Use OGC API Features for new integrations
- Implement pagination for large datasets
- Cache responses locally when appropriate
- Use appropriate CRS (EPSG:28992 for NL data)
- Include attribution in your application
- Handle errors gracefully
- Use bbox filters to limit data transfer

### ❌ DON'T:
- Poll services excessively (use caching)
- Request full dataset when you only need local data
- Ignore CRS transformations
- Hardcode feature IDs (they may change)
- Rely on undocumented API features

---

## 🔗 Quick Links

- **API Landing Page:** https://api.pdok.nl/rws/overstromingen-risicogebied/ogc/v1
- **WMS Capabilities:** https://service.pdok.nl/rws/overstromingen-risicogebied/wms/v1_0?request=GetCapabilities&service=WMS
- **WFS Capabilities:** https://service.pdok.nl/rws/overstromingen-risicogebied/wfs/v1_0?request=GetCapabilities&service=WFS
- **PDOK Main Site:** https://www.pdok.nl/
- **PDOK Viewer:** https://app.pdok.nl/viewer/

---

**Last Updated:** December 23, 2025
