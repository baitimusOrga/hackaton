package one.absent.hackaton.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public: which environment and release is running. */
@RestController
public class InfoController {

    public record Info(String env, String release, String revision) {
    }

    private final Info info;

    public InfoController(@Value("${app.env}") String env, @Value("${app.release}") String release,
                          @Value("${app.revision}") String revision) {
        this.info = new Info(env, release, revision);
    }

    @GetMapping("/api/info")
    public Info info() {
        return info;
    }
}
