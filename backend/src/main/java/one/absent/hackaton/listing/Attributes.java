package one.absent.hackaton.listing;

import java.util.List;

/** The only listing attribute names; publishing and the buying assistant both use this list. */
public final class Attributes {

    public static final List<String> ALL = List.of("Brand", "Model", "Year", "Color", "Size", "Display",
            "Resolution", "CPU", "RAM", "Storage", "Material", "Dimensions", "Condition");

    private Attributes() {
    }
}
