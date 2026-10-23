package one.absent.hackaton.clearance;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import one.absent.hackaton.ai.AiClient;
import one.absent.hackaton.clearance.ClearanceDtos.*;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** A company's office clearance projects: inventory, route comparison and publishing. */
@Tag(name = "Clearance")
@RestController
@RequestMapping("/api/clearance/projects")
@Transactional
public class ClearanceController {
    // the image types the Anthropic API accepts
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp");
    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final int MAX_TEXT = 10_000;

    private final ClearanceProjectRepository projects;
    private final ClearanceItemRepository items;
    private final ListingRepository listings;
    private final ClearanceService service;

    public ClearanceController(ClearanceProjectRepository projects, ClearanceItemRepository items,
                               ListingRepository listings, ClearanceService service) {
        this.projects = projects;
        this.items = items;
        this.listings = listings;
        this.service = service;
    }

    @GetMapping
    public List<ProjectSummary> listProjects(@AuthenticationPrincipal Jwt user) {
        return projects.findByOwnerIdOrderByCreatedAtDesc(user.getSubject()).stream()
                .map(p -> new ProjectSummary(p.getId(), p.getCompanyName(), p.getLocality(), p.getDeadline(),
                        p.getRoute(), items.findByProjectIdOrderById(p.getId()).size())).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectDetail createProject(@Valid @RequestBody CreateProjectRequest request,
                                       @AuthenticationPrincipal Jwt user) {
        var project = new ClearanceProject();
        project.setOwnerId(user.getSubject());
        project.setCompanyName(request.companyName().strip());
        project.setPostcode(request.postcode());
        project.setLocality(request.locality().strip());
        project.setDeadline(request.deadline());
        project.setCreatedAt(Instant.now());
        return service.detail(projects.save(project));
    }

    @GetMapping("/{id}")
    public ProjectDetail getProject(@PathVariable long id, @AuthenticationPrincipal Jwt user) {
        return service.detail(project(id, user));
    }

    @PostMapping(value = "/{id}/items/extract", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProjectDetail extractItems(@PathVariable long id, @RequestPart(value = "text", required = false) String text,
                                      @RequestPart(value = "photos", required = false) List<MultipartFile> photos,
                                      @AuthenticationPrincipal Jwt user) {
        ClearanceProject project = project(id, user);
        String inventory = text == null ? "" : text.strip();
        List<MultipartFile> files = photos == null ? List.of() : photos;
        if (inventory.isEmpty() && files.isEmpty()) {
            throw status(HttpStatus.BAD_REQUEST, "Paste an inventory list or add photos.");
        }
        if (inventory.length() > MAX_TEXT) {
            throw status(HttpStatus.BAD_REQUEST, "The inventory text must be at most 10,000 characters.");
        }
        if (files.size() > 5) {
            throw status(HttpStatus.BAD_REQUEST, "Please add at most 5 photos.");
        }
        for (MultipartFile file : files) {
            if (!IMAGE_TYPES.contains(file.getContentType())) {
                throw status(HttpStatus.BAD_REQUEST, "Photos must be JPEG, PNG, GIF or WebP images.");
            }
            if (file.isEmpty() || file.getSize() > MAX_BYTES) {
                throw status(HttpStatus.BAD_REQUEST, "Each photo must be at most 5 MB.");
            }
        }
        // photos only go to the AI, they are not stored
        List<AiClient.Image> images = files.stream().map(f -> new AiClient.Image(bytes(f), f.getContentType())).toList();
        service.extract(project, inventory, images);
        return service.detail(project);
    }

    @PutMapping("/{id}/items/{itemId}")
    public ProjectDetail updateItem(@PathVariable long id, @PathVariable long itemId,
                                    @Valid @RequestBody UpdateItemRequest request, @AuthenticationPrincipal Jwt user) {
        ClearanceProject project = project(id, user);
        ClearanceItem item = item(project, itemId);
        requireUnlisted(item);
        item.setName(request.name().strip());
        item.setCategory(request.category().strip());
        item.setQuantity(request.quantity());
        item.setQuantityConfirmed(request.quantityConfirmed());
        item.setCondition(request.condition());
        item.setNotes(ClearanceService.blankToNull(request.notes()));
        item.setEstimatedUnitChf(service.estimateUnit(item.getCategory(), item.getName(), item.getCondition()));
        return service.detail(project);
    }

    @DeleteMapping("/{id}/items/{itemId}")
    public ProjectDetail deleteItem(@PathVariable long id, @PathVariable long itemId,
                                    @AuthenticationPrincipal Jwt user) {
        ClearanceProject project = project(id, user);
        ClearanceItem item = item(project, itemId);
        requireUnlisted(item);
        items.delete(item);
        items.flush();
        return service.detail(project);
    }

    @PostMapping("/{id}/items/confirm")
    public ProjectDetail confirmQuantities(@PathVariable long id, @AuthenticationPrincipal Jwt user) {
        ClearanceProject project = project(id, user);
        items.findByProjectIdOrderById(id).forEach(item -> item.setQuantityConfirmed(true));
        return service.detail(project);
    }

    @PutMapping("/{id}/route")
    public ProjectDetail chooseRoute(@PathVariable long id, @Valid @RequestBody ChooseRouteRequest request,
                                     @AuthenticationPrincipal Jwt user) {
        ClearanceProject project = project(id, user);
        project.setRoute(request.route());
        return service.detail(project);
    }

    @PostMapping("/{id}/publish")
    public ProjectDetail publishItems(@PathVariable long id, @Valid @RequestBody PublishRequest request,
                                      @AuthenticationPrincipal Jwt user) {
        ClearanceProject project = project(id, user);
        if (project.getRoute() != Route.SELF_SERVICE) {
            throw status(HttpStatus.CONFLICT, "Choose Self-service to publish listings yourself.");
        }
        List<ClearanceItem> selected = request.itemIds().stream().distinct().map(itemId -> item(project, itemId))
                .toList();
        for (ClearanceItem item : selected) {
            if (item.getListingId() != null) {
                throw status(HttpStatus.CONFLICT, item.getName() + " is already listed.");
            }
            if (!item.isQuantityConfirmed()) {
                throw status(HttpStatus.CONFLICT, "Please confirm the quantity of " + item.getName() + " first.");
            }
        }
        for (ClearanceItem item : selected) {
            item.setListingId(listings.save(listing(project, item, user.getSubject())).getId());
        }
        return service.detail(project);
    }

    private static Listing listing(ClearanceProject project, ClearanceItem item, String sellerId) {
        String notes = item.getNotes() == null ? "" : item.getNotes() + " ";
        var listing = new Listing();
        listing.setTitle(item.getName());
        listing.setDescription(ClearanceService.cut(notes + "Quantity: " + item.getQuantity()
                + " pieces, price per piece. From the office clearance of " + project.getCompanyName() + ".", 4000));
        listing.setCategory(item.getCategory());
        listing.setCondition(item.getCondition());
        listing.setPriceChf(item.getEstimatedUnitChf());
        listing.setPostcode(project.getPostcode());
        listing.setLocality(project.getLocality());
        listing.setCreatedAt(Instant.now());
        listing.setSellerId(sellerId);
        listing.setSellerName(project.getCompanyName());
        return listing;
    }

    private ClearanceProject project(long id, Jwt user) {
        return projects.findById(id).filter(p -> p.getOwnerId().equals(user.getSubject()))
                .orElseThrow(() -> status(HttpStatus.NOT_FOUND, "Clearance project not found."));
    }

    private ClearanceItem item(ClearanceProject project, long itemId) {
        return items.findById(itemId).filter(i -> i.getProjectId().equals(project.getId()))
                .orElseThrow(() -> status(HttpStatus.NOT_FOUND, "Item not found."));
    }

    private static void requireUnlisted(ClearanceItem item) {
        if (item.getListingId() != null) {
            throw status(HttpStatus.CONFLICT, "This item is already listed.");
        }
    }

    private static byte[] bytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static ResponseStatusException status(HttpStatus status, String reason) {
        return new ResponseStatusException(status, reason);
    }
}
