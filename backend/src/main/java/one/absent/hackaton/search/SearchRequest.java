package one.absent.hackaton.search;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SearchRequest(@NotBlank @Size(max = 500) String text) {
}
