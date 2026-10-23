package one.absent.hackaton.auth;

import java.security.Principal;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@Tag(name = "Accounts")
@RequestMapping("/api/auth")
public class AuthController {
    public enum Canton { AG, AI, AR, BE, BL, BS, FR, GE, GL, GR, JU, LU, NE, NW, OW, SG, SH, SO, SZ, TG, TI, UR, VD, VS, ZG, ZH }
    public enum ContactPreference { IN_APP, EMAIL }
    public record Register(@NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 12, max = 128) String password,
        @NotBlank @Size(max = 80) String displayName) {}
    public record ProfileUpdate(@NotBlank @Size(max = 80) String displayName,
        @NotNull @Size(max = 120) String location, @Schema(nullable = true) Canton canton, @NotNull ContactPreference contactPreference) {}
    public record ForgotPassword(@NotBlank @Email @Size(max = 254) String email) {}
    public record ResetPassword(@NotBlank @Size(max = 128) String token,
        @NotBlank @Size(min = 12, max = 128) String password) {}
    public record Profile(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String displayName,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String location,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true) Canton canton,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) ContactPreference contactPreference) {
        static Profile of(Account account) {
            return new Profile(account.getId(), account.getEmail(), account.getDisplayName(), account.getLocation(),
                account.getCanton() == null ? null : Canton.valueOf(account.getCanton()),
                ContactPreference.valueOf(account.getContactPreference()));
        }
    }
    public record Csrf(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String headerName,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String token) {}

    private final AccountService service;
    private final AccountRepository accounts;

    public AuthController(AccountService service, AccountRepository accounts) {
        this.service = service;
        this.accounts = accounts;
    }

    @GetMapping("/csrf")
    public Csrf csrf(@io.swagger.v3.oas.annotations.Parameter(hidden = true) CsrfToken token) {
        return new Csrf(token.getHeaderName(), token.getToken());
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public void register(@Valid @RequestBody Register request) { service.register(request); }

    @GetMapping("/me")
    public Profile me(Principal principal) { return Profile.of(accounts.findByEmail(principal.getName()).orElseThrow()); }

    @PutMapping("/me")
    public Profile update(Principal principal, @Valid @RequestBody ProfileUpdate request) {
        return service.updateProfile(principal.getName(), request);
    }

    @PostMapping("/forgot-password")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void forgotPassword(@Valid @RequestBody ForgotPassword request) { service.forgotPassword(request.email()); }

    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody ResetPassword request) { service.resetPassword(request.token(), request.password()); }
}
