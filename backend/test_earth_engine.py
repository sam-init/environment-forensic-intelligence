import ee

PROJECT_ID = "forensic-intelligence-511405"

try:
    ee.Initialize(project=PROJECT_ID)

    print("Earth Engine initialized successfully!")

    # Load Belagavi district's administrative boundary.
    districts = ee.FeatureCollection("FAO/GAUL/2015/level2")

    belagavi = districts.filter(
        ee.Filter.And(
            ee.Filter.eq("ADM0_NAME", "India"),
            ee.Filter.eq("ADM1_NAME", "Karnataka"),
            ee.Filter.inList("ADM2_NAME", ["Belagavi", "Belgaum"]),
        )
    )

    print("Belagavi boundary features:", belagavi.size().getInfo())

    # Check Sentinel-2 data availability.
    images = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(belagavi.geometry())
        .filterDate("2025-01-01", "2025-02-01")
        .limit(5)
    )

    print("Sentinel-2 scenes found:", images.size().getInfo())

except Exception as error:
    print("Earth Engine test failed:", error)
