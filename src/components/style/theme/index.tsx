import { cn } from "@/lib/utils";
import { ColorSwatch } from "../swatch";

export type Swatch = {
  name: string;
  hexColor: string;
  description?: string;
};

export type ColorSection = {
  title: string;
  swatches: Swatch[];
};

type ColorThemeProps = {
  title: string;
  swatches: Swatch[];
  className?: string;
};

export const ColorTheme = ({ title, swatches, className }: ColorThemeProps) => {
  if (!swatches?.length) return null;

  return (
    <section className={cn("flex flex-col gap-6", className)}>
      {/* Section Title */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <div className="h-px flex-1 bg-border ml-6" />
      </div>

      {/* Swatch Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {swatches.map((swatch, index) => (
          <div
            key={`${swatch.hexColor}-${index}`}
            className="
      group rounded-xl border bg-card
      p-4 transition-all duration-200
      hover:shadow-md hover:border-primary/40
    "
          >
            <ColorSwatch name={swatch.name} value={swatch.hexColor} />

            <div className="mt-3 space-y-1">
              <p className="text-sm font-medium">{swatch.name}</p>

              {swatch.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {swatch.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

type ThemeContentProps = {
  colorGuide?: ColorSection[] | null;
};

export const ThemeContent = ({ colorGuide }: ThemeContentProps) => {
  if (!colorGuide?.length) return null;

  return (
    <div className="flex flex-col gap-10">
      {colorGuide.map((section, index) => (
        <ColorTheme
          key={`${section.title}-${index}`}
          title={section.title}
          swatches={section.swatches}
        />
      ))}
    </div>
  );
};
