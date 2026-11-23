# Figma cleanup: eneba.com import

Figma file: `jaipl50e6EpTMnsmzMTzD2` (imported with html.to.design).
Tokens: [`tokens.json`](./tokens.json) (DTCG format).

This file records what has been applied in Figma, what is still left, and the naming map, so the
next agent can build React and Tailwind components from it.

## 1. Status (2026-11-23)

The Figma account is on the **Starter plan**. That caps a file at 3 pages, and the Figma MCP
tool-call limit cut the cleanup off partway through.

| Step | State |
|---|---|
| Pages `00 Tokens`, `01 Components`, `02 Screens` | ✅ done |
| Deleted broken product duplicate (frame `5:1745`) | ✅ done |
| Sections renamed: `02 Home`, `04 Product`, `05 Cart & Checkout` (Cart and Checkout merged into one section), `06 Auth` | ✅ done |
| Frames renamed (see §2) | ✅ done |
| **Home**: 881 renames and 68 invisible layers deleted | ✅ done. Screenshot check still pending |
| Home: 18 `Background` layers inside some `ProductCard`s were not renamed | ⏳ needs a look (probably the image wrapper in some cards) |
| Product, Cart & Checkout, Auth renames and deletions | ⏳ not started |
| Replace the real email in the Cart input (`5:2200`) with `you@example.com` | ⏳ not started |
| Variables on `00 Tokens` (created, **not bound**) | ⏳ not started |
| Component masters on `01 Components` (screens stay as they are) | ⏳ not started |

Every change so far is a rename, a page/section move, or the deletion of an invisible layer
(no fill, stroke or effect, not a mask). None of them changes how anything looks.

## 2. Structure

The intended pages were 00 Tokens / 01 Components / 02 Home / 04 Product / 05 Cart & Checkout /
06 Auth. On Starter, the screen groups are **sections on `02 Screens`** instead:

| Section | Frame | Node |
|---|---|---|
| `02 Home` | `Home / Desktop 1512` | `5:5` |
| `04 Product` | `Product / Desktop 1512` | `7:3` |
| `05 Cart & Checkout` | `Cart / Desktop 1512`, `Checkout / Payment – Loading` | `5:2076`, `5:2561` |
| `06 Auth` | `Login / Desktop 1512` | `5:1663` |

There is no Store (catalog) or Orders screen in the import.
Known quirks of the frames themselves (left as they are):
- The Home frame is 4550 px tall, but its content ends around 3570 px.
- `Checkout / Payment` shows only the header, the stepper and a spinner.
- **No auto-layout anywhere.** Everything is absolutely positioned.

## 3. Naming rules

- Components use PascalCase, with a slash for variants: `ProductCard`, `Button/Primary`, `Badge/Cashback`.
- Inner layers use descriptive camelCase: `coverImage`, `title`, `platformIcon`, `price`.
- `Item → Link → X` / `Link → X` (text) becomes `xLink`. `Button → X` becomes `xButton`.
- `Strong → X`, `Label → X` and `List → Item → X` become camelCase of the content.
- `Heading N → X` becomes `heading`. A `Heading 2` frame becomes `SectionHeading` (`title`, `infoIcon`).
- A plain `SVG` frame becomes `icon`, or a specific name (`searchIcon`, `cartIcon`) where the purpose is known.
- `Vertical/Horizontal Divider` becomes `divider` (or `oldPriceStrike` inside a price).
- Layers marked **`(reference — do not export)`** are Eneba or third-party artwork. Use them only as
  visual reference and never export them as assets (CLAUDE.md: no copyrighted logos or illustrations).
- Vector internals of icons (`Vector`, `Group`, `Clip path group`, `svg-…__a` masks) are left alone.

## 4. Rename map

### Shared: Header (`5:6` Home, `7:4` Product)
| Current | New |
|---|---|
| `Header` | `Header` |
| `Link - Eneba → Eneba logo` | `logo (reference — do not export)` |
| `Form` / `SVG` / `Border` / `Combobox - Search` / `Container` / text | `SearchBar` / `searchIcon` / `field` / `input` / `placeholderBox` / `placeholder` |
| `Button - Settings` (`global`, `English EU`, divider, `JPY`) | `LocaleSwitcher` (`globeIcon`, `language`, `divider`, `currency`) |
| `Link - Wishlist → SVG` | `wishlistButton` |
| `Button - My shopping cart → SVG`, `Strong` / `1` | `cartButton`, `cartCount` / `count` |
| `Link` (`SVG`, `Log in`), `" \| "`, `Link → Register` | `loginLink` (`userIcon`, `label`), `separator`, `registerLink` |
| `Nav` / `List` | `MainNav` / `navList` |
| `Item → Link` (Categories) / `SVG` / text | `categoriesMenuButton` / `menuIcon` / `label` |
| Nav text links | `cheapGamesLink`, `softwareLink`, `egiftCardsLink`, `enebaGiftCardsLink` |
| GTA 6 / Black Week pills (`7:69`, `7:73`) | `promoPill/Gta6`, `promoPill/BlackWeek` (reference — do not export) |

### Shared: Footer (`5:1378` Home, `7:894` Product)
| Current | New |
|---|---|
| `Footer` | `Footer` |
| `Background` (41 px) / `List` / `Item → *.svg` | `PaymentMethodsStrip (reference — do not export)` / `logos` / `paymentLogo/{EnebaWallet,PayPal,Card,ApplePay,GooglePay,AliPay,Crypto,PayNow}` |
| 5× `List` of links | `linksAbout`, `linksBuy`, `linksHelp`, `linksCommunity`, `linksBusiness` (first text is `heading`, the rest are `xLink`) |
| `Follow us`, social `List` | `followUsTitle`, `socialLinks` (`facebookLink`, `xLink`, `instagramLink`, `discordLink`, `redditLink`) |
| `Background+Shadow` (Editor's Choice) | `pcMagBadge (reference — do not export)` |
| `Download the App`, `Link → Google play badge`, `Link → Apple badge` | `downloadAppTitle`, `appBadge/GooglePlay (reference…)`, `appBadge/AppStore (reference…)` |
| `See our reviews on`, `Iframe → Html → Body` | `reviewsTitle`, `trustpilotWidget (reference — do not export)` |
| `Get personalized game deals`, `Form` (`Input…`, `Button`) | `newsletterTitle`, `NewsletterForm` (`emailInput`, `Button/Primary`) |
| `You can unsubscribe…`, `Button - Settings`, `Copyright…`, `Button → Cookie preferences`, `.` | `newsletterNote`, `LocaleSwitcher`, `copyright`, `cookiePrefsLink`, `period` |

### Shared: ProductCard (45 cards: 35 Home, 5 Product, 5 Cart)
| Current | New |
|---|---|
| `Background+Border` | `ProductCard` |
| image frame named after the product | `coverImage` |
| `Link` rectangle (no paint) | **delete** |
| lower `Background` | `body` |
| `Background` 99×30 / `SVG` / `Cashback` | `Badge/Cashback` / `icon` / `label` |
| `Overlay+OverlayBlur` / platform image / `Container` / text | `platformBar` / `platformIcon` / `platformNameBox` / `platformName` |
| `Container` (36 h) / text | `titleBox` / `title` (a `DLC` tag inside becomes `dlcTag`) |
| `Container` (12 h) / text | `regionBox` / `region` |
| `From`, larger `¥…`, `N% Cashback` | `priceLabel`, `price`, `cashbackAmount` |
| `-52%`, smaller `¥…`, `Horizontal Divider`, `SVG` | `discountPercent`, `oldPrice`, `oldPriceStrike`, `priceInfoIcon` |
| `Button - Add to cart …` (yellow rectangle clipped off the bottom) | `addToCartHover` (kept, it's the hover state) |
| `Rectangle` (no paint) | **delete** |

### 02 Home: `Home / Desktop 1512` (`5:5`), applied
| Current | New |
|---|---|
| `Main` | `content` |
| `Main/List` (`5:1370`) / `Item` / `Button` | `HeroBanners (reference — do not export)` / `bannerMain`, `bannerSide` / `image` |
| `Main/Nav` (`5:80`) / 19× `Link` (`SVG`, text) | `CategoryShortcuts` / `CategoryShortcut` (`icon`, `label`) |
| `Button - Show previous/more categories` / `SVG` | `scrollPrevButton`, `scrollNextButton` / `chevronIcon` |
| `Section 5:214` | `RecommendedSection` |
| `Section 5:353` / `Overlay` | `TopGamesSection` / `sectionBand` |
| `Section 5:836` / 15× `Link → <hash>.jpg` | `EGiftCardsSection` / `GiftCardTile (reference — do not export)` |
| `Section 5:860` | `GiftCardsSection` |
| `Heading 2` inside sections | `SectionHeading` (`title`, `infoIcon`) |
| inner `Section` | `cardRow` |
| `Link - See all…` / `Link - Show all…` | `Button/Outline` (`label`) |

### 04 Product: `Product / Desktop 1512` (`7:3`), still to do
| Current | New |
|---|---|
| `Main` (`7:78`) | `content` |
| `List` (`7:79`) / `Item` / `Border` 8×8 | `Breadcrumbs` / `crumb` / `chevron` |
| `Picture → …` (`7:101`) | `coverImage` |
| `Border` (`7:102`) "Cashback deal" | `Badge/CashbackDeal` |
| `Heading 1 → …` (`7:104`) | `productTitle` |
| `Button - Add to wishlist` (`7:105`) | `wishlistButton` (`icon`, `count`) |
| `•`, `Strong → 105 people…` | `liveDot`, `watchersCount` |
| `Iframe → Html → Body` (`7:116`) | `trustpilotWidget (reference — do not export)` |
| `Background+Shadow` (`7:144`) | `FeaturedOfferPanel`: `label`, `price`, `priceNote`, `priceInfoIcon`, `Badge/BestCashback`, `cashbackIcon`, `cashback`, `Button/PayPal`, `Button/Primary`, `Button/AddToCart`, `moreOffersLink` |
| `Background+Shadow` (`7:187`) | `SafeCheckoutPanel`: `title`, `paymentMethods` (`paymentChip/*`), `dataProtection` (`scamAdviser (reference…)`, `trustScore`), `shieldIcon`, `pcMagBadge (reference…)` |
| `Background+Shadow` (`7:348`) | `DealsSubscribeCard` (`icon`, `text`, `Button/Primary`) |
| `List` (`7:369`) / `Item` ×4 | `ProductFacts` / `FactItem` (`icon`, `title`, `description`, `link`) |
| `Paragraph+HorizontalBorder` (`7:392`) | `worksOn` (`label`, `platform`) |
| `Container` (`7:395`) / `Background` ×6 / `Button` | `MediaGallery` / `mediaThumb` / `image`, `playIcon` |
| `Background+Border` (`7:412`) | `Notice/Warning` (`icon`, `title`, `text`) |
| `Heading 2` (`7:417`, `7:479`) | `SectionHeading` |
| `List` (`7:422`) / `Overlay` ×2 | `RecommendedOffers` / `OfferRow` |
| `List` (`7:484`) / `Item` ×3 | `OtherOffers` / `OfferRow` |
| inside `OfferRow` | `sellerAvatar`, `sellerName`, `verifiedIcon`, `ratingIcon`, `rating`, `ratingInfoButton`, `price`, `priceInfoIcon`, `Badge/LowestPrice` or `Badge/BestCashback`, `cashbackIcon`, `cashback`, `Button/Secondary` |
| `Button` "Load 25 more offers" / "Load more" | `Button/Outline` |
| `Heading 2 → Gamers also viewed` + 5 cards | `alsoViewedTitle` + `ProductCard` |
| `Heading 2 → Reviews: 1`, the four aspect texts, `List` of stars ×4, `Link` "Review now" | `ReviewSummary`: `title`, `aspectLabel`, `RatingStars`, `Button/Outline` |
| `List → Item` (`7:783`) | `ReviewItem` (`RatingStars`, `countryFlag`, `author`, `date`, `text`, `readMoreButton`, `helpfulButton`, `notHelpfulButton`, `translateButton`, `helpfulCount`) |
| `List` (`7:818`) / `Item → Link` | `GenreTags` / `Tag` |
| `Background` (`7:823`) / `Container` / `Section` | `DescriptionTabs` / `tabBar` (`tab/Active`, `tab`) / `tabPanel` |
| `Background` (`7:880`) / `List` / `Item` | `OtherDetails` / `detailsList` / `DetailRow` (`label`, `value`) |
| `Background+Shadow` (`7:1161`) | `BlackFridayPopup (reference — do not export)` (kept) |
| `Button - Show previous/more tabs` (`7:829`, `7:830`) | **delete** (no paint) |

### 05 Cart & Checkout: `Cart / Desktop 1512` (`5:2076`) and `Checkout / Payment – Loading` (`5:2561`), still to do
| Current | New |
|---|---|
| `Main` | `content` |
| `Background` 94 h (`5:2078`, `5:2563`) | `CheckoutHeader` (`logo (reference…)`, `CheckoutStepper`, `LocaleSwitcher`) |
| `List` 824×34 / `Item`, `Item → Button` / `Strong` / divider | `CheckoutStepper` / `step` / `stepDot` / `connector` |
| `Form` (`5:2118`) | `cartLayout` |
| `Background` 635×354 / `Heading 1 → My cart` / `List` / `Item` | `CartPanel` / `title` / `cartItems` / `CartItem` |
| inside `CartItem` | `coverImage`, `soldByLabel`, `sellerAvatar`, `sellerName`, `removeButton`, `wishlistButton`, `divider`, `title`, `warningIcon`, `regionWarning`, `findForCountryLink`, `digitalProduct`, `infoIcon`, `QuantityStepper` (`decreaseButton`, `quantity`, `increaseButton`), `price`, `cashback` |
| `Container/Background` 355×182 | `DeliveryPanel` (`title`, `emailLabel`, `requiredMark`, `TextInput/Email`, `rememberMe` with `Checkbox`) |
| `Container/Background` 355×495 | `SummaryPanel` (`title`, `SummaryRow` ×2, `totalLabel`, `total`, `totalCashback`, `consentCheckbox` ×2, `privacyNote`, `discountCodeToggle`, `trustpilotWidget (reference…)`, `Button/Primary`) |
| `Background+Border` 20×20 / `Border` 11×7 | `Checkbox` / `checkmark` |
| `Background` 1010×469 (`5:2278`) | `InspiredSection` (`SectionHeading` + 5× `ProductCard`) |
| `Footer` (`5:2417`) | `Footer/Checkout` (`PaymentMethodsStrip (reference…)`, `supportTitle`, `supportText`, `copyright`) |
| `Border` 70×70 (`5:2603`) | `Spinner` |

### 06 Auth: `Login / Desktop 1512` (`5:1663`), still to do
| Current | New |
|---|---|
| `Header → Link → SVG` | `logo (reference — do not export)` |
| `Main` | `content` |
| `Heading 1 → Hi!…` | `heroGreeting` |
| `Background` 380×543 | `LoginCard` (`title`, `subtitle` containing `createAccountLink`) |
| `List` / `Item → Link` ×3 | `socialLogin` / `Button/Social` (Google, Facebook, Apple) |
| `List` / `Item → Link → SVG` ×4 | `socialIconRow` / `Button/SocialIcon` (Steam, Discord, Twitch, X) |
| `Horizontal Divider` ×2 + `or` | `orDivider` |
| `Form` / `Input` / `Button` ×2 | `LoginForm` / `TextInput/Email` / `Button/Primary` "Get magic link", `Button/Outline` "Log in with password" |
| `Footer` (17 h) | `Footer/Auth` (`LocaleSwitcher`, `termsLink`, `privacyLink`, `cookiePrefsButton`, `supportLink`, `copyright`) |

## 5. Deletions

| What | Where | Count | State |
|---|---|---|---|
| Frame `5:1745` (product page caught while loading: spinner, popup, footer) | 04 Product | 1 frame, 327 nodes | ✅ |
| `Link` rectangles over cards (HTML hit areas) | all | 45 | Home ✅, rest ⏳ |
| `Rectangle` with no fill, stroke or effect | all | 46 | Home ✅, rest ⏳ |
| `Border` with no paint | Home 1, Cart 2, Product 2 | 5 | Home ✅, rest ⏳ |
| `Button - Show previous/more tabs` | Product | 2 | ⏳ |
| Empty search `Container` | Home (`5:19`), Product (`7:17`) | 2 | Home ✅, Product ⏳ |

Rule: delete a leaf RECTANGLE/FRAME/ELLIPSE only when it has no visible fill, stroke or effect
and `isMask` is false.

## 6. Component candidates (masters go on `01 Components`; screen layers stay as frames)

| Component | Variants | Source to copy |
|---|---|---|
| `Header` | — | Home `5:6` |
| `MainNav` | — | Home `5:58` |
| `SearchBar` | — | Home `5:7` |
| `LocaleSwitcher` | — | Home `5:20` |
| `Footer` | `Full`, `Checkout`, `Auth` | `5:1378`, `5:2417`, `5:1732` |
| `CheckoutHeader`, `CheckoutStepper` | `Cart`, `Payment` | `5:2078`, `5:2563` |
| `ProductCard` | `Default`, `Discounted` | `5:221`, `5:363` |
| `PriceTag` | `Default`, `Discounted` | from ProductCard |
| `Badge` | `Cashback`, `CashbackDeal`, `BestCashback`, `LowestPrice` | `5:225`, `7:102`, `7:151`, `7:504` |
| `GiftCardTile` | — (image is reference only) | `5:845` |
| `CategoryShortcut` | — | Home `5:81` |
| `SectionHeading` | `Lg` (Home), `Sm` (Product/Cart) | `5:215`, `7:417` |
| `Button` | `Primary`, `Outline`, `Secondary`, `PayPal`, `Social`, `SocialIcon`, `Icon` | various |
| `OfferRow` | `Featured`, `Default`, `LowestPrice` | `7:423`, `7:449`, `7:485` |
| `CartItem` | `Default`, `RegionWarning` | `5:2157`, `5:2122` |
| `SummaryRow`, `TextInput`, `Checkbox`, `QuantityStepper` | — | Cart / Login |
| `RatingStars`, `ReviewItem`, `Breadcrumbs`, `Tag`, `Notice/Warning`, `Spinner`, `FactItem`, `DetailRow` | — | Product / Checkout |

Reference only, **never components or exports**: Eneba logo, hero banners, GTA 6 / Black Week
pills, Black Friday popup, eGift brand tiles, payment logos, app-store badges, PC Mag badge,
Trustpilot widget, ScamAdviser.

## 7. Tokens

See [`tokens.json`](./tokens.json). Summary of merges (⚑ = near-duplicates merged):

| Token | Value | Merged |
|---|---|---|
| `color/bg/base` | `#4618AC` | |
| `color/bg/header` | `#351183` | ⚑ `#3C1395`, `#3D1596` |
| `color/surface/raised` | `#45229C` | |
| `color/surface/card` | `#1F0A4D` | |
| `color/surface/footer` | `#160850` | close to card, kept separate |
| `color/surface/tab` | `#5825CC` | |
| `color/accent` | `#FAD318` | ⚑ `#FAC917` |
| `color/accent/cashback` | `#63E3C2` | |
| `color/success` | `#23C299` | ⚑ `#00CF9F`, `#3DDCB3` |
| `color/danger` | `#D32252` | |
| `color/text/subtle` | `#DCD8E6` | ⚑ `#DCDCE6` |
| `color/text/muted` | `#B3AAC9` | ⚑ `#A09AAC`, `#9385B2` |
| `color/text/cashback` | `#84E916` | ⚑ `#9FEE49` |
| `color/text/tertiary` | white 70 % | ⚑ white 60 % |
| `radius/xs`, `sm`, `md`, `full` | 2, 4, 10, 9999 | ⚑ 1/3→2, 5/6→4, 8/12/20/35/50 are circles or pills → full |
| font sizes | 9–30 px integer scale + 88 display | ⚑ fractional import sizes (11.8, 21.7, …) rounded |

Figma Variables plan (`00 Tokens`): collections `color`, `radius`, `space`. Create them only, **don't
bind them to layers**. Binding the merged values would visibly change the import.

## 8. Notes for the code agent

- The font in the import is **Inter**. html.to.design may have substituted it, so check the live site before relying on it.
- Product cards are square-cornered, with a 1 px `#63E3C2` border and a `#1F0A4D` body. The
  yellow `addToCartHover` button slides up into view on hover.
- The Cart frame's email input contains a real address. Don't copy it into fixtures. Use `you@example.com`.
- Third-party brand colors (Trustpilot `#00B67A`, Visa, PayPal, Mastercard, Google, app stores) are not tokens.
