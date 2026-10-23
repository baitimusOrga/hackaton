package one.absent.hackaton.search;

import jakarta.validation.constraints.NotBlank;

public record Requirement(@NotBlank String attribute, @NotBlank String value) {
}
