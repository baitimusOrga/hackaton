package one.absent.hackaton.search;

import io.swagger.v3.oas.annotations.media.Schema;

/** A filter the buyer could drop; {@code count}: listings that would fit then; {@code attribute}: only for MUST_HAVE. */
public record Relaxation(Kind kind, @Schema(nullable = true) String attribute, int count) {

    public enum Kind { BUDGET, REGION, CATEGORY, MUST_HAVE }
}
