package one.absent.hackaton.auth;

import java.security.Principal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    public enum Canton { AG, AI, AR, BE, BL, BS, FR, GE, GL, GR, JU, LU, NE, NW, OW, SG, SH, SO, SZ, TG, TI, UR, VD, VS, ZG, ZH }
    public enum ContactPreference { IN_APP, EMAIL }
    public record Register(@NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 12, max = 128) String password,
        @NotBlank @Size(max = 80) String displayName) {}
    public record ProfileUpdate(@NotBlank @Size(max = 80) String displayName,
        @NotNull @Size(max = 120) String location, Canton canton, @NotNull ContactPreference contactPreference) {}
    public record ForgotPassword(@NotBlank @Email @Size(max = 254) String email) {}
    public record ResetPassword(@NotBlank @Size(max = 128) String token,
        @NotBlank @Size(min = 12, max = 128) String password) {}
    public record Profile(long id, String email, String displayName, String location, String canton, String contactPreference) {
        static Profile of(AccountRepository.Account account) {
            return new Profile(account.id(), account.email(), account.displayName(), account.location(),
                account.canton(), account.contactPreference());
        }
    }
    public record Csrf(String headerName, String token) {}

    private final AccountService service;
    private final AccountRepository accounts;

    public AuthController(AccountService service, AccountRepository accounts) {
        this.service = service;
        this.accounts = accounts;
    }

    @GetMapping("/csrf")
    public Csrf csrf(CsrfToken token) { return new Csrf(token.getHeaderName(), token.getToken()); }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public void register(@Valid @RequestBody Register request) { service.register(request); }

    @GetMapping("/me")
    public Profile me(Principal principal) { return Profile.of(accounts.byEmail(principal.getName()).orElseThrow()); }

    @PutMapping("/me")
    public Profile update(Principal principal, @Valid @RequestBody ProfileUpdate request) {
        return Profile.of(accounts.updateProfile(principal.getName(), request.displayName().strip(),
            request.location().strip(), request.canton() == null ? null : request.canton().name(), request.contactPreference().name()));
    }

    @PostMapping("/forgot-password")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void forgotPassword(@Valid @RequestBody ForgotPassword request) { service.forgotPassword(request.email()); }

    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody ResetPassword request) { service.resetPassword(request.token(), request.password()); }
}
