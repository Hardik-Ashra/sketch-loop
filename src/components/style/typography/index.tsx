import { Type } from "lucide-react";

type Props = {
  typographyGuide: any;
};

const StyleGuideTypography = ({ typographyGuide }: Props) => {
  const isEmpty =
    !Array.isArray(typographyGuide) || typographyGuide.length === 0;

  if (isEmpty) {
    return (
      <div className="text-center py-24">
        <Type className="w-14 h-14 mx-auto mb-5 text-muted-foreground/60" />
        <h3 className="text-lg font-semibold mb-2">
          No typography guide found
        </h3>
        <p className="text-sm text-muted-foreground">
          Generate a style guide to see typography recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      {typographyGuide.map((section: any) => (
        <section key={section.title} className="flex flex-col gap-6">
          {/* Section Header */}
          <div className="flex items-center">
            <h3 className="text-lg font-semibold tracking-tight">
              {section.title}
            </h3>
            <div className="h-px flex-1 bg-border ml-6" />
          </div>

          {/* Typography Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {section.styles?.map((style: any) => (
              <div
                key={style.name}
                className="
                  group rounded-xl border bg-card
                  p-6 space-y-6
                  transition-all duration-200
                  hover:shadow-md hover:border-primary/40
                "
              >
                {/* Title */}
                <div className="space-y-1">
                  <h4 className="text-base font-semibold">{style.name}</h4>

                  {style.description && (
                    <p className="text-sm text-muted-foreground">
                      {style.description}
                    </p>
                  )}
                </div>

                {/* Typography Preview */}
                <div
                  className="text-foreground leading-tight break-words"
                  style={{
                    fontFamily: style.fontFamily,
                    fontSize: style.fontSize,
                    fontWeight: style.fontWeight,
                    lineHeight: style.lineHeight,
                    letterSpacing: style.letterSpacing || "normal",
                  }}
                >
                  The quick brown fox jumps over the lazy dog
                </div>

                {/* Meta Info */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2 border-t">
                  <div>Font: {style.fontFamily}</div>
                  <div>Size: {style.fontSize}</div>
                  <div>Weight: {style.fontWeight}</div>
                  <div>Line Height: {style.lineHeight}</div>
                  {style.letterSpacing && (
                    <div>Letter Spacing: {style.letterSpacing}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default StyleGuideTypography;
