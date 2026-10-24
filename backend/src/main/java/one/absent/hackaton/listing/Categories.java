package one.absent.hackaton.listing;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/** The only listing categories; AI prompts and filters use this list, the frontend mirrors it in categories.ts. */
public final class Categories {

    public static final List<String> ALL = List.of("Computers", "Laptops", "Monitors", "Phones", "Tablets",
            "Office furniture", "Office equipment", "Audio", "Cameras", "Household", "Bikes", "Gaming",
            "TV & home cinema");

    /** Per category the facts a good listing needs, most important first; the sell flow asks for missing ones. */
    public static final Map<String, List<String>> KEY_FACTS = Map.ofEntries(
            Map.entry("Computers", List.of("Brand", "Model", "CPU", "RAM", "Storage")),
            Map.entry("Laptops", List.of("Brand", "Model", "CPU", "RAM", "Storage", "Display")),
            Map.entry("Monitors", List.of("Brand", "Model", "Size", "Resolution")),
            Map.entry("Phones", List.of("Brand", "Model", "Storage", "Color")),
            Map.entry("Tablets", List.of("Brand", "Model", "Storage", "Display")),
            Map.entry("Office furniture", List.of("Brand", "Model", "Dimensions", "Material")),
            Map.entry("Office equipment", List.of("Brand", "Model", "Dimensions")),
            Map.entry("Audio", List.of("Brand", "Model", "Connectivity")),
            Map.entry("Cameras", List.of("Brand", "Model", "Lens mount", "Sensor")),
            Map.entry("Household", List.of("Brand", "Model", "Dimensions")),
            Map.entry("Bikes", List.of("Brand", "Model", "Frame size", "Wheel size", "Gears", "Brakes")),
            Map.entry("Gaming", List.of("Brand", "Model", "Storage")),
            Map.entry("TV & home cinema", List.of("Brand", "Model", "Size", "Resolution")));

    /** Every fact name the AI may use: all key facts plus a few general ones. */
    public static final List<String> FACT_NAMES = Stream.concat(
                    KEY_FACTS.values().stream().flatMap(List::stream), Stream.of("Year", "Color"))
            .distinct().sorted().toList();

    /** {@link #ALL} as a JSON array for structured-output schemas. */
    public static final String JSON = ALL.stream().map(c -> '"' + c + '"').collect(Collectors.joining(", ", "[", "]"));

    private Categories() {
    }
}
