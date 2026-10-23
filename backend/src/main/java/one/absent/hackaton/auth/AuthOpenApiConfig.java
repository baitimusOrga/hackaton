package one.absent.hackaton.auth;

import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AuthOpenApiConfig {
    @Bean
    OpenApiCustomizer sessionEndpoints() {
        // Spring Security handles these before MVC; document them for the generated client.
        return api -> {
            var loginBody = new ObjectSchema()
                .addProperty("email", new StringSchema()).addProperty("password", new StringSchema())
                .addRequiredItem("email").addRequiredItem("password");
            api.path("/api/auth/login", new PathItem().post(new Operation().operationId("login")
                .addTagsItem("Accounts").summary("Sign in and rotate the session")
                .requestBody(new RequestBody().required(true).content(new Content()
                    .addMediaType("application/x-www-form-urlencoded", new MediaType().schema(loginBody))))
                .responses(new ApiResponses().addApiResponse("204", new ApiResponse().description("Signed in")))));
            api.path("/api/auth/logout", new PathItem().post(new Operation().operationId("logout")
                .addTagsItem("Accounts").summary("Invalidate the current session")
                .responses(new ApiResponses().addApiResponse("204", new ApiResponse().description("Signed out")))));
        };
    }
}
