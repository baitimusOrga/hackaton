package one.absent.hackaton.auth;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class RecoveryMail {
    private final JavaMailSender sender;
    private final String publicUrl;
    private final String from;

    public RecoveryMail(JavaMailSender sender, @Value("${app.auth.public-url}") String publicUrl,
                        @Value("${app.auth.mail-from}") String from) {
        URI uri = URI.create(publicUrl);
        if (uri.getHost() == null || !(uri.getScheme().equals("https") || uri.getScheme().equals("http"))
                || uri.getRawQuery() != null || uri.getRawFragment() != null || uri.getUserInfo() != null) {
            throw new IllegalArgumentException("app.auth.public-url must be an absolute HTTP(S) URL");
        }
        this.sender = sender;
        this.publicUrl = publicUrl.replaceAll("/+$", "");
        this.from = from;
    }

    public void send(String email, String token) {
        var message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("Reset your hackaton password");
        // Fragment avoids putting the secret in HTTP access logs or referrer headers.
        message.setText("Reset your password using this link within 30 minutes:\n\n"
            + publicUrl + "/reset-password#token=" + token
            + "\n\nIf you did not request this, you can ignore this email.");
        sender.send(message);
    }
}
