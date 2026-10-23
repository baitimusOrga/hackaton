package one.absent.hackaton.search;

import java.util.List;

/** {@code compared}: number of listings handed to ranking, 0 when none. */
public record SearchResults(List<SearchMatch> confirmed, List<SearchMatch> possible,
                            List<SearchMatch> alternatives, int compared) {
}
