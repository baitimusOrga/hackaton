package one.absent.hackaton.auction;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import one.absent.hackaton.auction.AuctionDtos.AuctionState;
import one.absent.hackaton.auction.AuctionDtos.PlaceBidRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** Watching an auction is public, bidding needs an account. */
@Tag(name = "Auctions")
@RestController
@RequestMapping("/api/listings/{id}/auction")
public class AuctionController {
    private final AuctionService auctions;

    public AuctionController(AuctionService auctions) {
        this.auctions = auctions;
    }

    @GetMapping
    public AuctionState getAuction(@PathVariable long id, @AuthenticationPrincipal Jwt viewer) {
        return auctions.get(id, viewer == null ? null : viewer.getSubject());
    }

    @PostMapping("/bids")
    public AuctionState placeBid(@PathVariable long id, @Valid @RequestBody PlaceBidRequest request,
                                 @AuthenticationPrincipal Jwt bidder) {
        return auctions.placeBid(id, bidder, request.maxChf());
    }
}
