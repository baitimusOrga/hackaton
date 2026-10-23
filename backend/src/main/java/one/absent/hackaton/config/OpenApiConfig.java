package one.absent.hackaton.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.servers.Server;
import org.springframework.context.annotation.Configuration;

/** Swagger UI at /api/docs. */
@Configuration
@OpenAPIDefinition(info = @Info(title = "hackaton API"), servers = @Server(url = "/"))
public class OpenApiConfig {
}
