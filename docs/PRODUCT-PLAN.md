# Swiss Secondhand Marketplace — Product Plan

Working concept: a free Swiss marketplace with intelligent selling, personal buying assistants, auctions, and business equipment liquidation.

Prepared: 23 October 2026. This is a product vision and decision document. It contains no implementation schedule, technical architecture, or hackathon time limit.

## 1. Product promise

**Photograph what you want to sell. Describe what you want to buy. Get help completing a trustworthy trade.**

For companies: **Show us what needs to go, tell us your deadline, and choose how much work you want us to handle.**

The product combines a consumer marketplace with a business liquidation service. It should make trading simpler through accurate item information, relevant matches, transparent pricing, and practical support before and after a sale.

The advantage is the complete experience: identifying an item, connecting it to real demand, agreeing a deal, and completing payment or handover. AI features should improve that experience rather than become a separate chatbot people must learn to operate.

## 2. Decisions and assumptions

### Confirmed requirements

| Area | Decision |
|---|---|
| Initial market | Switzerland first. |
| Core pricing | No listing fees and no sales commission. Optional services may cost extra. |
| Shopping search | Buyer assistants search our marketplace only. |
| Consumer features | Used goods, chat, auctions, fraud detection, photo-based listing creation, price recommendations, and automated searches with notifications. |
| Business features | Companies can sell equipment themselves, use a managed liquidation service, or sell stock to the platform for resale. |
| Planning scope | Full product vision; do not constrain ideas by hackathon duration. |
| Repository | Do not change the repository without a later instruction. This document is stored separately. |

### Proposed defaults requiring later agreement

- CHF, postcode-based discovery, pickup and shipping, and German/French/Italian/English support.
- Private sellers and clearly identified professional sellers can participate.
- Timed auctions with live bidding are part of the core marketplace. Livestream video auctions are an optional product extension.
- Direct payment arrangements and optional protected checkout can coexist, with the protection of each path explained.
- Basic listing assistance, buyer alerts, chat, and essential safety features are free. Heavy business usage and managed services may have optional charges.
- Electronics and office equipment serve as reference categories for precise identification and liquidation workflows. The full vision supports other secondhand categories.
- Machinery sales and liquidation are supported, while direct purchases depend on inspection, handling capability, and category expertise.

## 3. Customers and the jobs we solve

| Customer | Main job | Desired result |
|---|---|---|
| Occasional private seller | Sell an unused item without learning how to write an advert or price it. | A useful listing, an acceptable price, and a straightforward handover. |
| Specific-item buyer | Find a particular model or specification without repeatedly searching. | A small number of accurate, explainable matches. |
| Local buyer | Find practical items nearby. | Clear condition, location, collection arrangements, and total cost. |
| Auction participant | Compete for an item without confusing rules. | Understandable bidding, fair closing rules, and a clear result. |
| Company clearing equipment | Remove equipment with limited staff effort and a known deadline. | An agreed selling or clearance route and a reconciled outcome. |
| Refurbisher or reseller | Buy suitable stock consistently, including lots. | Reliable inventory details, inspections, and coordinated collection. |
| Business administrator | Track approvals, assets, receipts, and proceeds. | One project record and a complete financial reconciliation. |

## 4. End-to-end product journeys

### Private seller

1. Photograph the item, label, accessories, and defects.
2. Review the proposed identification and answer a short list of missing questions.
3. See a price recommendation with evidence and confidence.
4. Choose fixed price, negotiable price, auction, bundle, or giveaway.
5. Confirm delivery or pickup details and publish.
6. Respond to questions, receive offers or bids, and agree a sale.
7. Complete payment and delivery or pickup.
8. Confirm the outcome, resolve any issue, and leave transaction-linked feedback.

### Buyer with specific requirements

1. Describe the desired item in normal language.
2. Confirm editable requirements, budget, location, and delivery preferences.
3. Receive confirmed matches, possible matches, and explicitly labelled alternatives.
4. Compare total costs, specifications, condition, and seller information.
5. Ask a question, make an offer, buy, or bid.
6. Follow the appropriate payment and fulfilment process.
7. Pause the search once the purchase is complete.

### Company liquidation

1. Create one clearance project and specify location, scope, and deadline.
2. Upload an inventory, photographs, or a walkthrough video.
3. Review the proposed item list and identify unknowns.
4. Compare self-service selling, managed selling, and an outright purchase offer where available.
5. Approve the chosen strategy, scope, and costs.
6. Complete inspections, listings, sales, collection, or the direct sale.
7. Receive a report covering sold items, remaining items, service costs, and proceeds.

## 5. Marketplace foundation

### Listings and discovery

Support fixed prices, optional negotiation, timed auctions, bundles, quantity-based listings, and free giveaways. Browse without an account; require an account for messaging, bidding, buying, and selling.

Every listing should explain:

- Exact item identity where known, with category-specific attributes.
- Condition, defects, functionality, and testing status.
- Included and missing accessories.
- Item location, pickup requirements, shipping options, and known charges.
- Seller type, relevant verification, and transaction history.
- Sale format, price or current bid, and applicable deadlines.

Useful filters include distance, price, total known cost, condition, sale format, shipping availability, and structured category attributes. Search should work across supported languages and preserve access to the original listing text.

Sold or reserved items must stop appearing as available. Quantity-based listings must reflect remaining units. A new transaction must not silently compete with an existing accepted sale for the same item.

### Main customer areas

| Area | Purpose |
|---|---|
| Discover | Browse, filter, compare, and inspect items. |
| Sell | Camera intake, drafts, pricing, publication, and seller activity. |
| My searches | Requirements, recommendations, alerts, and feedback. |
| Purchases and sales | Payment, delivery, collection, issues, and reviews. |
| Business projects | Inventory, approvals, liquidation routes, and reporting. |
| Profile and settings | Trust information, privacy, language, and notifications. |

## 6. Camera-first selling and item identification

The assistant should combine photographs, label reading, barcode information where available, seller answers, and suitable product reference information to produce a draft.

It can suggest the category, title, model, specifications, description, condition checklist, and additional photographs needed. It must separate facts read from a label, facts confirmed by the seller, and unconfirmed suggestions.

If identification is uncertain, ask a focused question or request a specific view. For example: “This identifies the product family, but not the exact variant. Please photograph the model information.”

Do not infer internal components, working condition, ownership, or included accessories from appearance alone. Product documentation can describe possible configurations; it does not prove an individual item's current configuration.

Photographic help should improve framing and clarity while retaining visible defects. Preserve originals for the transaction record. Detect potentially private information such as personal documents, serial identifiers, employee labels, or screens, and let the seller review what becomes public.

Additional convenience features:

- Voice descriptions and guided category questions.
- Multiple-item intake that produces separate drafts or proposed bundles.
- Draft saving and reuse of earlier listing information.
- Category-specific completeness checks before publication.
- A final seller review rather than automatic publication by default.

## 7. Price recommendations

Show a range with an explanation, comparable evidence, its age, and the confidence of the estimate. Prefer relevant completed sales over unsold asking prices. Adjust comparisons for model, condition, accessories, location, and sale format when evidence supports doing so.

Offer three suggested strategies: competitive pricing for a faster sale, a balanced asking price, and a higher asking price with greater uncertainty. Do not promise a sale date without adequate evidence.

Auction advice should distinguish an estimated result from the minimum price the seller accepts. The seller controls the price and must approve automatic reductions explicitly.

**Cold-start rule:** our marketplace initially has limited sales history. When evidence is insufficient, label the estimate provisional or decline to estimate. The language model explains evidence; it does not manufacture comparables or transaction history.

Using permitted external reference data for valuations remains a decision to settle. It would not change the confirmed rule that buyer searches only return offers from our marketplace.

For bulk stock, show expected individual-sale proceeds, lot-sale proceeds, service costs, and uncertainty separately. An inventory owner's desired price is not itself evidence of resale value.

## 8. Personal buying assistant

Example request: “Find a working 2017 iMac with a 5K display, within my total budget, available for pickup near Zürich.”

Translate the request into visible, editable requirements. Separate mandatory requirements from preferences. Let the buyer define whether unknown specifications are acceptable for review.

Every result belongs to one of three groups:

| Result | Meaning |
|---|---|
| Confirmed match | Available listing evidence supports every mandatory requirement. |
| Possible match | A required detail is missing or needs confirmation. |
| Alternative | A requirement differs, with the difference clearly explained. |

Explain why an item appears, the available price evidence, total known cost, and important questions to ask. Do not treat a cheap current auction bid as its final purchase price.

Notifications should support immediate strong matches, daily shortlists, weekly digests, price reductions, relevant listing updates, and auction reminders. Deduplicate relisted items and repeat alerts. Disclose when a scan was last completed and when results may be incomplete.

Feedback such as “wrong model,” “too far,” and “already considered” should improve the search without silently changing mandatory requirements. Offer pause, expiry, quiet hours, and easy deletion.

The assistant can prepare comparisons and draft questions. Sending messages, purchasing, and placing bids require explicit user action or a separately configured authorization. No independent shopping agent should place unlimited bids or make purchases by default.

## 9. Auctions

Core auction features include live bid updates, a clear end time, visible increments, private maximum bids, automatic bidding within that maximum, and a disclosed extension rule for late bids.

The interface should explain why a person was outbid and distinguish their maximum from the current winning price. Private maximum bids must not be exposed to sellers or other buyers.

Before launch, define understandable policies for equal maxima, connection interruptions, platform outages, seller cancellation, unpaid wins, buy-now interactions, and any second-chance offers. A losing bidder must explicitly accept a later offer; it must not become a purchase automatically.

Preserve material listing details once bids exist. Corrections must be visible and have a defined remedy when they change what bidders understood they were buying.

Detect suspected self-bidding, related-account bidding, and auction manipulation, with human review and an appeal path.

Livestream auctions remain a separate proposed experience involving video demonstrations, moderation, event management, and its own clear closing rules.

## 10. Chat, agreements, payments, and fulfilment

### Communication

Attach conversations to the item and transaction. Support photos, translation, offers, counteroffers, pickup scheduling, blocking, and reporting. Keep public item questions separate from private personal arrangements.

AI may draft questions and replies using confirmed facts. Users review and authorize messages. Capture the accepted price, included items, delivery method, and relevant promises in a deal summary.

### Pickup

Support appointment windows, access instructions, inspection checklists, agreed payment arrangements, and a handover record. Reveal precise addresses only when necessary. A handover confirmation must clearly explain what it confirms.

### Shipping

Show available shipping options and costs, address confirmation, dispatch status, tracking, and a process for non-delivery or damage. Do not imply that an external payment or shipping arrangement has platform protection when it does not.

### Payments and problems

Proposed payment choices are direct arrangements and optional integrated protected checkout. Explore locally suitable methods such as TWINT without committing to an unverified provider capability.

Any protection service needs explicit coverage, exclusions, charges, deadlines, evidence requirements, payout conditions, and human resolution responsibilities. Define how non-payment, non-collection, damaged goods, and material description differences are handled for each transaction type.

Only verified transaction events should mark a payment received. A chat message, screenshot, or email claim must not change payment status by itself.

## 11. Trust, safety, and marketplace operations

Consider signals across listings, accounts, messages, auctions, and transactions. Examples include reused photographs, inconsistent item information, suspicious links, unusual account changes, repeated complaints, and related bidding activity. A low price is a signal to investigate, not proof of fraud.

Use proportional interventions: helpful prompts, additional evidence, verification requests, warnings, temporary restrictions, or human review. Explain actionable concerns without publishing a simplistic “safe” score or exposing private detection details.

Trust information should be specific: completed transactions, transaction-linked reviews, account history, and clearly named verification checks. New legitimate users need a fair route to establish trust.

Protect both sides against non-payment, false payment claims, harassment, misleading listings, and return substitution. Provide reporting, blocking, review safeguards, and appeals.

The operational workspace needs report queues, case ownership, transaction context, decision history, dispute handling, account recovery, and escalation. Category rules should define prohibited goods and goods requiring specialized handling or review.

Privacy controls, account deletion, accessible interfaces, and understandable control over AI use of private information belong in the product from the outset.

## 12. Business selling and liquidation

### Three service models

| Model | Ownership and work | Commercial model |
|---|---|---|
| Self-service | Company retains ownership, approves listings, and manages its sales. | No listing fees or sales commission. Optional business tools or services may cost extra. |
| Managed selling | Company retains ownership until sale; we perform agreed valuation, sales, and collection coordination. | An optional managed-service charge agreed upfront. |
| Direct purchase | We buy defined inventory under a purchase agreement, take ownership, and resell it. | We bear inventory risk and earn any resale margin. |

Managed-service charges must not appear unexpectedly as ordinary marketplace commission. The company should see its expected net outcome and the work included before agreeing.

### Intake and inventory

Accept spreadsheets, individual photos, asset labels, and walkthrough videos. Produce a reviewable inventory with item identity, quantity, condition, testing status, accessories, internal reference, location, and unanswered questions.

Do not assume similar-looking objects are identical or count video observations as a verified inventory. Reconcile duplicates and request quantity confirmation.

Record the clearance deadline, building access, lift capacity where relevant, loading facilities, disassembly needs, installed equipment, and permitted collection hours. Keep confidential site information private.

### Selling strategy

Recommend individual sales, useful bundles, category lots, or a whole-site sale. Explain the tradeoffs between proceeds, speed, labour, and certainty.

Allow public listings, private invitations to suitable buyers, inspections, negotiated offers, and clearly defined lot auctions. Prevent the same asset from being committed through both an individual sale and an overlapping lot.

Offer whole-lot-only and partial-purchase options explicitly. For graded or mixed-condition stock, show what was tested, what was sampled, and what remains unknown. Establish whether quantities are exact or provisional before a binding agreement.

### Project administration

Support multiple staff roles, internal approvals, reserve or minimum-return instructions, cost approvals, and asset-level status. Record offers, reservations, sales, collections, unresolved items, and payouts in one project.

Provide buyer documentation, suitable invoice details, and a final reconciliation of proceeds and agreed service charges. The company must be able to account for what happened to each asset or lot.

### Electronics and machinery

For electronics, include functionality checks, accessory checks, activation-lock status, data-removal responsibilities, and evidence of any wiping service actually performed.

For machinery, capture specifications, operating condition, maintenance information where available, inspection arrangements, dimensions, weight, and specialist removal requirements. Clarify who handles disconnection, lifting, transport, and site damage responsibilities before collection.

Confirm the seller's authority to dispose of equipment and resolve declared ownership or financing restrictions before committing to sale or purchase.

## 13. Platform-owned inventory and complete clearance

### Direct purchase workflow

Initial inventory → indicative offer → inspection and verification → firm purchase agreement → agreed payment and ownership transfer → collection → testing or refurbishment → resale.

Keep estimated resale value, our purchase offer, and managed-sale expected proceeds distinct. The purchase offer accounts for collection, storage, testing, repair, unsold stock, and uncertainty. Do not present a speculative resale valuation as a guaranteed cash offer.

Define which categories we will purchase, inspection standards, purchasing authority, inventory capacity, and what happens when the inspected lot differs from the original description.

Disclose platform-owned items through an identifiable seller account. Show their actual condition and any testing or refurbishment performed. Independent valuation explanations and search ranking must not quietly favour our purchasing or resale interests.

### Complete clearance option

An optional service could promise a defined outcome such as clearing an agreed space by a date. Its scope must specify items included, exclusions, access requirements, and the handling of unsellable stock.

Arrange reuse, donation, or appropriate recycling through suitable partners where required. Never assume every item has positive resale value. Quote removal costs and possible residual inventory obligations clearly.

Decisions remain open on whether we operate storage and logistics ourselves, use partners, or combine both, and whether some direct purchase offers come from disclosed third-party buyers.

## 14. Additional product opportunities

| Feature | Customer value | Product boundary |
|---|---|---|
| Wanted listings | Buyers express demand before an item is listed. | Buyers control visibility and contact preferences. |
| Demand before listing | Sellers see anonymized interest for their item. | Do not expose buyer identities, private budgets, or confidential saved searches. |
| Category inspection guides | Buyers know what to check during inspection. | Explain what remains unverified. |
| Compatibility assistance | Find parts and accessories suitable for an existing item. | Distinguish confirmed compatibility from a possibility. |
| Household clear-out projects | Organize many items and coordinate collections. | Support separate items, bundles, and confidential locations. |
| Same-seller bundles | Reduce repeated negotiation, shipping, and pickup. | Show itemized contents and agreed total. |
| Resale history | Reuse a previously purchased item's information with consent. | Require an updated condition declaration and hide previous private data. |
| Repair and parts matching | Connect broken items to repairers and parts buyers. | Clearly label defects and incomplete testing. |
| Business buying requests | Source multiple matching items or recurring lots. | Define acceptable variation, quantity, and collection requirements. |
| Private liquidation previews | Let appropriate buyers inspect stock before public sale. | Company controls access and publication. |

The most distinctive opportunities are accurate requirement matching, evidence-backed pricing, wanted listings, anonymized demand signals, and a single project covering a complete company clearance.

## 15. Supply, sustainability, and product priorities

### Build useful supply and demand together

Use category communities, local clear-outs, universities, refurbishers, and company liquidation to create relevant inventory. Give sellers shareable listing pages and profiles. Business equipment can serve private buyers, other companies, repairers, and resellers.

Wanted listings capture demand before stock exists. Bulk intake makes it easier for companies to respond. Success requires actual available items and reliable fulfilment; inventory volume alone is insufficient.

### Sustain the free marketplace

Keep core listing and sales commission at zero. Candidate revenue sources include optional professional tools, managed liquidation, collection or delivery services, protected checkout, and resale margin on inventory we purchase.

Show optional charges before commitment. Decide explicitly how heavy automated or bulk usage is handled. Do not make essential safety a paid privilege.

Search and buying-assistant ranking should follow relevance and user needs. If sponsored placements are introduced, label and separate them clearly from independent recommendations.

### Product importance, without a timetable

1. Foundation: accurate listings, discovery, chat, sale agreements, auctions, fulfilment, support, and trust.
2. Differentiation: guided camera intake, transparent prices, requirement-based buyer agents, and wanted-demand matching.
3. Business service: bulk inventory, liquidation projects, managed selling, inspections, and direct purchasing.
4. Expansion: complete clearance, specialist machinery handling, advanced compatibility, and livestream auctions if justified by customer demand.

These are product dependencies and importance levels, not a hackathon schedule. Optional services must be supported by a real operational process before the product promises them.

## 16. Success measures and product acceptance

Primary outcome: **completed trades that both parties consider successful.**

Track listing completion, identification corrections, time to a useful match, recommendation relevance, time to sale, successful fulfilment, repeat participation, disputes, and support resolution. Track both missed fraud and legitimate users incorrectly restricted.

For business liquidation, track company staff effort, clearance completion, actual net proceeds against the agreed estimate, reconciliation accuracy, unsold stock, and repeat business. For owned inventory, include handling costs, time held, unsold items, and realized margin.

Example acceptance scenarios:

- An uncertain model label leads to a clarification rather than an invented specification.
- A buyer requiring a particular display specification sees an unverified item as a possible match, not a confirmed match.
- A price estimate with insufficient comparable sales visibly communicates that limitation.
- An auction participant understands automatic bidding and the published extension rule.
- A payment screenshot cannot independently mark a transaction paid.
- A company can import a lot, correct its quantities, approve a selling route, and account for the outcome of every asset.
- An asset cannot be sold individually after it has been committed as part of an accepted lot.
- Platform-owned stock is visibly identified and does not receive hidden ranking preference.

## 17. Decisions still to make

1. Timed live bidding only, or livestream video auctions too?
2. Confirm participation by professional sellers and the distinction from private sellers.
3. Confirm direct payment arrangements alongside optional protected checkout, and define the protection service.
4. Decide whether permitted external reference data may support valuations; shopping search remains internal only.
5. Decide which inventory categories we will buy ourselves and which we only broker.
6. Choose owned storage and logistics, partner services, or a combination.
7. Decide whether complete clearance includes arranging donation or recycling of unsold goods.
8. Choose the primary brand emphasis: personal trading assistant, local community marketplace, or bargain discovery.

## 18. Reference product stories

**Consumer story:** A seller photographs an iMac and its label. The assistant asks for missing information, creates an accurate draft, and explains its pricing suggestion. A buyer's saved requirements identify it as a suitable match. They clarify condition in chat, agree the purchase, inspect the item at pickup, and record the handover.

**Business story:** An office manager uploads photographs and an inventory of monitors, desks, chairs, and equipment. The company reviews quantities and access details, compares managed selling with a whole-lot purchase offer, and approves a route. Items are allocated without overlapping sales, collection is coordinated, and the company receives a reconciled completion report.

**Machinery story:** A company submits a machine with label photographs, condition details, and site information. Suitable buyers receive a relevant match, arrange an inspection, and bid or negotiate with clear removal requirements. A specialist handles collection under the agreed scope.

## 19. Competitive reference

Ricardo already describes photo-based AI listing creation, price estimates, and saved-search notifications. Those features alone are insufficient differentiation. Our proposed distinction is accurate item identification, transparent evidence, requirement-aware matching, integrated trade completion, and business liquidation.

Official references consulted during the planning conversation:

- [Ricardo: ways to create listings, including Ricardo AI](https://help.ricardo.ch/hc/de/articles/115002488565-Auf-welche-Arten-kann-ich-Angebote-erstellen)
- [Ricardo: creating an attractive listing and price-estimation context](https://help.ricardo.ch/hc/de/articles/20585436756892-Wie-erstelle-ich-ein-attraktives-Angebot)
- [Ricardo: search and saved-search notifications](https://communication.ricardo.ch/news/produkt-news/angebote-auf-ricardo-finden/)

These references provide competitive context. The feature choices, service models, and proposed rules in this document are product recommendations rather than claims that those capabilities already exist in our product.
