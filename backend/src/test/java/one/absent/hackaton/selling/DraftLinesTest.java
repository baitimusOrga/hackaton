package one.absent.hackaton.selling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;

import one.absent.hackaton.selling.DraftEvent.Type;
import one.absent.hackaton.selling.ListingDraft.PriceEstimate;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

class DraftLinesTest {
    final List<DraftEvent> events = new ArrayList<>();
    final DraftLines lines = new DraftLines(JsonMapper.builder().build(), 2, events::add);
    final PriceEstimator prices = mock(PriceEstimator.class);

    @Test void validLinesBecomeEventsAndTheDraftComesLast() {
        when(prices.estimate(any(), any(), any(), any())).thenReturn(mock(PriceEstimate.class));
        lines.accept("""
                {"type":"detection","photo":1,"box":[0.1,0.2,0.3,0.1],"label":"Brand: Trek","fact":{"name":"Brand","value":"Trek","source":"LABEL"}}""");
        lines.accept("""
                {"type":"privacy","photo":2,"box":[0.5,0.5,0.1,0.1],"text":"Shows a serial number."}""");
        lines.accept("""
                {"type":"gap","name":"Frame size","kind":"ASK","prompt":"What is the frame size?","options":["M","L"]}""");
        lines.accept("""
                {"type":"gap","name":"CPU","kind":"ASK","prompt":"Which CPU?","options":[]}""");
        lines.accept("""
                {"type":"gap","name":"Condition","kind":"PHOTO","prompt":"Photograph the whole bike","options":[]}""");
        lines.accept("""
                {"type":"draft","category":"Bikes","title":"Trek Marlin 7","description":"My bike.","condition":null,
                 "facts":[{"name":"Brand","value":"Trek","source":"LABEL"},{"name":"Brand","value":"x","source":"SELLER"}]}"""
                .replace("\n", ""));
        lines.finish(List.of(7L, 8L), prices);

        assertThat(events).extracting(DraftEvent::type)
                .containsExactly(Type.DETECTION, Type.PRIVACY, Type.GAP, Type.GAP, Type.DRAFT);
        assertThat(events.get(2).gap().fact()).isEqualTo("Frame size");
        assertThat(events.get(3).gap().fact()).isEqualTo("Condition");
        ListingDraft draft = events.get(4).draft();
        assertThat(draft.photoIds()).containsExactly(7L, 8L);
        assertThat(draft.facts()).hasSize(1); // SELLER source from the AI is dropped
        assertThat(draft.privacyWarnings()).containsExactly(new ListingDraft.PrivacyWarning(2, "Shows a serial number."));
    }

    @Test void invalidLinesAreDropped() {
        lines.accept("not json");
        lines.accept("{\"type\":\"detection\",\"photo\":3,\"box\":[0,0,1,1],\"label\":\"x\"}"); // only 2 photos
        lines.accept("{\"type\":\"detection\",\"photo\":1,\"box\":[0.5,0,0.6,1],\"label\":\"x\"}"); // box leaves the image
        lines.accept("{\"type\":\"detection\",\"photo\":1,\"box\":[0,0,1,1],\"label\":\"x\","
                + "\"fact\":{\"name\":\"Shoe size\",\"value\":\"42\",\"source\":\"LABEL\"}}");
        lines.accept("{\"type\":\"gap\",\"name\":\"Frame size\",\"kind\":\"GUESS\",\"prompt\":\"?\"}");
        lines.accept("{\"type\":\"chat\"}");

        assertThat(events).isEmpty();
    }

    @Test void noDraftLineIsAnError() {
        assertThatThrownBy(() -> lines.finish(List.of(7L), prices)).isInstanceOf(ResponseStatusException.class);
    }
}
