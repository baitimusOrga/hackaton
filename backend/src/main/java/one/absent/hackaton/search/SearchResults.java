package one.absent.hackaton.search;

import java.util.List;

/** {@code matches}: best first; {@code compared}: number of listings scored, 0 when none. */
public record SearchResults(List<SearchMatch> matches, int compared) {
}
