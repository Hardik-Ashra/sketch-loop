

/**
 * =========================================================
 * PROMPT BUILDER (V2 FOUNDATION) — GEMINI OPTIMISED
 * =========================================================
 */

type StyleColorSection = {
    swatches: {
        name: string;
        hexColor: string;
        description?: string;
    }[];
};

type TypographySection = {
    styles: {
        name: string;
        description?: string;
        fontFamily: string;
        fontWeight: string;
        fontSize: string;
        lineHeight: string;
    }[];
};

/**
 * ===============================
 * Helpers
 * ===============================
 */

function formatColors(colors: StyleColorSection[] = []) {
    return colors
        .flatMap((c) =>
            c.swatches.map(
                (s) => `• ${s.name}: ${s.hexColor}${s.description ? ` — ${s.description}` : ""}`
            )
        )
        .join("\n");
}

function formatTypography(typography: TypographySection[] = []) {
    return typography
        .flatMap((t) =>
            t.styles.map(
                (s) =>
                    `• ${s.name}: ${s.fontFamily} ${s.fontWeight} ${s.fontSize}/${s.lineHeight}${s.description ? ` — ${s.description}` : ""}`
            )
        )
        .join("\n");
}

/**
 * =========================================================
 * WORKFLOW GENERATION PROMPT
 * =========================================================
 */
export function buildWorkflowPrompt({
    currentHTML,
    selectedPageType,
    colors,
    typography,
    imageCount,
}: any) {
    // Gemini: no truncation — model has 1M token window, truncating loses visual context
    let prompt = `<role>
You are a senior UI engineer specialising in design systems and multi-page web applications.
</role>

<main_page_reference>
${currentHTML}
</main_page_reference>

<task>
Generate a "${selectedPageType}" workflow page that integrates seamlessly with the main page above.

Step 1 — ANALYSE the main page reference.
  • Identify exact color values, font families, spacing scale, and component patterns already used.
  • Do NOT infer new design decisions — mirror what is already there.

Step 2 — STRUCTURE the new page.
  • Reuse the same layout skeleton (header, sidebar, grid, etc.) from the main page.
  • Adapt content areas to suit a "${selectedPageType}" context.
  • Every major component MUST have a descriptive kebab-case id attribute.

Step 3 — APPLY style tokens (these take highest priority over Step 1 inferences).`;

    if (colors?.length) {
        prompt += `\n<style_tokens>\n<colors>\n${formatColors(colors)}\n</colors>`;
    }

    if (typography?.length) {
        prompt += `\n<typography>\n${formatTypography(typography)}\n</typography>\n</style_tokens>`;
    }

    if (imageCount) {
        prompt += `\n  • ${imageCount} inspiration image(s) available — map them to image slots in order.`;
    }

    prompt += `

Step 4 — VERIFY before outputting.
  ✅ Every section has py-16 px-6 minimum (no py-8, py-12)
  ✅ Cards have p-6 minimum internal padding
  ✅ Grid gaps are gap-8 minimum
  ✅ Buttons have px-6 py-3 minimum; CTA buttons use px-8 py-4
  ✅ Only .c-* color classes used — never Tailwind color utilities
  ✅ No viewport units (vh, vw, h-screen)
  ✅ No <script> tags or inline event handlers
</task>

<output_contract>
Return ONLY the HTML wrapped in <div data-generated-ui>. No explanations. No markdown fences.
</output_contract>`;

    return prompt;
}

/**
 * =========================================================
 * REDESIGN PROMPT
 * =========================================================
 */
export function buildRedesignPrompt({
    userMessage,
    currentHTML,
    colors,
    typography,
    hasWireframe,
    imageCount,
}: any) {
    let prompt = `<role>
You are a senior UI engineer making targeted changes to an existing UI based on a user request.
</role>

<user_request>
${userMessage}
</user_request>`;

    if (currentHTML) {
        // Gemini: pass full HTML, no substring truncation
        prompt += `\n\n<current_html>\n${currentHTML}\n</current_html>`;
    }

    if (hasWireframe) {
        prompt += `\n\n<wireframe_context>A wireframe image has been provided. Use it to understand the intended layout structure.</wireframe_context>`;
    }

    prompt += `\n\n<task>
Step 1 — INTERPRET the user request literally and completely.
  • Identify every explicit change requested.
  • Do NOT make changes the user did not ask for.

Step 2 — PRESERVE everything not mentioned.
  • Keep all layout structure, component hierarchy, and id attributes intact.

Step 3 — APPLY style tokens (mandatory — do not derive colors from context).`;

    if (colors?.length) {
        prompt += `\n<style_tokens>\n<colors>\n${formatColors(colors)}\n</colors>`;
    }

    if (typography?.length) {
        prompt += `\n<typography>\n${formatTypography(typography)}\n</typography>\n</style_tokens>`;
    }

    if (imageCount) {
        prompt += `\n  • ${imageCount} inspiration image(s) available for image slots.`;
    }

    prompt += `

Step 4 — VERIFY spacing and color compliance.
  ✅ Sections: py-16 px-6 minimum
  ✅ Cards: p-6 minimum
  ✅ Buttons: px-6 py-3 minimum (CTA: px-8 py-4)
  ✅ Grid gaps: gap-8 minimum
  ✅ Colors: .c-* classes only — no Tailwind color utilities, no hex in class attributes
  ✅ No viewport units. No <script> tags.
</task>

<output_contract>
Return ONLY the complete redesigned HTML wrapped in <div data-generated-ui>. No explanations. No markdown.
</output_contract>`;

    return prompt;
}

/**
 * =========================================================
 * WORKFLOW REDESIGN PROMPT
 * =========================================================
 */
export function buildWorkflowRedesignPrompt({
    userMessage,
    currentHTML,
    colors,
    typography,
}: any) {
    return `<role>
You are a senior UI engineer making surgical edits to a workflow page. Minimum change to satisfy the request.
</role>

<user_request>
${userMessage}
</user_request>

<current_html>
${currentHTML}
</current_html>

<task>
Step 1 — IDENTIFY exactly which elements the request targets.
Step 2 — MODIFY only those elements. Leave all other HTML byte-for-byte identical.
Step 3 — APPLY style tokens. Do not introduce new color values.
<style_tokens>
<colors>
${formatColors(colors)}
</colors>
<typography>
${formatTypography(typography)}
</typography>
</style_tokens>
Step 4 — CONFIRM output is valid HTML with no regressions.
</task>

<output_contract>
Return ONLY the modified HTML. Same outer structure. No explanations.
</output_contract>`;
}

/**
 * =========================================================
 * STYLE GUIDE PROMPT
 * =========================================================
 */
export function buildStyleGuidePrompt(imageCount: number) {
    return `<role>
You are a design-system engineer. Analyse moodboard images and produce a precise design token specification as JSON.
</role>

<task>
You have been provided ${imageCount} moodboard image(s).

Step 1 — EXTRACT colors.
  • Identify 3–5 dominant colors, accent/highlight colors, and background/neutral tones.

Step 2 — MAP to semantic tokens.
  • background: lightest surface. foreground: highest-contrast text (WCAG AA ≥4.5:1).
  • primary: most prominent brand/CTA color. primaryForeground: white or black for ≥4.5:1 on primary.
  • All other tokens follow the same contrast logic.
  • destructive: use safe red (#DC2626) if none visible in images.

Step 3 — INFER typography.
  • Web-safe fonts only: Inter, Roboto, Open Sans, Source Sans Pro, Lato, Poppins.
  • Size hierarchy: H1 2.25rem → H2 1.875rem → H3 1.5rem → body 1rem → small 0.875rem.
  • Weights: headlines 600–700, body 400, buttons 500–600.

Step 4 — GENERATE theme name and description.
  • Name: "[Adjective] [Style]" e.g. "Warm Corporate", "Bold Artistic".
  • Description: single sentence, 10–15 words.

Step 5 — VALIDATE.
  ✅ All hex values are valid 6-digit #RRGGBB format
  ✅ background + foreground contrast ≥4.5:1
  ✅ Typography sizes decrease logically H1 → small
  ✅ success field is true
</task>

<output_contract>
Return ONLY valid JSON. No markdown fences. No explanations. No trailing commas.
Must include: { success: true, ...allTokens }
</output_contract>`;
}

/**
 * =========================================================
 * SKETCH → UI GENERATION PROMPT
 * =========================================================
 */
export function buildSketchGenerationPrompt({
    colors,
    typography,
}: any) {
    // FIX: original had local formatColors/formatTypography that shadowed the
    // module-level helpers with identical logic — a silent copy-paste bug.
    // Now uses the shared helpers directly.
    return `<role>
You are a design engineer that converts wireframe sketches into production-ready HTML.
You are provided a wireframe image and a style guide. Both are mandatory inputs.
</role>

<task>
Step 1 — ANALYSE the wireframe image first.
  • Count every distinct region: headers, sections, cards, forms, footers, etc.
  • Identify the layout pattern: sidebar + main, grid, stacked, etc.
  • Note every image slot and its position.
  • Black background = canvas only (ignore). White labels = component identifiers (do NOT render as text).
  • Do NOT add sections not shown. Do NOT omit sections that are shown.

Step 2 — MAP wireframe labels to HTML elements.
  • "navbar / nav"    → <nav>
  • "hero / banner"   → <section> with large image + overlay
  • "sidebar"         → <aside>
  • "image"           → <img> or skeleton placeholder
  • "button / cta"    → <button>
  • "card"            → <article> with image + text
  • "form / input"    → <form> with <label> + id associations
  • Numbers in boxes  → metric <span> displays

Step 3 — BUILD the HTML structure.
  Required wrapper:
  <div data-generated-ui>
    <style>
      [data-generated-ui] .c-bg { background-color: #HEXVAL; }
      /* all required .c-* classes with literal hex values */
    </style>
    <div class="container mx-auto max-w-7xl">
      <!-- components -->
    </div>
  </div>

  Required .c-* classes:
  Backgrounds: .c-bg .c-card-bg .c-primary-bg .c-secondary-bg .c-accent-bg .c-muted-bg
  Text:        .c-fg .c-card-fg .c-primary-fg .c-secondary-fg .c-accent-fg .c-muted-fg
  Other:       .c-border .c-ring

  Color pairing rules (NEVER mix):
  • Main content  → c-bg + c-fg only
  • Cards         → c-card-bg + c-card-fg only
  • Primary CTA   → c-primary-bg + c-primary-fg only
  • Secondary     → c-secondary-bg + c-secondary-fg only
  • Muted         → c-muted-bg + c-muted-fg only
  • Accent        → c-accent-bg + c-accent-fg only

Step 4 — APPLY style tokens (mandatory).
<style_tokens>
<colors>
${formatColors(colors)}
</colors>
<typography>
${formatTypography(typography)}
</typography>
</style_tokens>

Step 5 — ASSIGN ids to every major component (kebab-case).
  • Navigation: id="main-nav"
  • Hero: id="hero-section"
  • Cards: id="card-1", id="card-2" (sequential)
  • Buttons: id="cta-button", id="submit-btn"
  • Sections: id="about-section", id="features-section"
  • Images: id="hero-image", id="product-image-1"

Step 6 — VERIFY.
  ✅ Sections: py-16 px-6 minimum (hero: py-20 or py-24)
  ✅ Cards: p-6 minimum internal padding
  ✅ Text blocks: space-y-4 minimum
  ✅ Buttons: px-6 py-3 minimum (CTA: px-8 py-4)
  ✅ Button groups: gap-4 or space-x-4
  ✅ Grid gaps: gap-8 minimum
  ✅ Section separation: mb-16 or mb-20 between major sections
  ✅ No Tailwind color utilities — .c-* classes only
  ✅ No viewport units (vh, vw, h-screen)
  ✅ No <script> tags or inline event handlers
  ✅ No <img src=""> with empty src
  ✅ Every major element has a descriptive id
</task>

<output_contract>
Return ONLY the HTML wrapped in <div data-generated-ui>. No explanations. No markdown fences.
</output_contract>`;
}
