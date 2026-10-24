package one.absent.hackaton.auction;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Closes auctions after their end; the bid endpoint checks the end itself, so a late run lets no bid in. */
@Component
public class AuctionClose {
    private final AuctionService auctions;

    public AuctionClose(AuctionService auctions) {
        this.auctions = auctions;
    }

    @Scheduled(fixedDelay = 30_000)
    public void close() {
        auctions.closeDue();
    }
}
