package one.absent.hackaton.search;

import java.util.List;

public record SearchResults(List<SearchMatch> confirmed, List<SearchMatch> possible,
                            List<SearchMatch> alternatives) {
}
