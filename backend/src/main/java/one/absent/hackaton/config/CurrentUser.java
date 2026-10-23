package one.absent.hackaton.config;

/** Identity verified by the resource server, never taken from a request body. */
public record CurrentUser(String id, String name, String email) {}
