package one.absent.hackaton.search;

import java.util.List;

/**
 * {@code matches}: best first; {@code compared}: number of listings scored, 0 when none; {@code aiRanked}: false when
 * the ranking ran without the assistant; {@code relaxations}: only when matches are few, most helpful first.
 */
public record SearchResults(List<SearchMatch> matches, int compared, boolean aiRanked,
                            List<Relaxation> relaxations) {
}
