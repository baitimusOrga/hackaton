package one.absent.hackaton.listing;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import io.swagger.v3.oas.annotations.media.Schema;

/** The only listing categories; AI prompts and filters use this list, the frontend mirrors it in categories.ts. */
public final class Categories {

    public static final List<String> ALL = List.of("Computers", "Laptops", "Monitors", "Phones", "Tablets",
            "Office furniture", "Office equipment", "Audio", "Cameras", "Household", "Bikes", "Gaming",
            "TV & home cinema");

    /** One field of a category; empty {@code options} means free text, otherwise suggestions that still allow it. */
    @Schema(name = "CategoryField")
    public record Field(String name, List<String> options) {}

    private static final List<String> RAM = List.of("4 GB", "8 GB", "16 GB", "32 GB", "64 GB");
    private static final List<String> PC_STORAGE = List.of("128 GB", "256 GB", "512 GB", "1 TB", "2 TB");
    private static final List<String> PHONE_STORAGE = List.of("64 GB", "128 GB", "256 GB", "512 GB", "1 TB");

    /** Per category the fields a good listing needs, most important first; the sell flow asks for missing ones. */
    public static final Map<String, List<Field>> FIELDS = Map.ofEntries(
            Map.entry("Computers", List.of(text("Brand"), text("Model"), text("CPU"), new Field("RAM", RAM),
                    new Field("Storage", PC_STORAGE), text("GPU"), text("Operating system"))),
            Map.entry("Laptops", List.of(text("Brand"), text("Model"), text("CPU"), new Field("RAM", RAM),
                    new Field("Storage", PC_STORAGE), text("Display"), text("GPU"), text("Operating system"))),
            Map.entry("Monitors", List.of(text("Brand"), text("Model"),
                    new Field("Size", List.of("24\"", "27\"", "32\"", "34\"")),
                    new Field("Resolution", List.of("1920x1080", "2560x1440", "3440x1440", "3840x2160")))),
            Map.entry("Phones", List.of(text("Brand"), text("Model"), new Field("Storage", PHONE_STORAGE),
                    text("Color"))),
            Map.entry("Tablets", List.of(text("Brand"), text("Model"), new Field("Storage", PHONE_STORAGE),
                    text("Display"))),
            Map.entry("Office furniture", List.of(text("Brand"), text("Model"), text("Dimensions"),
                    text("Material"))),
            Map.entry("Office equipment", List.of(text("Brand"), text("Model"), text("Dimensions"))),
            Map.entry("Audio", List.of(text("Brand"), text("Model"),
                    new Field("Connectivity", List.of("Bluetooth", "Cable", "Wi-Fi")))),
            Map.entry("Cameras", List.of(text("Brand"), text("Model"), text("Lens mount"), text("Sensor"))),
            Map.entry("Household", List.of(text("Brand"), text("Model"), text("Dimensions"))),
            Map.entry("Bikes", List.of(text("Brand"), text("Model"),
                    new Field("Frame size", List.of("XS", "S", "M", "L", "XL")),
                    new Field("Wheel size", List.of("26\"", "27.5\"", "28\"", "29\"")), text("Gears"),
                    new Field("Brakes", List.of("Rim", "Disc")))),
            Map.entry("Gaming", List.of(text("Brand"), text("Model"),
                    new Field("Storage", List.of("500 GB", "825 GB", "1 TB", "2 TB")))),
            Map.entry("TV & home cinema", List.of(text("Brand"), text("Model"),
                    new Field("Size", List.of("43\"", "50\"", "55\"", "65\"", "75\"")),
                    new Field("Resolution", List.of("1920x1080", "3840x2160")))));

    /** {@link #FIELDS} by name only. */
    public static final Map<String, List<String>> KEY_FACTS = FIELDS.entrySet().stream().collect(Collectors.toMap(
            Map.Entry::getKey, e -> e.getValue().stream().map(Field::name).toList()));

    /** Every fact name the AI may use: all key facts plus a few general ones. */
    public static final List<String> FACT_NAMES = Stream.concat(
                    KEY_FACTS.values().stream().flatMap(List::stream), Stream.of("Year", "Color"))
            .distinct().sorted().toList();

    /** {@link #ALL} as a JSON array for structured-output schemas. */
    public static final String JSON = ALL.stream().map(c -> '"' + c + '"').collect(Collectors.joining(", ", "[", "]"));

    private static Field text(String name) {
        return new Field(name, List.of());
    }

    private Categories() {
    }
}
