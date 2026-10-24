package one.absent.hackaton.listing;

import java.util.List;
import java.util.stream.Stream;

/**
 * The only listing attribute names: every fact name of the category catalog plus the condition; publishing and
 * the buying assistant both use this list.
 */
public final class Attributes {

    public static final List<String> ALL = Stream.concat(Categories.FACT_NAMES.stream(), Stream.of("Condition"))
            .distinct().toList();

    private Attributes() {
    }
}
