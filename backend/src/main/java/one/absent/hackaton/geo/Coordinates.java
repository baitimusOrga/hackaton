package one.absent.hackaton.geo;

/** A WGS84 point; for listings always the postcode centroid, never an address. */
public record Coordinates(double latitude, double longitude) {

    private static final double EARTH_KM = 6371.0;
    private static final double KM_PER_DEGREE = 111.0;

    /** Great-circle distance (haversine). */
    public double distanceKm(Coordinates other) {
        double dLat = Math.toRadians(other.latitude - latitude);
        double dLon = Math.toRadians(other.longitude - longitude);
        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(latitude)) * Math.cos(Math.toRadians(other.latitude))
                * Math.pow(Math.sin(dLon / 2), 2);
        return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
    }

    /** Degrees of latitude covering {@code radiusKm}: a cheap SQL prefilter before {@link #distanceKm}. */
    public static double latitudeSpan(double radiusKm) {
        return radiusKm / KM_PER_DEGREE;
    }

    /** Degrees of longitude covering {@code radiusKm} at this latitude. */
    public double longitudeSpan(double radiusKm) {
        return latitudeSpan(radiusKm) / Math.max(Math.cos(Math.toRadians(latitude)), 0.01);
    }
}
