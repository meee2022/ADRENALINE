---
name: Adrenaline Healthy Food
description: A premium, light-themed restaurant management & subscription system blending health-tech minimalism with modern Arabic-first design.
audience: Health-conscious subscribers in Qatar (public-facing) and operations staff (admin dashboard).
mood: Clean, trustworthy, energetic, and premium. Warm hospitality through soft gradients and breathable whitespace.

design_tokens:
  brand:
    primary:
      cyan: "#3CC4F0"          # Brand cyan — primary action, highlights, focus
      cyan_hover: "#2BB0DC"    # Slightly darker cyan for hover/active states
    secondary:
      steel_blue: "#47759C"    # Headlines, muted icons, accent text
      steel_blue_hover: "#5A8AB5"
    neutrals:
      ink: "#0F1516"           # Primary text, dark backgrounds (testimonials, CTAs)
      ink_soft: "#1a2628"      # Slightly lighter ink for layered dark sections
      gray: "#BCBEBF"           # Brand gray — footer text, faint dividers
      white: "#FFFFFF"

  semantic_colors:
    background:
      app: "#F1F5F9"            # Main app shell behind cards (slate-100)
      surface: "#FFFFFF"        # Card / panel surface
      muted: "#F8FAFC"          # Quiet input backgrounds, header strips
      tinted_cyan: "#ECFEFF"    # Light cyan tint for callout sections
      tinted_blue: "#F0F9FF"    # Subtle hero / section background
    foreground:
      strong: "#0F1516"
      base: "#1a1a1a"
      muted: "#47759C"
      subtle: "#94A3B8"
      faint: "#CBD5E1"
      placeholder: "#94A3B8"
    border:
      default: "rgba(0,0,0,0.06)"
      input: "#E2E8F0"
      strong: "#CBD5E1"
      focus: "#3CC4F0"
    feedback:
      success: "#10B981"
      success_soft_bg: "#ECFDF5"
      success_soft_border: "#A7F3D0"
      warning: "#F59E0B"
      warning_soft_bg: "#FFFBEB"
      warning_soft_border: "#FDE68A"
      danger: "#EF4444"
      danger_soft_bg: "#FEF2F2"
      danger_soft_border: "#FECACA"
      info: "#3CC4F0"
      info_soft_bg: "#ECFEFF"
      info_soft_border: "#A5F3FC"
      whatsapp_green: "#25D366"
      whatsapp_green_dark: "#128C7E"
    accent_palette:
      morning_warm: "#F59E0B"
      morning_warm_light: "#FCD34D"
      evening_cool: "#47759C"
      evening_cool_light: "#5A8AB5"
      meal_breakfast: "#F59E0B"
      meal_lunch: "#3CC4F0"
      meal_dinner: "#47759C"
      meal_snack: "#10B981"

  gradients:
    brand_primary: "linear-gradient(135deg, #3CC4F0 0%, #2BB0DC 50%, #47759C 100%)"
    brand_subtle: "linear-gradient(135deg, #3CC4F015, #47759C10)"
    cyan_to_steel: "linear-gradient(135deg, #3CC4F0, #47759C)"
    cyan_horizontal: "linear-gradient(90deg, #3CC4F0, #2BB0DC)"
    light_canvas: "linear-gradient(135deg, #F8FAFC 0%, #ECFEFF 50%, #F0F9FF 100%)"
    glass_white: "linear-gradient(135deg, rgba(255,255,255,0.97), rgba(255,255,255,0.92))"
    night_canvas: "linear-gradient(135deg, #0F1516 0%, #1a2628 50%, #0F1516 100%)"
    whatsapp: "linear-gradient(135deg, #25D366, #128C7E)"
    morning_pill: "linear-gradient(135deg, #F59E0B, #FCD34D)"
    evening_pill: "linear-gradient(135deg, #47759C, #5A8AB5)"
    success_tint: "linear-gradient(135deg, #F0FDF4, #F7FEF9)"
    danger_tint: "linear-gradient(135deg, #FEF2F2, #FFF5F5)"
    warning_tint: "linear-gradient(135deg, #FFFBEB, #FEF3C7)"
    radial_glow_cyan: "radial-gradient(ellipse at top left, #3CC4F008 0%, transparent 70%)"
    radial_glow_white: "radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)"

  typography:
    families:
      sans: "'Cairo', 'Tahoma', 'Segoe UI', 'Helvetica Neue', sans-serif"
      heading: "'Cairo', sans-serif"
      mono_numeric: "tabular-nums"     # Applied via font-feature-settings
    weights:
      regular: 400
      medium: 500
      semibold: 600
      bold: 700
      extrabold: 800
      black: 900
    scale:
      hero_xxl: { size: "3rem", line_height: 1.05, weight: 900, tracking: "-0.02em" }
      hero_xl:  { size: "2.6rem", line_height: 1, weight: 900, tracking: "-0.02em" }
      h1:       { size: "1.875rem", line_height: 1.15, weight: 900, tracking: "-0.01em" }
      h2:       { size: "1.5rem", line_height: 1.2, weight: 900, tracking: "-0.01em" }
      h3:       { size: "1.125rem", line_height: 1.3, weight: 800 }
      title:    { size: "1rem", line_height: 1.4, weight: 700 }
      body:     { size: "0.875rem", line_height: 1.55, weight: 400 }
      body_strong: { size: "0.875rem", line_height: 1.5, weight: 600 }
      caption:  { size: "0.75rem", line_height: 1.4, weight: 600 }
      micro:    { size: "0.6875rem", line_height: 1.3, weight: 700 }
      pill:     { size: "0.625rem", line_height: 1, weight: 800, tracking: "0.05em" }
    headlines_in_arabic: "Use Cairo with weight 900; numerals always tabular."
    rtl_alignment: "Headlines right-aligned in RTL; centered hero/CTA/auth pages."

  spacing:
    base_unit: "0.25rem"        # 4px grid
    scale:
      "0.5": "2px"
      "1": "4px"
      "1.5": "6px"
      "2": "8px"
      "2.5": "10px"
      "3": "12px"
      "3.5": "14px"
      "4": "16px"
      "5": "20px"
      "6": "24px"
      "7": "28px"
      "8": "32px"
      "10": "40px"
      "12": "48px"
      "16": "64px"
      "20": "80px"
      "24": "96px"
    section_padding_y:
      mobile: "3rem"
      desktop: "6rem"
    container_max:
      content: "72rem"          # max-w-6xl
      narrow: "42rem"           # max-w-2xl (forms, single column)
      wide: "80rem"             # max-w-7xl (hero / footer)
    card_padding: "1.25rem"     # ~p-5
    card_padding_lg: "1.5rem"   # ~p-6
    card_padding_xl: "2rem"     # ~p-8

  radii:
    none: "0"
    sm: "0.5rem"        # small chips, dense pills
    md: "0.75rem"       # inputs, mid pills
    lg: "1rem"          # buttons, default pills, badges
    xl: "1.25rem"       # avatars, icon tiles
    "2xl": "1.5rem"     # standard card / panel
    "3xl": "2rem"       # hero / feature cards
    "[2.5rem]": "2.5rem" # final CTA banner
    pill: "9999px"      # full-rounded chips, status badges, count pills

  borders:
    hairline: "1px solid rgba(0,0,0,0.06)"
    subtle: "1px solid #E2E8F0"
    default: "1.5px solid #E2E8F0"
    focus: "1.5px solid #3CC4F0"
    accent_cyan: "1.5px solid #3CC4F035"
    danger: "1.5px solid #FCA5A5"
    dashed_brand: "1.5px dashed #3CC4F050"

  elevation:
    none: "none"
    glow_subtle: "0 1px 4px rgba(0,0,0,0.04)"
    card_resting: "0 2px 12px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.03)"
    card_premium: "0 4px 20px rgba(0,0,0,0.04), 0 1px 6px rgba(0,0,0,0.02)"
    card_hovered: "0 8px 30px rgba(0,0,0,0.12)"
    panel_floating: "0 8px 30px rgba(0,0,0,0.05)"
    cta_brand: "0 6px 20px rgba(60,196,240,0.4)"
    cta_brand_strong: "0 8px 24px rgba(60,196,240,0.5)"
    cta_whatsapp: "0 6px 20px rgba(37,211,102,0.35)"
    cta_warning: "0 4px 14px rgba(245,158,11,0.35)"
    nav_sticky: "0 1px 12px rgba(0,0,0,0.07)"
    bottom_bar: "0 -4px 20px rgba(0,0,0,0.08)"
    halo_cyan: "0 20px 60px rgba(60,196,240,0.25)"
    halo_cyan_intense: "0 30px 80px rgba(60,196,240,0.4)"

  motion:
    durations:
      instant: "100ms"
      fast: "150ms"
      base: "200ms"
      smooth: "300ms"
      lazy: "500ms"
    easings:
      out_smooth: "cubic-bezier(0.22, 1, 0.36, 1)"
      out_quart: "cubic-bezier(0.25, 1, 0.5, 1)"
      standard: "cubic-bezier(0.4, 0, 0.2, 1)"
    transforms:
      lift_subtle: "translateY(-2px)"
      lift_strong: "translateY(-4px)"
      press: "scale(0.98)"
      press_strong: "scale(0.95)"
      hover_grow: "scale(1.02)"
    keyframes:
      fade_in: "1s ease-out (opacity 0 → 1)"
      fade_in_up: "1s ease-out (opacity 0 + translateY(20px) → 0)"
      bounce_slow: "2s infinite (translateY 0 → -10px → 0)"
      pulse_ring: "1.5s infinite (scale 1 → 1.4, opacity 0.3 → 0)"
      spin: "1s linear infinite (rotate 0 → 360deg)"
    standard_hover: "Card lifts ~2px; surface gains a soft cyan radial glow at 8% opacity in top-left."

  iconography:
    library: "lucide-react (line icons, 1.5px stroke equivalent)"
    sizes:
      micro: "12px"     # h-3 w-3
      small: "14px"     # h-3.5 w-3.5
      base: "16px"      # h-4 w-4 (default)
      medium: "20px"    # h-5 w-5
      large: "28px"     # h-7 w-7 (feature illustrations)
    treatments:
      tile: "Square 44px–56px tile with brand gradient or 12% tinted bg + 30–35% bordered halo."
      circle_pill: "Round 28–40px chip behind icon, used in stat rows and section badges."
      colored_solid: "On dark backgrounds use solid white icon over brand gradient tile."

  imagery:
    photography_style: "Bright, top-down or 3/4 plated meals on neutral surfaces. Slight grain acceptable. Avoid heavy filters."
    overlay: "Linear gradient from transparent to rgba(15,21,22,0.85) bottom for text legibility on photos."
    hover_zoom: "scale(1.10) over 500ms when hovering meal/plan cards."
    aspect_ratios:
      meal_card_hero: "16:11"
      plan_card_hero: "16:11"
      sticker: "70mm × 35mm (printable)"

  states:
    focus_ring: "0 0 0 3px rgba(60,196,240,0.20)"
    focus_border: "1.5px solid #3CC4F0"
    disabled_opacity: 0.5
    disabled_bg: "#E5E7EB"
    disabled_fg: "#9CA3AF"
    selected_pill: "background: gradient cyan→steel; color white; shadow brand-cyan."
    hovered_link: "color #3CC4F0; underline only when in body copy."

  data_visualization:
    chart_palette:
      primary: "#3CC4F0"
      secondary: "#47759C"
      tertiary: "#10B981"
      quaternary: "#F59E0B"
      quinary: "#8B5CF6"
    bar_radius: "[6, 6, 0, 0]"   # top-rounded bars
    bar_category_gap: "35–40%"
    grid_style: "axisLine and tickLine removed; ticks #94A3B8 at 11px."
    tooltip:
      background: "#FFFFFF"
      border: "1px solid #E2E8F0"
      radius: "0.625rem"
      shadow: "0 4px 20px rgba(0,0,0,0.10)"
      font_size: "12px"

  layout:
    grid:
      kpi_cards: "Auto-fill, minmax(240px, 1fr); fixed 4-up at lg breakpoint."
      meal_cards: "Auto-fill, minmax(260px, 1fr) — container-relative not viewport."
      stats_pill_strip: "2-up mobile, 4-up desktop."
    sticky:
      header_offset: "73px"     # global header height
      day_picker_offset: "73px" # secondary sticky bar sits beneath header
    breakpoints:
      sm: "640px"
      md: "768px"
      lg: "1024px"
      xl: "1280px"
      "2xl": "1536px"
    rtl: "Site is Arabic-first; dir=\"rtl\" set on html. Layout flows right-to-left, numerals stay LTR."

  components:
    button:
      primary:
        background: "linear-gradient(135deg, #3CC4F0, #2BB0DC)"
        color: "#FFFFFF"
        radius: "9999px"
        height: "2.75rem (h-11)"
        padding_x: "1.5rem (px-6)"
        weight: 700
        shadow: "0 6px 20px rgba(60,196,240,0.4)"
        hover: "scale(1.02), brightness +5%"
      ghost:
        background: "transparent"
        border: "2px solid #3CC4F0"
        color: "#3CC4F0"
        hover_bg: "#3CC4F0", hover_color: "#FFFFFF"
      whatsapp:
        background: "linear-gradient(135deg, #25D366, #128C7E)"
        color: "#FFFFFF"
        shadow: "0 6px 20px rgba(37,211,102,0.4)"
      destructive:
        background: "#EF4444"
        color: "#FFFFFF"
      tab_inactive:
        background: "#F8FAFC"
        color: "#64748B"
        border: "1px solid #E2E8F0"
    input:
      height: "2.5rem (h-10) → 3rem (h-12) for hero inputs"
      radius: "0.75rem (rounded-xl)"
      background: "#F8FAFC"
      border_default: "1.5px solid #E2E8F0"
      border_focus: "1.5px solid #3CC4F0"
      placeholder: "#94A3B8"
      prefix_chip:
        background: "linear-gradient(135deg, #3CC4F0, #47759C)"
        color: "#FFFFFF"
        weight: 900
    card:
      radius: "1.5rem (2xl) — 2rem (3xl) for hero cards"
      background: "#FFFFFF"
      border: "1px solid rgba(0,0,0,0.06)"
      shadow: "0 2px 12px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.03)"
      header_strip: "border-bottom 1px solid #F1F5F9; padding 16px 20px."
      hover: "translateY(-2px), shadow 0 8px 30px rgba(0,0,0,0.12), accent gradient bar reveals."
      accent_bar: "Top 3–4px gradient bar in brand color (sometimes only on hover)."
    pill:
      radius: "9999px"
      padding: "0.25rem 0.75rem"
      font_size: "0.75rem"
      weight: 700
      pattern_active:
        background: "linear-gradient(135deg, #3CC4F0, #2BB0DC)"
        color: "#FFFFFF"
        shadow: "0 3px 10px rgba(60,196,240,0.25)"
    badge_status:
      success: { bg: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" }
      warning: { bg: "#FFFBEB", color: "#D97706", border: "1px solid #FDE68A" }
      danger:  { bg: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }
      info:    { bg: "#ECFEFF", color: "#0891B2", border: "1px solid #A5F3FC" }
    avatar:
      size_default: "2.75rem (h-11)"
      radius: "1.25rem (rounded-2xl) — squircle, not full circle"
      background: "Per-user gradient generated from name hash (7 fixed palettes)"
      typography: "font-weight 900, white, letter centered"
    sticker_label:
      width: "70mm"
      height: "35mm"
      border: "0.5px solid #000"
      radius: "1.5mm"
      font: "'Cairo', 'Tahoma', sans-serif"
      brand_letterspacing: "2.5px"
      customer_name_style: "italic, weight 900, centered"
      meal_name_style: "uppercase, weight 700, centered, letter-spacing 0.5px"
      warning_color: "#B91C1C, weight 800"
      footer: "3-cell strip — production date, expiry date, customer #."
    modal:
      backdrop: "rgba(0,0,0,0.5)"
      content_radius: "1.5rem"
      max_width_default: "32rem"
      max_width_wide: "48rem"
      header: "Title weight 900, optional pill count to its right."
    nav:
      desktop_header: "Sticky, blurred white with cyan/blue gradient backdrop, height ~73px."
      mobile_bottom: "Fixed bottom, 4-icon nav, brand cyan active state."
      sidebar_admin: "224px wide, white surface, brand-cyan active item with soft halo."

  printing:
    paper_color: "#FFFFFF"
    text_color: "#000000 !important"
    avoid_text_color: "#B91C1C"
    grid_gap: "var(--gap) — user-adjustable mm"
    page_break_avoid: ".page-break-inside-avoid sets break-inside: avoid;"

  accessibility:
    minimum_tap_target: "40px"
    focus_visible: "Visible 3px ring of brand cyan at 20% alpha."
    contrast_targets:
      body_on_surface: "≥ 4.5:1"
      brand_button_text: "white on cyan ≥ 4.5:1 large text"
    reduced_motion: "Hover-lift and pulse animations gated by prefers-reduced-motion (recommended).”
---

# Adrenaline Healthy Food — Design System

## 1. Identity in One Line

A **soft, light, energetic** subscription system for healthy food, balancing the **clinical clarity of a medical app** with the **warmth of a hospitality brand**. Surfaces breathe; numbers speak loudly; the brand cyan is used sparingly so when it appears, it commands.

## 2. Brand Voice (visualized)

- **Cyan (#3CC4F0)** is the heartbeat — primary actions, focus, current state. Never decorative; every cyan element should be tappable, selectable, or signaling progress.
- **Steel Blue (#47759C)** is the calm voice — running text, secondary copy, supportive icons.
- **Ink Black (#0F1516)** is the authority — headlines, tabular numbers, dark-mode panels (testimonials, final CTA banners).
- **Slate Background (#F1F5F9)** is the canvas — never pure white inside the shell. White is reserved for cards, lifting them visually.
- **Soft cyan tints (#ECFEFF, #F0F9FF)** signal "calm informational" sections — How It Works, FAQ, plan filters.

## 3. The "Premium Card" Pattern

The dominant unit. Every meaningful piece of content lives in a card that follows the same recipe:

1. **Surface** `#FFFFFF` with rounded `1.5rem (2xl)` corners.
2. **Border** at `1px solid rgba(0,0,0,0.06)` — barely there but enforces edge.
3. **Shadow** at rest is two-layer: `0 2px 12px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.03)` — soft, not heavy.
4. On **hover** the card lifts `-2px` and the shadow grows to `0 8px 30px rgba(0,0,0,0.12)`. Often a 1px gradient accent bar reveals at the top edge.
5. **Header strip** is a sub-section with `border-bottom: 1px solid #F1F5F9` and `padding: 16px 20px` — it carries a small icon + bold title on one side, and an "Action" link (cyan tinted pill) on the other.

The recipe never breaks. KPI tiles, stat panels, plan cards, testimonials, FAQ items, customer rows — they all wear it.

## 4. KPI Tiles — Numbers First

The signature element. Used on dashboards and as social-proof bars.

- A **square-rounded icon tile** (`h-12 w-12 rounded-2xl`) sits in the top-right of the card with a 135° gradient at ~20% opacity over the brand color and a 1.5px halo border at 35% opacity.
- The **number is huge**: `2.6rem`, weight 900, `tabular-nums`, tight tracking. The label below is `11px` and muted.
- A **3px gradient strip** crosses the very top of the tile — subtle but unifying.
- On hover, a **radial cyan glow** at 8% alpha appears in the top-left corner. The glow uses `radial-gradient(ellipse at top left, #3CC4F008, transparent 70%)`.

The visual language says: "the data leads, decoration follows."

## 5. Hero & Final CTA Banners

When the system needs to make a *moment*, it deploys the **brand gradient banner**:

`linear-gradient(135deg, #3CC4F0 0%, #2BB0DC 50%, #47759C 100%)`

with a heavy halo shadow `0 30px 80px rgba(60,196,240,0.4)`.

These banners use:
- White typography at hero scale (3rem, weight 900)
- Two soft circular glows in opposite corners (`radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)`) for depth
- Glass pill stats: `rgba(255,255,255,0.18)` background, `1px solid rgba(255,255,255,0.25)` border, `backdrop-filter: blur(10px)`
- Twin CTAs — one solid white pill (primary), one ghost glass pill (secondary)

A `2.5rem` corner radius differentiates them from regular cards.

## 6. Status & Feedback Language

Color-coded badges follow a strict pattern: **soft tinted background + same-hue darker text + matching pastel border**.

| Status | Background | Text | Border |
|--------|-----------|------|--------|
| Success | #ECFDF5 | #059669 | #A7F3D0 |
| Warning | #FFFBEB | #D97706 | #FDE68A |
| Danger | #FEF2F2 | #DC2626 | #FECACA |
| Info | #ECFEFF | #0891B2 | #A5F3FC |

Allergy and avoid warnings use the **two-cell strip pattern**: a saturated red/orange icon block on the left (with white icon) and a soft pastel content area on the right. This keeps the tone urgent without screaming.

## 7. Pills, Tabs & Tags

Pills are the system's *micro-language*.
- **Resting tab/pill**: muted text on `#F8FAFC` with a thin border.
- **Active tab/pill**: brand gradient `#3CC4F0 → #2BB0DC`, white text, soft brand shadow `0 3px 10px rgba(60,196,240,0.25)`, scaled 1.05.
- **Counter inside pill**: black weight, bg `rgba(255,255,255,0.25)` when on a colored pill, otherwise white.

Status pills use full pill radius (`9999px`) and live at `0.625rem–0.75rem` font sizes.

## 8. Forms

- Inputs are tall (`h-10` to `h-12`), `rounded-xl`, on a faint `#F8FAFC` background. Border `1.5px` of `#E2E8F0`. On focus the border becomes brand cyan with no extra ring (the color shift is the affordance).
- The **phone gate** uses a unique compound input: a `+974` chip with a Phone icon on a brand gradient slab to the side of the actual number field. Numerals are `tabular-nums` with `tracking-widest`.
- Validation messages are tiny (`11px`), bold, and tied to a small triangle alert icon — never floating tooltips.

## 9. Iconography

- All icons come from **lucide-react** (line, ~1.5px stroke).
- Default size is **16px**; feature illustrations go to **28px**.
- Three treatments: 
  1. **Tile icon** — sits in a square-rounded container (`rounded-2xl`) with a brand gradient at 12% alpha and a 35% alpha border.
  2. **Pill icon** — small icon paired with a label inside a status pill.
  3. **Solid white over gradient** — for hero/CTA contexts, icon is white on brand gradient.

Emoji is permitted only for **food categories** (☀, 🍽️, 🌙, 🥗) and as a culturally warm cue inside Arabic copy (👋, 🤍).

## 10. Typography Choices

- **Cairo** is the system font for both Arabic and Latin scripts; it carries the Arabic with proper weight curves and stays legible at small sizes for Latin numerals.
- Numerals always use `tabular-nums` (especially in counters, prices were removed but counts remain).
- Headlines are **always weight 900 with -1% to -2% letter-spacing**. This is non-negotiable — it makes the brand feel premium rather than friendly-blandweight.
- Body text rarely exceeds weight 600. Bold blocks of paragraph text are an anti-pattern.
- Italics appear deliberately on **customer names in stickers** ("MS ABEER" italic, weight 900) — a one-off serif-y nod to handwritten labels.

## 11. Light vs. Dark Sections

The product is light-themed, but **darkness has a role**. Two sections regularly invert to ink black:
1. **Testimonials** — black canvas with subtle cyan/steel radial glows at corners. White stars (#FBBF24), white headline, gray body, glass card with `rgba(255,255,255,0.05)` background and 5% white border.
2. **Final CTA** — actually a saturated cyan gradient (not black), but it serves the same "stop scrolling, look here" function.

These darker sections always sit between two light sections to create rhythm.

## 12. Print & Sticker System

Stickers are part of the visual identity — they get printed on every meal and box.

- **70mm × 35mm** rounded-rect with a `0.5px` solid black border and `1.5mm` corner radius.
- Brand wordmark (**ADRENALINE** at letter-spacing `2.5px`) and tag (**HEALTHY FOOD**) at the very top, centered.
- A `0.5px` 50%-opacity black hairline divider.
- Customer name in **italic black 11px weight 900**, centered.
- Meal name in **uppercase 8.5px weight 700** with `0.5px` letter-spacing, centered.
- Warnings (allergies/avoid) in `#B91C1C` weight 800, centered, 7px.
- Footer is a 3-cell grid divided by `0.5px` hairlines: **PROD | EXP | No.** with tiny 4.5px labels above 8–12px black bold values.

Anti-pattern: full-bleed photo stickers, multi-colored boxes, or rounded customer numbers in circles. The stickers are **chef tools** first, branded surfaces second.

## 13. Motion Vocabulary

Motion is restrained and serves comprehension:

- **200ms** is the default — most hover transitions, color shifts, transforms.
- **Cards lift `-2px`** and gain shadow on hover. Buttons compress `scale(0.98)` on press.
- **Pulsing rings** (300ms scale 1→1.4 + opacity fade) only on a single floating WhatsApp button — never on multiple elements at once.
- **`fade-in-up`** (1s) animates hero copy on first paint; subsequent content does not animate on scroll (no parallax, no scroll triggers).

## 14. Spacing Discipline

The 4px base grid is followed strictly. The most-used spacing tokens are `3` (12px), `4` (16px), `5` (20px), `6` (24px). Sections breathe with **96px** vertical padding on desktop and **48px** on mobile. Content is constrained to `max-w-6xl` (1152px) for content pages and `max-w-7xl` (1280px) for hero/footer rows.

## 15. RTL & Bilingual Considerations

- Site is Arabic-first; `dir="rtl"` on `html`. Tailwind utilities like `gap`, `space-y` work as-is.
- **Numerals stay LTR** — phone numbers, prices, counts. Use the `bidi-num` utility for inline numbers in Arabic paragraphs.
- Headlines are right-aligned in RTL but center-aligned for hero/CTA/auth screens.
- Switching language is a one-click chip in the navbar; the entire layout flips without breaking.
- Icons that have directional meaning (chevron, arrow) flip via `flex-row-reverse` or alternative components — not via `transform: scaleX(-1)` (which would flip text inside SVGs).

## 16. Things to Avoid (Anti-patterns)

- **Pure white app shell.** The shell is `#F1F5F9`; white is for cards.
- **Multiple cyan CTAs in the same view.** Cyan signals primary action; if there are two, one is wrong.
- **Heavy borders.** No `2px` borders on cards. Borders are 1px or 1.5px maximum.
- **Bold paragraphs.** Make headings work; body stays at weight 400–600.
- **Rainbow category cards.** Categories use neutral cards with a colored *icon tile* — not colored backgrounds — to avoid visual noise.
- **Auto-playing carousels.** Hero carousel auto-rotates only on the homepage; never on internal pages.
- **Dropshadows on text.** Headlines are bold and dark — no glow, no shadow, no outline.
- **Sharp corners.** Default radius is `1rem` minimum on interactive surfaces. Inputs are `rounded-xl`. Cards `rounded-2xl`.

## 17. Imagery Direction

- **Photography** is bright, top-down or 3/4 plated meals on warm neutral surfaces (wood, off-white linen). Slight grain is fine. No heavy filters or moody contrast.
- Photos always carry a **bottom-to-top dark gradient overlay** (`transparent → rgba(15,21,22,0.85)`) so headline white text is legible.
- On hover, photos perform a slow `scale(1.10)` over 500ms. The card itself does not move during this — only the image.
- Icons and product shots never live on pure white — always against `#F1F5F9` or a tinted card surface.

## 18. Accessibility Promises

- Tap targets are **40px minimum**.
- Brand cyan on white is reserved for **non-text uses** unless the text size is ≥ 18px or weight 700.
- Allergy banners use **icon + text + color** redundantly — never color alone.
- Inputs always pair `placeholder` with a visible label or labeled chip (the +974 chip serves as the label for the phone field).
- Reduced-motion users see no card lift, no pulse, no fade-in-up.

---

**The shorthand:** soft light surfaces, ink-black numbers, brand-cyan momentum, generous space, and one strong moment per screen.
