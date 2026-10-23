package one.absent.hackaton.listing;

import java.util.List;
import java.util.stream.Collectors;

/** The only listing categories; AI prompts and filters use this list, the frontend mirrors it in categories.ts. */
public final class Categories {

    public static final List<String> ALL = List.of("Computers", "Laptops", "Monitors", "Phones", "Tablets",
            "Office furniture", "Office equipment", "Audio", "Cameras", "Household", "Bikes");

    /** {@link #ALL} as a JSON array for structured-output schemas. */
    public static final String JSON = ALL.stream().map(c -> '"' + c + '"').collect(Collectors.joining(", ", "[", "]"));

    private Categories() {
    }
}
