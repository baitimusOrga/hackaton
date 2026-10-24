package one.absent.hackaton.search;

import java.util.List;

import one.absent.hackaton.listing.ListingSummary;

/** {@code score}: 0–100, higher fits better; {@code matched}: the requirements the listing states. */
public record SearchMatch(ListingSummary listing, int score, Fit fit, String reason, List<String> matched,
                          List<String> missingDetails, List<String> differences) {

    /** Decided by code from the listing data: a difference beats a missing detail. */
    public enum Fit { MATCH, NEEDS_DETAILS, ALTERNATIVE }
}
