package one.absent.hackaton.search;

import java.util.List;

import one.absent.hackaton.listing.ListingSummary;

public record SearchMatch(ListingSummary listing, String reason, List<String> missingDetails,
                          List<String> differences) {
}
